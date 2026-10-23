import test from 'node:test';
import assert from 'node:assert/strict';
import { createArenaServer } from './server.js';
import { createTournament } from './engine.js';
test('local stream lifecycle is read-only, owner-scoped, revocable, and temporary',async () => {
  const server = createArenaServer(); await new Promise(r => server.listen(0,'127.0.0.1',r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const owner = 'a'.repeat(72), other = 'b'.repeat(72);
  const call = (path,method = 'GET',body,key = owner,origin) => fetch(base+path,{method,headers:{...(key ? {Authorization:`Bearer ${key}`} : {}),'Content-Type':'application/json',...(origin ? {Origin:origin} : {})},...(body ? {body:JSON.stringify(body)} : {})});
  try {
    const bracket = createTournament({name:'Local final',format:'single'});
    assert.equal((await call('/local/streams','POST',{bracket},owner,'https://evil.example')).status,403);
    assert.equal((await call('/local/streams','GET',null,null)).status,401);
    assert.equal((await call('/local/streams','POST',{bracket:{}})).status,400);
    const link = await (await call('/local/streams','POST',{bracket})).json();
    assert.match(link.token,/^[a-f0-9]{48}$/);
    const view = await (await call(`/live/${link.token}`,'GET',null,null)).json();
    assert.equal(view.bracket.name,'Local final'); assert.equal(view.owner,undefined);
    assert.equal((await call(`/live/${link.token}`,'PUT',{bracket},null)).status,405);
    assert.equal((await call(`/local/streams/${link.token}`,'PUT',{bracket},null)).status,401);
    assert.equal((await call(`/local/streams/${link.token}`,'DELETE',null,other)).status,404);
    assert.equal((await (await call('/local/streams','GET',null,other)).json()).streams.length,0);
    bracket.name = 'Updated final';
    assert.equal((await call(`/local/streams/${link.token}`,'PUT',{bracket})).status,200);
    const updated = await (await call(`/live/${link.token}`,'GET',null,null)).json();
    assert.equal(updated.bracket.name,'Updated final'); assert.equal(updated.revision,2);
    const same = await (await call('/local/streams','POST',{bracket})).json(); assert.equal(same.token,link.token);
    assert.equal((await call(`/local/streams/${link.token}`,'DELETE')).status,200);
    assert.equal((await call(`/live/${link.token}`,'GET',null,null)).status,404);
    assert.equal((await call(`/local/streams/${link.token}`,'PUT',{bracket})).status,404);
    const fresh = await (await call('/local/streams','POST',{bracket})).json(); assert.notEqual(fresh.token,link.token);
    assert.equal((await fetch(base+'/drive.js')).status,404);
    assert.equal((await fetch(base+'/config.js')).status,404);
  } finally { await new Promise(r => server.close(r)); }
  const restarted = createArenaServer(); await new Promise(r => restarted.listen(0,'127.0.0.1',r));
  try { const res = await fetch(`http://127.0.0.1:${restarted.address().port}/local/streams`,{headers:{Authorization:`Bearer ${owner}`}}); assert.deepEqual((await res.json()).streams,[]); }
  finally { await new Promise(r => restarted.close(r)); }
});
