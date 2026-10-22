import test from 'node:test';
import assert from 'node:assert/strict';
import { DriveStorage } from './drive.js';
import { createTournament } from './engine.js';
const makeBracket = () => createTournament({name:'Friday finals',format:'single'});
function fixture(responses = []) {
  const memory = new Map(), calls = [];
  const storage = { getItem:key => memory.get(key) ?? null, setItem:(key,value) => memory.set(key,value) };
  const drive = new DriveStorage({ storage, fetcher:async (url,options) => {
    calls.push({url,options});
    assert.ok(responses.length, `Unexpected request: ${url}`);
    const result = responses.shift();
    if (result instanceof Error) throw result;
    return new Response(JSON.stringify(result.body ?? result),{status:result.status || 200,headers:{'Content-Type':'application/json'}});
  }});
  drive.token = 'test-token'; drive.expires = Date.now()+3600000; drive.folder = 'folder-1';
  return {drive,memory,calls};
}
function metadata(t, time = '2026-01-01T00:00:00Z') { return {id:'file-1',name:`${t.name}.json`,modifiedTime:time,parents:['folder-1'],appProperties:{arenaApp:'arena-bracket-v1',bracketId:t.id},size:'1000',trashed:false}; }
test('new Drive save sends multipart JSON and persists file linkage without token', async () => {
  const t = makeBracket(), file = metadata(t);
  const {drive,memory,calls} = fixture([{files:[]},file]);
  await drive.save(t);
  assert.equal(calls[1].options.method,'POST');
  assert.match(calls[1].options.headers['Content-Type'],/^multipart\/related; boundary=arena_/);
  assert.match(await calls[1].options.body.text(),/Friday finals/);
  assert.match(calls[1].url,/upload\/drive\/v3\/files\?uploadType=multipart/);
  assert.equal(drive.linked(t.id).fileId,'file-1');
  assert.ok(![...memory.values()].join('').includes('test-token'));
});
test('linked Drive save updates the same file and records new revision', async () => {
  const t = makeBracket(), old = metadata(t), updated = metadata(t,'2026-01-02T00:00:00Z');
  const {drive,calls} = fixture([old,updated]); drive.remember(t.id,old);
  await drive.save(t);
  assert.equal(calls[1].options.method,'PATCH');
  assert.equal(drive.linked(t.id).modifiedTime,updated.modifiedTime);
});
test('newer remote revision blocks overwrites and deletion', async () => {
  const t = makeBracket(), newer = metadata(t,'2026-01-02T00:00:00Z');
  const {drive,calls} = fixture([newer,newer]); drive.remember(t.id,metadata(t));
  await assert.rejects(drive.save(t),/changed in Drive/);
  await assert.rejects(drive.deleteLinked(t.id),/changed in Drive/);
  assert.equal(calls.length,2);
  assert.ok(calls.every(c => !c.options.method));
});
test('load validates data and links only a valid bracket', async () => {
  const t = makeBracket();
  const {drive} = fixture([metadata(t),{version:1,tournaments:[t]}]);
  assert.deepEqual(await drive.load('file-1'),t);
  assert.equal(drive.linked(t.id).fileId,'file-1');
  const bad = fixture([metadata(t),{version:1,tournaments:[{...t,id:'<script>'}]}]);
  await assert.rejects(bad.drive.load('file-1'),/Invalid bracket/);
  assert.equal(bad.drive.linked(t.id),null);
});
test('delete trashes remote file before forgetting its local link', async () => {
  const t = makeBracket();
  const {drive,calls} = fixture([metadata(t),{id:'file-1'}]); drive.remember(t.id,metadata(t));
  await drive.deleteLinked(t.id);
  assert.equal(calls[1].options.body,JSON.stringify({trashed:true}));
  assert.equal(drive.linked(t.id),null);
});
test('failed deletion retains linkage and disconnected deletion is blocked', async () => {
  const t = makeBracket(); const {drive} = fixture([metadata(t),{status:403,body:{error:'no access'}}]); drive.remember(t.id,metadata(t));
  await assert.rejects(drive.deleteLinked(t.id),/denied/);
  assert.ok(drive.linked(t.id));
  drive.disconnect();
  await assert.rejects(drive.deleteLinked(t.id),/Connect/);
  assert.ok(drive.linked(t.id));
});
test('list follows pagination and rejects expired tokens', async () => {
  const {drive,calls} = fixture([{files:[{id:'one'}],nextPageToken:'next-page'},{files:[{id:'two'}]}]);
  assert.equal((await drive.list()).length,2);
  assert.match(calls[1].url,/pageToken=next-page/);
  drive.expires = Date.now()-1;
  await assert.rejects(drive.list(),/Connect/);
});
test('missing link cannot overwrite an existing Drive bracket', async () => {
  const t = makeBracket(); const {drive,calls} = fixture([{files:[metadata(t)]}]);
  await assert.rejects(drive.save(t),/already exists/);
  assert.equal(calls.length,1);
});
test('wrong-account links and foreign files are rejected', async () => {
  const t = makeBracket(); const {drive,calls} = fixture([{...metadata(t),parents:['unrelated-folder']}]);
  await assert.rejects(drive.load('file-1'),/not an available bracket/);
  drive.remember(t.id,metadata(t)); drive.folder = 'another-account-folder';
  await assert.rejects(drive.save(t),/another Google account/);
  assert.equal(calls.length,1);
});
