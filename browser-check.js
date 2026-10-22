import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: '3107' }, stdio: ['ignore','pipe','inherit'] });
let browser;
try {
  await new Promise((resolve,reject) => { server.stdout.once('data',resolve); server.once('error',reject); server.once('exit',code => reject(Error(`Server exited: ${code}`))); });
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror',e => errors.push(e.message));
  await page.goto('http://localhost:3107');
  await page.getByRole('heading', { name: 'Drop your Excel file here' }).waitFor();
  const templatePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download an Excel template' }).click();
  const template = await templatePromise; assert.equal(await template.failure(),null);
  const w = new ExcelJS.Workbook();
  w.addWorksheet('Notes').addRow(['Choose Teams instead']);
  const sheet = w.addWorksheet('Teams'); sheet.addRow(['Seed','Team name']);
  ['Eclipse','Orbit','Night Owls','Cloud Nine','Wildcards'].forEach((name,i) => sheet.addRow([i+1,name]));
  await page.locator('#excel-input').setInputFiles({ name:'My teams.xlsx', mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer:Buffer.from(await w.xlsx.writeBuffer()) });
  await page.locator('#import-sheet').selectOption('1');
  assert.match(await page.locator('#import-preview').innerText(),/5 teams found/);
  await page.getByRole('button', { name:'Build bracket →', exact:true }).click();
  await page.getByRole('heading', { name:'My teams', exact:true }).waitFor();
  assert.equal(await page.locator('.match-card').count(),7);
  for (const type of ['png','svg','json','csv']) {
    await page.getByRole('button', { name:'Export bracket',exact:false }).click();
    await page.locator('select[name="type"]').selectOption(type);
    const promise = page.waitForEvent('download');
    await page.locator('#dialog-form').getByRole('button',{name:'Export',exact:true}).click();
    const download = await promise; assert.equal(await download.failure(),null);
    const stream = await download.createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk); const bytes = Buffer.concat(chunks);
    assert.ok(bytes.length > 20);
    if (type === 'png') assert.equal(bytes.subarray(1,4).toString(),'PNG');
    if (type === 'svg') assert.match(bytes.toString(),/<svg/);
  }
  await page.locator('.match-card.ready').first().click();
  await page.locator('input[name="score0"]').fill('2');
  await page.getByRole('button',{name:'Confirm result'}).click();
  await page.reload();
  await page.locator('.tournament-card').filter({hasText:'My teams'}).click();
  assert.ok(await page.locator('.match-player.winner').count() > 0);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'My brackets',exact:false}).first().click();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors,[]);
  console.log('Browser checks passed: template, Excel sheet/column selection, generation, PNG/SVG/JSON/CSV exports, scoring, persistence, and mobile layout.');
} finally { await browser?.close(); server.kill(); }
