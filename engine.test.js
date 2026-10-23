import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { createTournament, start, report, updateScores, nextSwiss, standings } from './engine.js';
import { cellText, extractTeams } from './teams.js';
function fixture(format, count) {
  const t = createTournament({ name: 'Test', format, swissRounds: 4 });
  t.participants = Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `Team ${i + 1}` }));
  start(t); return t;
}
for (const format of ['single', 'double']) {
  test(`${format}: all sizes from 2–128 finish with valid elimination counts`, () => {
    for (let n = 2; n <= 128; n++) {
      const t = fixture(format, n);
      let played = 0;
      while (t.status !== 'complete') {
        const m = t.matches.find(m => !m.done && m.a && m.b);
        assert.ok(m, `${format} ${n} teams stalled`);
        assert.notEqual(m.a, m.b);
        // Force the losers-bracket finalist to win the first grand final.
        report(t, m.id, m.id === 'F1' ? 0 : 1, m.id === 'F1' ? 1 : 0);
        assert.ok(++played < n * 3);
      }
      const losses = new Map(t.participants.map(p => [p.id, 0]));
      for (const m of t.matches) if (m.loser) losses.set(m.loser, losses.get(m.loser) + 1);
      const champion = t.matches.at(-1).winner;
      for (const [id, count] of losses) assert.equal(count, id === champion ? format === 'double' ? 1 : 0 : format === 'double' ? 2 : 1);
      assert.equal(played, format === 'single' ? n - 1 : 2 * n - 1);
    }
  });
}
test('round robin pairs each team exactly once and supports draws', () => {
  for (const n of [3,4,7,8]) {
    const t = fixture('robin', n);
    assert.equal(t.matches.length, n * (n - 1) / 2);
    assert.equal(new Set(t.matches.map(m => [m.a,m.b].sort().join(':'))).size, t.matches.length);
    for (const m of t.matches) report(t,m.id,2,2);
    assert.equal(t.status,'complete');
    assert.ok(standings(t).every(p => p.points === n - 1));
  }
});
test('Swiss completes rounds and assigns one bye per odd round', () => {
  const t = fixture('swiss',7);
  while (t.status !== 'complete') {
    for (const m of t.matches.filter(m => !m.done)) report(t,m.id,3,1);
    if (t.status !== 'complete') nextSwiss(t);
  }
  const byes = t.matches.filter(m => m.bye);
  assert.equal(byes.length,4);
  assert.equal(new Set(byes.map(m => m.winner)).size,4);
});
test('live score changes do not advance teams or alter standings until explicitly finalized', () => {
  for (const format of ['single','double','robin','swiss']) {
    const t = fixture(format,4), m = t.matches.find(m => !m.done && m.a && m.b);
    updateScores(t,m.id,2,2); updateScores(t,m.id,7,3);
    assert.deepEqual(m.scores,[7,3]); assert.equal(m.done,false); assert.equal(m.winner,null);
    assert.ok(standings(t).every(p => p.played === 0 && p.points === 0));
    if (format === 'single' || format === 'double') assert.ok(t.matches.filter(m => m.sources).every(m => !m.a && !m.b));
    report(t,m.id,7,3);
    assert.equal(m.done,true); assert.equal(m.winner,m.a);
    assert.throws(() => updateScores(t,m.id,8,3),/not ready/);
  }
  const t = fixture('single',4);
  updateScores(t,'W1-0',3,3);
  assert.throws(() => report(t,'W1-0',3,3),/winner/);
  assert.equal(t.matches[0].done,false);
  report(t,'W1-0',4,3);
  assert.equal(t.matches.find(m => m.id === 'W2-0').a,t.matches[0].winner);
  assert.equal(t.matches.find(m => m.id === 'W2-0').b,null);
  report(t,'W1-1',2,1);
  const final = t.matches.find(m => m.id === 'W2-0');
  assert.equal(final.a,t.matches[0].winner); assert.equal(final.b,t.matches[1].winner);
});
test('invalid elimination scores do not mutate matches', () => {
  const t = fixture('single',4), m = t.matches[0];
  assert.throws(() => report(t,m.id,1,1));
  assert.throws(() => report(t,m.id,-1,2));
  assert.equal(m.done,false);
});
test('Excel round trip preserves teams from selected sheet and column', async () => {
  const w = new ExcelJS.Workbook(); w.addWorksheet('Notes').addRow(['Ignore me']);
  const s = w.addWorksheet('Teams');
  s.addRow(['Seed','Team name']); s.addRow([1,'Eclipse']); s.addRow([2,'夜のチーム']); s.addRow([3,'']); s.addRow([4,{richText:[{text:'Team '},{text:'Orbit'}]}]);
  const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(await w.xlsx.writeBuffer());
  const rows = []; loaded.getWorksheet('Teams').eachRow(row => rows.push(row.values.slice(1).map(cellText)));
  assert.deepEqual(extractTeams(rows,1,true),['Eclipse','夜のチーム','Team Orbit']);
  assert.throws(() => extractTeams([['Team'],['A'],[' a ']],0,true),/Duplicate/);
  assert.throws(() => extractTeams([['A']],0,false,['a']),/Duplicate/);
  assert.throws(() => extractTeams(Array.from({length:129},(_,i) => [String(i)]),0,false),/128/);
});
