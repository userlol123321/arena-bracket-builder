import { formats } from './engine.js';
export function validateBackup(data) {
  if (data?.version !== 1 || !Array.isArray(data.tournaments) || data.tournaments.length > 500) throw Error('Unsupported backup file.');
  const tournamentIds = new Set();
  for (const t of data.tournaments) {
    if (!t || typeof t.id !== 'string' || !/^[\w-]+$/.test(t.id) || tournamentIds.has(t.id) || typeof t.name !== 'string' || !Object.hasOwn(formats,t.format) || !['draft','live','complete'].includes(t.status) || !Array.isArray(t.participants) || t.participants.length > 128 || !Array.isArray(t.matches) || t.matches.length > 10000 || (t.status !== 'draft' && !t.matches.length)) throw Error('Invalid bracket in backup.');
    tournamentIds.add(t.id);
    const ids = new Set();
    for (const p of t.participants) { if (!p || typeof p.name !== 'string' || !p.name.trim() || typeof p.id !== 'string' || !/^[\w-]+$/.test(p.id) || ids.has(p.id)) throw Error('Invalid team in backup.'); ids.add(p.id); }
    const mids = new Set();
    for (const m of t.matches) { if (!m || typeof m.id !== 'string' || !/^[\w-]+$/.test(m.id) || mids.has(m.id) || !Number.isInteger(m.round) || m.round < 1 || typeof m.group !== 'string' || ![m.a,m.b,m.winner,m.loser].every(id => id == null || ids.has(id)) || (m.scores !== null && (!Array.isArray(m.scores) || m.scores.length !== 2 || !m.scores.every(n => Number.isSafeInteger(n) && n >= 0 && n <= 99999))) || (m.done && !m.bye && !m.scores)) throw Error('Invalid match in backup.'); mids.add(m.id); }
    for (const m of t.matches) if (m.sources && (!Array.isArray(m.sources) || m.sources.length !== 2 || !m.sources.every(s => Array.isArray(s) && mids.has(s[0]) && ['winner','loser'].includes(s[1])))) throw Error('Invalid match sources.');
  }
  return data.tournaments;
}
