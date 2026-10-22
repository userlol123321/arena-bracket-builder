import http from 'node:http';
import { readFile } from 'node:fs/promises';
const assets = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/engine.js': ['engine.js', 'text/javascript'], '/teams.js': ['teams.js', 'text/javascript'], '/drive.js': ['drive.js', 'text/javascript'], '/backup.js': ['backup.js', 'text/javascript'], '/config.js': ['config.js', 'text/javascript'], '/SETUP.md': ['SETUP.md', 'text/plain'], '/exceljs.min.js': ['node_modules/exceljs/dist/exceljs.min.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
const port = Number(process.env.PORT || 3000);
http.createServer(async (req, res) => {
  const asset = assets[new URL(req.url, 'http://localhost').pathname];
  if (!asset) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const body = await readFile(new URL(asset[0], import.meta.url));
    res.writeHead(200, { 'Content-Type': `${asset[1]}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff' });
    res.end(body);
  } catch { res.writeHead(500); res.end('Unable to load application'); }
}).listen(port, '127.0.0.1', () => console.log(`Arena is running at http://localhost:${port}`));
