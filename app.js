import { formats, createTournament, start, report, standings, nextSwiss } from './engine.js';
import { cellText, extractTeams } from './teams.js';
import { validateBackup } from './backup.js';
import { DriveStorage } from './drive.js';
import { googleClientId } from './config.js';
const drive = new DriveStorage();
let driveFiles = [], driveBusy = false;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let tournaments = [], selected = null, tab = 'bracket', filter = 'all', search = '';
let excelTarget = null;
try { tournaments = JSON.parse(localStorage.getItem('arena-v1') || '[]'); if (!Array.isArray(tournaments)) throw Error(); } catch { tournaments = []; alert('Your saved workspace could not be read. Import a backup to recover it.'); }
const current = () => tournaments.find(t => t.id === selected);
const name = (t, id) => t.participants.find(p => p.id === id)?.name || 'To be determined';
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('show'), 3500); }
function save() { try { localStorage.setItem('arena-v1', JSON.stringify(tournaments)); } catch { toast('Storage is full or unavailable. Export a backup now to keep your work.'); } render(); }
function modal(title, body, submit, action) {
  $('#dialog-form').innerHTML = `<div class="modal-heading"><h2>${title}</h2><button type="button" class="icon-button" id="close-dialog" aria-label="Close">×</button></div>${body}<div class="modal-actions"><button type="button" class="button secondary" id="cancel-dialog">Cancel</button><button class="button primary">${submit}</button></div>`;
  $('#close-dialog').onclick = $('#cancel-dialog').onclick = () => $('#dialog').close();
  $('#dialog-form').onsubmit = async e => {
    e.preventDefault(); const form = e.target; const data = new FormData(form);
    const buttons = [...form.querySelectorAll('button')]; buttons.forEach(b => b.disabled = true);
    try { await action(data); $('#dialog').close(); } catch (error) { toast(error.message); }
    finally { buttons.forEach(b => b.disabled = false); }
  };
  $('#dialog').showModal();
}
function editor(t) {
  modal(t ? 'Bracket settings' : 'Create a bracket', `<label>Bracket name<input name="name" required maxlength="100" placeholder="e.g. Friday Night Finals" value="${esc(t?.name || '')}"></label><label>Format<select name="format" ${t?.status !== 'draft' && t ? 'disabled' : ''}>${Object.entries(formats).map(([key, label]) => `<option value="${key}" ${t?.format === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>Swiss rounds (Swiss format only)<input type="number" name="swissRounds" min="1" max="20" value="${t?.swissRounds || 3}" ${t && t.status !== 'draft' ? 'disabled' : ''}></label>`, t ? 'Save settings' : 'Create bracket', data => {
    const values = Object.fromEntries(data); values.name = values.name.trim(); if (!values.name) throw Error('Give your tournament a name.');
    if (t) Object.assign(t, values, { swissRounds: Number(values.swissRounds || t.swissRounds) });
    else { const fresh = createTournament(values); tournaments.unshift(fresh); selected = fresh.id; tab = 'participants'; }
    save();
  });
}
function dashboard() {
  const visible = tournaments.filter(t => `${t.name}`.toLowerCase().includes(search.toLowerCase()));
  $('#app').innerHTML = `<section class="page-heading"><div><div class="eyebrow">FROM SPREADSHEET TO SHOWDOWN</div><h1>Your bracket. Your way<span class="accent">.</span></h1><p>Upload your teams, build a bracket, and make it yours.</p></div><button class="button secondary" data-action="create">＋ Blank bracket</button></section>
  <section class="upload-hero" id="drop-zone"><div class="upload-emblem">↥</div><div class="eyebrow">LESS SETUP. MORE GAME.</div><h2>Drop your Excel file here</h2><p>One column of team names is all you need.<br>Choose your sheet and column, then we’ll build the bracket.</p><button class="button primary" data-action="excel">Choose Excel file →</button><small>.xlsx files · Up to 128 teams · Processed on your device</small><button class="text-button" data-action="template">Download an Excel template ↧</button></section>
  <div class="workflow"><span><b>01</b> Upload your teams</span><span>→</span><span><b>02</b> Pick a bracket format</span><span>→</span><span><b>03</b> Export & share</span></div>
  <section class="section-toolbar"><h2>My brackets <span class="muted">${tournaments.length}</span></h2><input class="search" id="search" placeholder="Search brackets…" aria-label="Search brackets" value="${esc(search)}"></section>
  <section class="tournament-grid">${visible.map((t, i) => `<div class="bracket-card-wrapper"><button class="tournament-card" data-open="${t.id}"><div class="card-art art-${i % 4}"><span class="art-lines"></span><span class="game-symbol">${['◈','✦','⌘','◇'][i % 4]}</span><span class="badge ${t.status}">${t.status === 'draft' ? 'Draft' : t.status === 'complete' ? 'Completed' : 'Generated'}</span><span class="art-caption">${esc(formats[t.format])}</span></div><div class="card-body"><small>${t.participants.length} TEAMS</small><h3>${esc(t.name)}</h3><div class="card-footer"><span>${t.status === 'draft' ? 'Edit teams & seeds' : 'View & export bracket'}</span><span>↗</span></div></div></button><button class="delete-bracket" data-delete="${t.id}" aria-label="Delete ${esc(t.name)}">Delete</button></div>`).join('')}
  <button class="new-card" data-action="create"><span>＋</span><strong>Build a blank bracket</strong><small>Prefer to add your teams manually?</small></button></section><footer>Your teams. Your brackets.<span>Saved locally · No account needed</span></footer>`;
  $('#search').oninput = e => { const pos = e.target.selectionStart; search = e.target.value; dashboard(); $('#search').focus(); $('#search').setSelectionRange(pos, pos); };
  const drop = $('#drop-zone');
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('dragging'); };
  drop.ondragleave = () => drop.classList.remove('dragging');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('dragging'); excelTarget = null; if (e.dataTransfer.files[0]) importExcel(e.dataTransfer.files[0]); };
}
function detail() {
  const t = current(); if (!t) { selected = null; return dashboard(); }
  const final = t.matches.at(-1);
  $('#app').innerHTML = `<button class="back-link" data-action="back">← My brackets</button><section class="page-heading detail-heading"><div><div class="eyebrow">BRACKET BUILDER <span class="badge ${t.status}">${t.status === 'live' ? 'Generated' : t.status}</span></div><h1>${esc(t.name)}</h1><p>${esc(formats[t.format])} <span class="separator">/</span> ${t.participants.length} teams</p></div><div class="actions"><button class="button secondary" data-action="settings">⚙ Settings</button><button class="button primary" data-action="export">↧ Export bracket</button></div></section>
  ${t.description ? `<p class="description">${esc(t.description)}</p>` : ''}
  ${t.status === 'complete' ? `<div class="champion">♜ <div><small>${['single','double'].includes(t.format) ? 'TOURNAMENT CHAMPION' : 'TOP OF THE STANDINGS'}</small><strong>${esc(name(t, ['single','double'].includes(t.format) ? final.winner : standings(t)[0]?.id))}</strong></div><span>Competition complete</span></div>` : ''}
  <div class="section-toolbar"><div class="tabs">${['bracket','participants','standings','matches'].map(v => `<button data-tab="${v}" class="${tab === v ? 'active' : ''}">${v === 'participants' ? 'Teams & seeds' : v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div><div class="actions">${t.status === 'draft' ? '<button class="button primary small" data-action="start">Generate bracket →</button>' : '<button class="button secondary small" data-action="reset">Reset & edit teams</button>'}${t.format === 'swiss' && t.status === 'live' && t.matches.every(m => m.done) ? '<button class="button primary small" data-action="swiss">Next round →</button>' : ''}</div></div>
  <section id="detail-content">${tab === 'participants' ? participants(t) : tab === 'standings' ? ranking(t) : tab === 'matches' ? matches(t) : bracket(t)}</section>`;
}
function participants(t) {
  return `<div class="content-heading"><div><h2>Teams <span class="muted">${t.participants.length}</span></h2><p>Spreadsheet order becomes seed order. Move teams up or shuffle before generating.</p></div>${t.status === 'draft' ? '<div class="actions"><button class="button secondary small" data-action="shuffle">⇄ Shuffle</button><button class="button secondary small" data-action="add">＋ Add teams</button><button class="button primary small" data-action="excel">↥ Upload Excel</button></div>' : ''}</div>${t.participants.length ? `<div class="table-wrap"><table><thead><tr><th>Seed</th><th>Team name</th><th>Actions</th></tr></thead><tbody>${t.participants.map((p, i) => `<tr><td class="muted">${i + 1}</td><td><span class="player-avatar">${esc(p.name[0])}</span>${esc(p.name)}</td><td>${t.status === 'draft' ? `<button class="icon-button" data-up="${p.id}" aria-label="Move ${esc(p.name)} up" ${i === 0 ? 'disabled' : ''}>↑</button><button class="icon-button" data-remove="${p.id}" aria-label="Remove ${esc(p.name)}">×</button>` : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><span>↥</span><h3>Your teams go here</h3><p>Upload an Excel spreadsheet to populate your bracket.</p><button class="button primary" data-action="excel">Upload Excel file</button></div>'}`;
}
function ranking(t) {
  return `<div class="content-heading"><div><h2>Standings</h2><p>Win: 3 points · Draw: 1 point · Sorted by points, score difference, then name.</p></div><button class="button secondary small" data-action="csv">Download CSV</button></div><div class="table-wrap"><table><thead><tr><th>Rank</th><th>Participant</th><th>Played</th><th>W</th><th>L</th><th>D</th><th>+/−</th><th>Points</th></tr></thead><tbody>${standings(t).map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.name)}</td><td>${p.played}</td><td class="win-text">${p.wins}</td><td>${p.losses}</td><td>${p.draws}</td><td>${p.diff}</td><td><strong>${p.points}</strong></td></tr>`).join('')}</tbody></table></div>${['single','double'].includes(t.format) ? '<p class="hint">These are match statistics. The bracket determines the elimination champion.</p>' : ''}`;
}
function matchCard(t, m) {
  const ready = !m.done && m.a && m.b;
  return `<button class="match-card ${ready ? 'ready' : ''}" ${ready ? `data-score="${m.id}"` : 'disabled'}><div class="match-label">${m.id}<span>${m.bye ? 'BYE' : m.done ? 'FINAL' : ready ? 'REPORT SCORE ↗' : 'UPCOMING'}</span></div>${[m.a, m.b].map((id, i) => `<div class="match-player ${m.winner && m.winner === id ? 'winner' : ''}"><span>${esc(id ? name(t, id) : m.bye ? 'Bye' : 'To be determined')}</span><strong>${m.scores ? m.scores[i] : '—'}</strong></div>`).join('')}</button>`;
}
function bracket(t) {
  if (t.status === 'draft') return `<div class="empty bracket-empty"><span>⌘</span><h2>The stage is yours</h2><p>Upload your teams from Excel, arrange the seeds, and generate your bracket.</p><button class="button primary" data-action="excel">Upload Excel →</button></div>`;
  return `<div class="bracket-toolbar"><span><span class="live-dot"></span> ${t.matches.filter(m => m.done && !m.bye).length} / ${t.matches.filter(m => !m.bye).length} matches complete</span><span>Click a ready match to report its score</span></div>${[...new Set(t.matches.map(m => m.group))].map(group => `<div class="bracket-group"><h2>${esc(group)} bracket</h2><div class="bracket-rounds">${[...new Set(t.matches.filter(m => m.group === group).map(m => m.round))].map(r => `<div class="round"><h3>${group === 'Finals' ? r === 1 ? 'Grand final' : 'Bracket reset final' : `Round ${r}`}</h3><div class="round-matches">${t.matches.filter(m => m.group === group && m.round === r).map(m => matchCard(t, m)).join('')}</div></div>`).join('')}</div></div>`).join('')}`;
}
function matches(t) { return `<div class="content-heading"><div><h2>Match center</h2><p>Results lock after submission to protect dependent matches. Reset to start over.</p></div></div><div class="match-grid">${t.matches.map(m => matchCard(t, m)).join('') || '<p class="muted">Start the tournament to generate matches.</p>'}</div>`; }
function render() { $('#nav-count').textContent = tournaments.length; $('#breadcrumb').innerHTML = `Bracket builder <span>/</span> ${selected ? 'Edit bracket' : 'My brackets'}`; selected ? detail() : dashboard(); }
function download(content, type, filename) { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
const filename = t => t.name.replace(/[^a-z0-9_-]/gi, '-').slice(0, 80) || 'tournament';
function svgExport(t) {
  const columns = [...new Set(t.matches.map(m => `${m.group}|${m.round}`))];
  const width = Math.max(900, columns.length * 280 + 80), height = Math.max(400, Math.max(0, ...columns.map(c => t.matches.filter(m => `${m.group}|${m.round}` === c).length)) * 120 + 170);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#101216"/><g font-family="Arial,sans-serif" fill="#f2f3f7"><text x="40" y="50" font-size="26" font-weight="bold">${esc(t.name)}</text><text x="40" y="80" font-size="14" fill="#a4a7b6">${esc(formats[t.format])} · ${t.participants.length} participants · Arena</text>`;
  columns.forEach((c, i) => {
    const x = 40 + i * 280;
    svg += `<text x="${x}" y="120" font-size="14" fill="#ae97ff">${esc(c.replace('|', ' · Round '))}</text>`;
    t.matches.filter(m => `${m.group}|${m.round}` === c).forEach((m, j) => {
      const y = 140 + j * 120;
      svg += `<rect x="${x}" y="${y}" width="250" height="100" rx="8" fill="#1b1e25" stroke="#343744"/><text x="${x + 12}" y="${y + 20}" font-size="10" fill="#a4a7b6">${m.id} · ${m.bye ? 'BYE' : m.done ? 'FINAL' : 'UPCOMING'}</text>`;
      [m.a, m.b].forEach((id, k) => { const label = id ? name(t, id) : m.bye ? 'Bye' : 'To be determined'; svg += `<text x="${x + 12}" y="${y + 47 + k * 31}" font-size="13" fill="${m.winner && m.winner === id ? '#bba5ff' : '#f2f3f7'}">${esc(label.length > 25 ? label.slice(0, 24) + '…' : label)}</text><text x="${x + 233}" y="${y + 47 + k * 31}" text-anchor="end" font-size="13">${m.scores?.[k] ?? '—'}</text>`; });
    });
  });
  return { text: svg + '</g></svg>', width, height };
}
async function exportImage(t, png) {
  if (!t.matches.length) return toast('Start your tournament before exporting a bracket image.');
  const svg = svgExport(t);
  if (!png) return download(svg.text, 'image/svg+xml', `${filename(t)}-bracket.svg`);
  const scale = Math.min(2, 12000 / Math.max(svg.width, svg.height));
  const image = new Image(); const url = URL.createObjectURL(new Blob([svg.text], { type: 'image/svg+xml' }));
  try { await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; }); const canvas = document.createElement('canvas'); canvas.width = svg.width * scale; canvas.height = svg.height * scale; canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); const blob = await new Promise(r => canvas.toBlob(r)); if (!blob) throw Error(); download(blob, 'image/png', `${filename(t)}-bracket.png`); } catch { toast('PNG export failed. Try the SVG export instead.'); } finally { URL.revokeObjectURL(url); }
}
const actions = {
  excel: () => { excelTarget = selected; $('#excel-input').click(); },
  template: async () => { try { const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Teams'); sheet.addRow(['Team name']); ['Team Eclipse', 'Neon Knights', 'Team Orbit', 'Wildcard', 'Night Owls', 'Cloud Nine', 'Pixel Pirates', 'After Hours'].forEach(n => sheet.addRow([n])); sheet.getColumn(1).width = 28; sheet.getRow(1).font = { bold: true }; download(await workbook.xlsx.writeBuffer(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'arena-teams-template.xlsx'); } catch { toast('Could not create the template. Reload and try again.'); } },
  create: () => editor(), back: () => { selected = null; render(); }, settings: () => editor(current()),
  add: () => modal('Add participants', '<label>Player or team names<textarea name="names" rows="8" required placeholder="One participant per line\nAlex\nTeam Eclipse\nJordan"></textarea></label><p class="hint">Up to 128 participants per tournament. Names must be unique.</p>', 'Add participants', data => { const t = current(); const names = data.get('names').split('\n').map(v => v.trim()).filter(Boolean); if (!names.length) throw Error('Enter at least one name.'); if (t.participants.length + names.length > 128) throw Error('The maximum is 128 participants.'); const all = [...t.participants.map(p => p.name), ...names].map(n => n.toLowerCase()); if (new Set(all).size !== all.length) throw Error('Participant names must be unique.'); if (names.some(n => n.length > 80)) throw Error('Names must be 80 characters or fewer.'); t.participants.push(...names.map(name => ({ id: crypto.randomUUID(), name, checked: false }))); save(); }),
  shuffle: () => { const p = current().participants; for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } save(); },
  start: () => { const t = current(); if (t.participants.length < 2) return toast('Add at least two teams first.'); start(t); tab = 'bracket'; save(); },
  reset: () => { if (confirm('Clear all match results and return this tournament to draft? Participants will be kept.')) { current().status = 'draft'; current().matches = []; save(); } },
  swiss: () => { nextSwiss(current()); save(); },
  csv: () => { const t = current(); const cell = v => `"${String(v).replace(/^[=+\-@\t\r]/, "'$&").replaceAll('"', '""')}"`; download([['Rank','Name','Played','Wins','Losses','Draws','Difference','Points'], ...standings(t).map((p,i) => [i+1,p.name,p.played,p.wins,p.losses,p.draws,p.diff,p.points])].map(r => r.map(cell).join(',')).join('\r\n'), 'text/csv', `${filename(t)}-standings.csv`); },
  export: () => modal('Export tournament', '<label>Export format<select name="type"><option value="png">Bracket image (.png)</option><option value="svg">Vector bracket (.svg)</option><option value="print">Print / Save as PDF</option><option value="json">Tournament backup (.json)</option><option value="csv">Standings spreadsheet (.csv)</option></select></label><p class="hint">Images include every round and current result. JSON backups can be imported into another browser.</p>', 'Export', data => { const t = current(), type = data.get('type'); if (type === 'png' || type === 'svg') exportImage(t, type === 'png'); if (type === 'json') download(JSON.stringify({ version: 1, tournaments: [t] }, null, 2), 'application/json', `${filename(t)}.json`); if (type === 'csv') actions.csv(); if (type === 'print') { tab = 'bracket'; render(); setTimeout(() => window.print(), 100); } }),
  demo: () => { const t = createTournament({ name: 'Friday Night Finals', game: 'Valorant', format: 'double', description: 'A sample competition. Explore the bracket, report scores, and export the results.' }); t.participants = ['Team Eclipse','Neon Knights','After Hours','Pixel Pirates','Cloud Nine','Night Owls','Team Orbit','Wildcard'].map(name => ({ id: crypto.randomUUID(), name, checked: true })); start(t); tournaments.unshift(t); selected = t.id; tab = 'bracket'; save(); }
};
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  try {
    if (b.dataset.delete) {
      const bracket = tournaments.find(t => t.id === b.dataset.delete);
      if (!bracket) return;
      modal('Delete bracket?', `<p>Delete <strong>${esc(bracket.name)}</strong> and all its teams and results? ${drive.linked(bracket.id) ? 'Its saved Google Drive file will also move to Trash. Connect to its Google account first.' : 'This removes the local bracket.'}</p>`, 'Delete bracket', async () => {
        if (driveBusy) throw Error('Wait for the current Drive operation to finish.');
        driveBusy = true;
        try { await drive.deleteLinked(bracket.id); } finally { driveBusy = false; }
        tournaments = tournaments.filter(t => t.id !== bracket.id);
        if (selected === bracket.id) selected = null;
        save(); toast('Bracket deleted.');
      });
      return;
    }
    if (b.dataset.action) actions[b.dataset.action]?.();
    if (b.dataset.open) { selected = b.dataset.open; tab = 'bracket'; render(); }
    if (b.dataset.filter) { filter = b.dataset.filter; dashboard(); }
    if (b.dataset.tab) { tab = b.dataset.tab; detail(); }
    const t = current(); if (!t) return;
    if (b.dataset.check) { const p = t.participants.find(p => p.id === b.dataset.check); p.checked = !p.checked; save(); }
    if (b.dataset.remove && t.status === 'draft') { t.participants = t.participants.filter(p => p.id !== b.dataset.remove); save(); }
    if (b.dataset.up && t.status === 'draft') { const i = t.participants.findIndex(p => p.id === b.dataset.up); if (i > 0) [t.participants[i],t.participants[i-1]] = [t.participants[i-1],t.participants[i]]; save(); }
    if (b.dataset.score) { const m = t.matches.find(m => m.id === b.dataset.score); modal('Report score', `<p class="hint">${m.id} · ${esc(m.group)} · Round ${m.round}</p><div class="form-grid">${[m.a,m.b].map((id,i) => `<label>${esc(name(t,id))}<input name="score${i}" type="number" required min="0" max="99999" step="1" value="0"></label>`).join('')}</div><p class="hint">Submitting advances the bracket. Results are locked after submission.</p>`, 'Confirm result', data => { report(t,m.id,Number(data.get('score0')),Number(data.get('score1'))); save(); }); }
  } catch(error) { toast(error.message); }
});
function renderDrive() {
  let clientId = googleClientId;
  try { clientId = localStorage.getItem('arena-google-client-id') || googleClientId; } catch {}
  $('#drive-dialog').innerHTML = `<div class="modal-heading"><h2 id="drive-title">Google Drive</h2><button class="icon-button" data-cloud="close" aria-label="Close Google Drive">×</button></div><p class="hint">Keep bracket data in your private <strong>Arena Brackets</strong> folder. Changes are saved locally as you edit. Use <strong>Save to Drive</strong> when you want to upload them.</p>
  ${drive.connected ? `<div class="drive-connected"><span class="live-dot"></span> Connected to Google Drive <button class="text-button" data-cloud="disconnect">Disconnect</button></div><label>Local bracket to save<select id="drive-bracket">${tournaments.map(t => `<option value="${t.id}" ${t.id === selected ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label><button class="button primary" data-cloud="save" ${!tournaments.length ? 'disabled' : ''}>Save to Drive</button><div class="content-heading drive-heading"><h3>Saved in Drive</h3><button class="button secondary small" data-cloud="refresh">Refresh</button></div><div class="drive-list">${driveFiles.length ? driveFiles.map(file => `<div class="drive-file"><div><strong>${esc(file.name.replace(/\.json$/, ''))}</strong><small>${esc(new Date(file.modifiedTime).toLocaleString())}</small></div><div class="actions"><button class="button secondary small" data-cloud="load" data-file="${esc(file.id)}">Load</button><button class="button secondary small" data-cloud="trash" data-file="${esc(file.id)}">Delete</button></div></div>`).join('') : '<p class="hint">No saved brackets yet. Choose a local bracket above and save it.</p>'}</div>` : `<label>Google OAuth client ID<input id="google-client-id" placeholder="123456789-example.apps.googleusercontent.com" value="${esc(clientId)}" autocomplete="off"></label><p class="hint">Use a Web application client with this authorized JavaScript origin: <code>${esc(location.origin)}</code>. See <a href="./SETUP.md" target="_blank" rel="noopener">setup instructions ↗</a>.</p><button class="button primary" data-cloud="connect">Connect Google Drive</button>`}
  <p id="drive-status" class="hint" role="status">${driveBusy ? 'Working…' : 'Drive saves are manual. Load the latest copy when switching devices.'}</p>`;
  $('#drive-dialog').querySelectorAll('button').forEach(b => { if (driveBusy) b.disabled = true; });
}
$('#drive-open').onclick = () => { renderDrive(); $('#drive-dialog').showModal(); };
$('#drive-dialog').addEventListener('cancel', e => { if (driveBusy) e.preventDefault(); });
$('#drive-dialog').onclick = async e => {
  const button = e.target.closest('[data-cloud]'); if (!button || driveBusy) return;
  const action = button.dataset.cloud;
  if (action === 'close') return $('#drive-dialog').close();
  if (action === 'disconnect') { drive.disconnect(); driveFiles = []; renderDrive(); return; }
  const clientId = $('#google-client-id')?.value.trim();
  const bracketId = $('#drive-bracket')?.value;
  const remote = driveFiles.find(f => f.id === button.dataset.file);
  if (action === 'load' && tournaments.some(t => t.id === remote?.appProperties?.bracketId) && !confirm('Replace this local bracket with the saved Drive copy? Any local changes not saved to Drive will be lost.')) return;
  if (action === 'trash' && !confirm(`Move “${remote?.name.replace(/\.json$/, '')}” to Google Drive Trash and remove its local copy?`)) return;
  driveBusy = true;
  $('#drive-dialog').querySelectorAll('button').forEach(b => b.disabled = true);
  $('#drive-status').textContent = action === 'connect' ? 'Waiting for Google sign-in…' : 'Working…';
  let message;
  try {
    if (action === 'connect') { await drive.connect(clientId); localStorage.setItem('arena-google-client-id',clientId); }
    if (action === 'save') {
      const t = tournaments.find(t => t.id === bracketId); if (!t) throw Error('Choose a local bracket first.');
      await drive.save(structuredClone(t)); message = 'Bracket saved to Google Drive.';
    }
    if (action === 'load') {
      if (!remote) throw Error('Refresh the saved bracket list.');
      const t = await drive.load(remote.id); const i = tournaments.findIndex(old => old.id === t.id);
      if (i >= 0) tournaments[i] = t; else tournaments.unshift(t);
      selected = t.id; tab = 'bracket'; save(); message = 'Bracket loaded from Google Drive.';
    }
    if (action === 'trash') {
      if (!remote) throw Error('Refresh the saved bracket list.');
      await drive.trash(remote.id,remote.appProperties.bracketId,remote.modifiedTime);
      tournaments = tournaments.filter(t => t.id !== remote.appProperties.bracketId);
      if (selected === remote.appProperties.bracketId) selected = null;
      save(); message = 'Bracket moved to Google Drive Trash.';
    }
    driveFiles = await drive.list();
    if (message) toast(message);
  } catch (error) { message = error.message; toast(message); }
  finally { driveBusy = false; renderDrive(); if (message) $('#drive-status').textContent = message; }
};
$('#home').onclick = () => actions.back();
$('#backup').onclick = () => download(JSON.stringify({ version: 1, tournaments }, null, 2), 'application/json', 'arena-workspace.json');
$('#restore').onclick = () => $('#file-input').click();
$('#file-input').onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    if (file.size > 10_000_000) throw Error('Backup files must be smaller than 10 MB.');
    const data = JSON.parse(await file.text());
    validateBackup(data);
    if (!confirm(`Import ${data.tournaments.length} tournament(s)? Matching tournaments will be replaced.`)) return;
    for (const t of data.tournaments) { const i = tournaments.findIndex(old => old.id === t.id); if (i >= 0) tournaments[i] = t; else tournaments.push(t); }
    selected = null; save(); toast('Backup imported successfully.');
  } catch(error) { toast(error.message || 'Could not import backup.'); } finally { e.target.value = ''; }
};
async function importExcel(file) {
  try {
    if (!/\.xlsx$/i.test(file.name)) throw Error('Please choose an .xlsx Excel workbook. Save older .xls files as .xlsx first.');
    if (file.size > 5_000_000) throw Error('Choose an Excel file smaller than 5 MB.');
    toast('Reading your teams…');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheets = workbook.worksheets.filter(s => s.rowCount > 0);
    if (!sheets.length) throw Error('This workbook has no populated sheets.');
    const target = tournaments.find(t => t.id === excelTarget);
    if (target && target.status !== 'draft') throw Error('Reset the bracket before changing teams.');
    let rows = [], names = [];
    modal('Import teams from Excel', `<p class="hint">${esc(file.name)} · Select the column that contains your team names.</p>${!target ? `<label>Bracket name<input name="name" required maxlength="100" value="${esc(file.name.replace(/\.xlsx$/i, ''))}"></label><label>Bracket format<select name="format">${Object.entries(formats).map(([v, label]) => `<option value="${v}">${label}</option>`).join('')}</select></label>` : ''}<div class="form-grid"><label>Worksheet<select name="sheet" id="import-sheet">${sheets.map((s,i) => `<option value="${i}">${esc(s.name)}</option>`).join('')}</select></label><label>Team name column<select name="column" id="import-column"></select></label></div><label class="checkbox-label"><input type="checkbox" id="import-header" name="header" checked> First populated row is a header</label>${target?.participants.length ? '<label>Existing teams<select name="mode" id="import-mode"><option value="replace">Replace existing teams</option><option value="append">Add to existing teams</option></select></label>' : ''}<div id="import-preview" class="import-preview" aria-live="polite"></div>`, target ? 'Import teams' : 'Build bracket →', data => {
      const existing = data.get('mode') === 'append' ? target.participants.map(p => p.name) : [];
      names = extractTeams(rows, Number(data.get('column')), data.has('header'), existing);
      if (!target && names.length < 2) throw Error('At least two teams are needed to build a bracket.');
      const title = String(data.get('name') || '').trim();
      if (!target && !title) throw Error('Enter a bracket name.');
      const t = target || createTournament({ name: title, format: data.get('format') });
      const additions = names.map(name => ({ id: crypto.randomUUID(), name, checked: false }));
      t.participants = data.get('mode') === 'append' ? [...t.participants, ...additions] : additions;
      if (!target) { start(t); tournaments.unshift(t); }
      selected = t.id; tab = target ? 'participants' : 'bracket'; save(); toast(`${names.length} teams imported.`);
    });
    const preview = () => {
      try {
        const existing = $('#import-mode')?.value === 'append' ? target.participants.map(p => p.name) : [];
        names = extractTeams(rows, Number($('#import-column').value), $('#import-header').checked, existing);
        $('#import-preview').innerHTML = `<strong>${names.length} teams found</strong><ol>${names.slice(0, 6).map(n => `<li>${esc(n)}</li>`).join('')}</ol>${names.length > 6 ? `<small>and ${names.length - 6} more…</small>` : ''}<small>Blank cells are skipped. File order determines seeding.</small>`;
      } catch (error) { $('#import-preview').textContent = error.message; }
    };
    const updateSheet = () => {
      const sheet = sheets[Number($('#import-sheet').value)];
      if (sheet.rowCount > 10000 || sheet.columnCount > 200) { rows = []; $('#import-column').innerHTML = ''; $('#import-preview').textContent = 'This sheet is too large. Use a team list with up to 10,000 rows and 200 columns.'; return; }
      rows = []; sheet.eachRow(row => { const values = []; row.eachCell((cell,col) => { values[col - 1] = cellText(cell.value); }); if (values.some(Boolean)) rows.push(values); });
      const columns = Array.from({ length: sheet.columnCount }, (_,i) => i).filter(i => rows.some(r => r[i]));
      $('#import-column').innerHTML = columns.map(i => `<option value="${i}">Column ${sheet.getColumn(i + 1).letter} — ${esc((rows[0]?.[i] || 'Unnamed').slice(0, 40))}</option>`).join('');
      const likely = columns.find(i => /^(team(\s*name)?s?|participants?|players?|name)$/i.test(rows[0]?.[i] || ''));
      if (likely !== undefined) $('#import-column').value = String(likely);
      $('#import-header').checked = likely !== undefined;
      preview();
    };
    $('#import-sheet').onchange = updateSheet; $('#import-column').onchange = preview; $('#import-header').onchange = preview; if ($('#import-mode')) $('#import-mode').onchange = preview;
    updateSheet();
  } catch(error) { toast(error.message || 'Could not read this Excel file.'); }
}
$('#excel-input').onchange = e => { const file = e.target.files[0]; e.target.value = ''; if (file) importExcel(file); };
render();
