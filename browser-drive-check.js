import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createTournament } from './engine.js';

// Serve only the generated artifact at a repository subpath, like GitHub Pages.
const allowed = new Set(['index.html','app.js','engine.js','teams.js','drive.js','backup.js','config.js','exceljs.min.js','style.css','SETUP.md']);
const server = createServer(async (req,res) => {
  const path = new URL(req.url,'http://localhost').pathname;
  const file = path === '/arena-test/' ? 'index.html' : path.replace('/arena-test/','');
  if (!path.startsWith('/arena-test/') || !allowed.has(file)) { res.writeHead(404); res.end(); return; }
  try { const data = await readFile(new URL(`dist/${file}`,import.meta.url)); res.writeHead(200,{'Content-Type':file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'text/plain'}); res.end(data); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(3108,'127.0.0.1',resolve));
let browser;
try {
  browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'chrome'});
  const page = await browser.newPage(); const errors = []; page.on('pageerror',e => errors.push(e.message));
  await page.route('https://accounts.google.com/gsi/client',route => route.fulfill({contentType:'text/javascript',body:'window.google={accounts:{oauth2:{initTokenClient:opts=>({requestAccessToken:()=>setTimeout(()=>opts.callback({access_token:"mock-token",expires_in:3600}),0)})}}};'}));
  const bracket = createTournament({name:'Cloud bracket',format:'single'});
  let remote = null, payload = null, revision = 0, writes = 0;
  await page.route('https://www.googleapis.com/**',async route => {
    const request = route.request(), url = new URL(request.url());
    const reply = data => route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
    if (url.pathname.startsWith('/upload/')) {
      writes++;
      const boundary = request.headers()['content-type'].split('boundary=')[1];
      const parts = request.postData().split(`--${boundary}`);
      const meta = JSON.parse(parts[1].split('\r\n\r\n')[1].trim());
      payload = JSON.parse(parts[2].split('\r\n\r\n')[1].trim());
      remote = {id:'file-1',name:meta.name,appProperties:meta.appProperties,parents:['folder-1'],modifiedTime:`2026-01-01T00:00:0${++revision}Z`,size:'1000',trashed:false};
      return reply(remote);
    }
    if (url.pathname.endsWith('/files') && request.method() === 'GET') {
      return reply({files:url.searchParams.get('q').includes('mimeType') ? [{id:'folder-1'}] : remote && !remote.trashed ? [remote] : []});
    }
    if (url.pathname.endsWith('/files/file-1')) {
      if (request.method() === 'PATCH') { remote.trashed = true; return reply({id:remote.id}); }
      return reply(url.searchParams.get('alt') === 'media' ? payload : remote);
    }
    return route.fulfill({status:500,body:'Unexpected request'});
  });
  await page.goto('http://localhost:3108/arena-test/');
  await page.evaluate(t => localStorage.setItem('arena-v1',JSON.stringify([t])),bracket); await page.reload();
  await page.locator('#drive-open').click();
  await page.locator('#google-client-id').fill('123-test.apps.googleusercontent.com');
  await page.locator('[data-cloud=connect]').click();
  await page.locator('[data-cloud=save]').waitFor();
  await page.locator('[data-cloud=save]').click();
  await page.locator('[data-cloud=load]').waitFor();
  assert.equal(writes,1); assert.equal(payload.tournaments[0].name,'Cloud bracket');
  // A newer remote revision must block a stale local write.
  remote.modifiedTime = '2026-01-02T00:00:00Z';
  await page.locator('[data-cloud=save]').click();
  await page.waitForFunction(() => document.querySelector('#drive-status').textContent.includes('changed in Drive'));
  assert.equal(writes,1);
  await page.locator('[data-cloud=close]').click();
  // A fresh browser session loads data from the hosted Drive panel.
  await page.evaluate(() => localStorage.removeItem('arena-v1')); await page.reload();
  await page.locator('#drive-open').click(); await page.locator('[data-cloud=connect]').click();
  await page.locator('[data-cloud=load]').click();
  await page.waitForFunction(() => document.querySelector('#drive-status').textContent.includes('loaded from Google Drive'));
  assert.equal(await page.locator('#nav-count').innerText(),'1');
  await page.locator('[data-cloud=close]').click();
  await page.locator('[data-action=back]').click();
  await page.locator('[data-delete]').click();
  await page.getByRole('button',{name:'Delete bracket',exact:true}).click();
  await page.waitForFunction(() => document.querySelector('#nav-count').textContent === '0');
  assert.equal(remote.trashed,true);
  await page.reload(); assert.equal(await page.locator('[data-delete]').count(),0);
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors,[]);
  console.log('Hosted-path browser checks passed: static assets, mocked sign-in, Drive save/load, conflict protection, linked deletion, persistence, and mobile layout.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
