export const formats = { single: 'Single elimination', double: 'Double elimination', robin: 'Round robin', swiss: 'Swiss' };
const match = (id, a, b, round, group = 'Winners') => ({ id, a, b, round, group, scores: null, winner: null, loser: null, done: false });
export function createTournament(data) {
  return { id: crypto.randomUUID(), name: data.name, game: data.game || 'General competition', format: data.format, date: data.date || '', description: data.description || '', participants: [], matches: [], status: 'draft', created: new Date().toISOString(), swissRounds: Number(data.swissRounds) || 3 };
}
export function start(t) {
  if (t.participants.length < 2) throw new Error('Add at least two participants.');
  t.matches = []; t.status = 'live';
  const ids = t.participants.map(p => p.id);
  if (t.format === 'single' || t.format === 'double') {
    const size = 2 ** Math.ceil(Math.log2(ids.length));
    let seeds = [1, 2];
    while (seeds.length < size) seeds = seeds.flatMap(s => [s, seeds.length * 2 + 1 - s]);
    const rounds = Math.log2(size);
    for (let r = 1; r <= rounds; r++) {
      for (let i = 0; i < size / 2 ** r; i++) {
        const m = match(`W${r}-${i}`, r === 1 ? ids[seeds[i * 2] - 1] || null : null, r === 1 ? ids[seeds[i * 2 + 1] - 1] || null : null, r);
        if (r > 1) m.sources = [[`W${r - 1}-${i * 2}`, 'winner'], [`W${r - 1}-${i * 2 + 1}`, 'winner']];
        t.matches.push(m);
      }
    }
    if (t.format === 'double') {
      if (rounds > 1) {
        for (let i = 0; i < size / 4; i++) {
          const m = match(`L1-${i}`, null, null, 1, 'Losers');
          m.sources = [[`W1-${i * 2}`, 'loser'], [`W1-${i * 2 + 1}`, 'loser']]; t.matches.push(m);
        }
        for (let r = 2; r <= 2 * rounds - 2; r++) {
          const count = size / 2 ** (Math.floor((r + 1) / 2) + 1);
          for (let i = 0; i < count; i++) {
            const m = match(`L${r}-${i}`, null, null, r, 'Losers');
            m.sources = r % 2 === 0 ? [[`L${r - 1}-${i}`, 'winner'], [`W${r / 2 + 1}-${count - 1 - i}`, 'loser']] : [[`L${r - 1}-${2 * i}`, 'winner'], [`L${r - 1}-${2 * i + 1}`, 'winner']];
            t.matches.push(m);
          }
        }
      }
      const final = match('F1', null, null, 1, 'Finals');
      final.sources = [[`W${rounds}-0`, 'winner'], [rounds === 1 ? 'W1-0' : `L${2 * rounds - 2}-0`, rounds === 1 ? 'loser' : 'winner']];
      t.matches.push(final);
    }
    resolve(t);
  } else if (t.format === 'robin') {
    const rotation = [...ids]; if (rotation.length % 2) rotation.push(null);
    for (let r = 1; r < rotation.length; r++) {
      for (let i = 0; i < rotation.length / 2; i++) {
        const a = rotation[i], b = rotation[rotation.length - 1 - i];
        if (a && b) t.matches.push(match(`R${r}-${i}`, a, b, r, 'Round robin'));
      }
      rotation.splice(1, 0, rotation.pop());
    }
  } else nextSwiss(t);
}
export function resolve(t) {
  for (const m of t.matches) {
    if (m.done) continue;
    if (m.sources) {
      const parents = m.sources.map(([id]) => t.matches.find(p => p.id === id));
      [m.a, m.b] = m.sources.map(([,field],i) => parents[i]?.done ? parents[i][field] : null);
      if (!parents.every(p => p?.done)) continue;
    }
    if (!m.a || !m.b) { m.done = true; m.winner = m.a || m.b; m.loser = null; m.bye = true; }
  }
  if (t.format === 'double') {
    const f = t.matches.find(m => m.id === 'F1');
    if (f.done && f.winner === f.b && !t.matches.some(m => m.id === 'F2')) t.matches.push(match('F2', f.a, f.b, 2, 'Finals'));
  }
  if (t.matches.every(m => m.done) && (t.format !== 'swiss' || Math.max(...t.matches.map(m => m.round)) >= Math.min(t.swissRounds, t.participants.length - 1))) t.status = 'complete';
}
function scoringMatch(t, id, a, b) {
  const m = t.matches.find(m => m.id === id);
  if (!m || m.done || !m.a || !m.b) throw new Error('This match is not ready for scoring.');
  if (![a, b].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 99999)) throw new Error('Use whole-number scores from 0 to 99999.');
  return m;
}
export function updateScores(t, id, a, b) {
  const m = scoringMatch(t,id,a,b);
  // Live scores do not finalize a match, affect standings, or resolve descendants.
  m.scores = [a,b];
}
export function report(t, id, a, b) {
  const m = scoringMatch(t,id,a,b);
  if (a === b && ['single', 'double'].includes(t.format)) throw new Error('Elimination matches need a winner.');
  m.scores = [a, b]; m.done = true;
  m.winner = a === b ? null : a > b ? m.a : m.b; m.loser = a === b ? null : a > b ? m.b : m.a;
  resolve(t);
}
export function standings(t) {
  const rows = t.participants.map(p => ({ ...p, played: 0, wins: 0, losses: 0, draws: 0, points: 0, diff: 0 }));
  for (const m of t.matches.filter(m => m.done)) {
    if (m.bye) { if (t.format === 'swiss') { const p = rows.find(p => p.id === m.winner); if (p) { p.wins++; p.points += 3; } } continue; }
    for (const [i, id] of [m.a, m.b].entries()) {
      const p = rows.find(p => p.id === id); if (!p) continue;
      p.played++; p.diff += m.scores[i] - m.scores[1 - i];
      if (!m.winner) { p.draws++; p.points++; } else if (m.winner === id) { p.wins++; p.points += 3; } else p.losses++;
    }
  }
  return rows.sort((a, b) => b.points - a.points || b.diff - a.diff || a.name.localeCompare(b.name));
}
export function nextSwiss(t) {
  if (t.matches.some(m => !m.done)) throw new Error('Finish all current matches first.');
  const round = Math.max(0, ...t.matches.map(m => m.round)) + 1;
  if (round > Math.min(t.swissRounds, t.participants.length - 1)) throw new Error('All Swiss rounds are finished.');
  const pool = standings(t).map(p => p.id);
  if (pool.length % 2) {
    const id = [...pool].reverse().find(id => !t.matches.some(m => m.bye && m.winner === id)) || pool.at(-1);
    pool.splice(pool.indexOf(id), 1); const bye = match(`S${round}-bye`, id, null, round, 'Swiss'); bye.done = true; bye.bye = true; bye.winner = id; t.matches.push(bye);
  }
  let i = 0;
  while (pool.length) {
    const a = pool.shift(); let index = pool.findIndex(b => !t.matches.some(m => (m.a === a && m.b === b) || (m.b === a && m.a === b)));
    if (index < 0) index = 0;
    t.matches.push(match(`S${round}-${i++}`, a, pool.splice(index, 1)[0], round, 'Swiss'));
  }
}
