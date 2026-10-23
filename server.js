import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { validateBackup } from './backup.js';

const files = ['app.js','engine.js','teams.js','backup.js','local-streams.js','viewer.js','viewer.html','viewer.css','bracket-view.js','themes.js','themes.css','style.css','SETUP.md'];
const assets = Object.fromEntries(files.map(file => [`/${file}`,file]));
assets['/'] = 'index.html'; assets['/exceljs.min.js'] = 'node_modules/exceljs/dist/exceljs.min.js';
const contentType = file => file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'text/plain';

export function createArenaServer() {
  // Temporary snapshots live only in memory. Restarting invalidates every old link.
  const streams = new Map();
  const json = (res,status,data) => { res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(JSON.stringify(data)); };
  return http.createServer(async (req,res) => {
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.host || '')) return json(res,403,{error:'Local requests only.'});
    const url = new URL(req.url,`http://${req.headers.host}`);
    try {
      if (url.pathname.startsWith('/local/')) {
        if ((req.headers.origin && req.headers.origin !== url.origin) || req.headers['sec-fetch-site'] === 'cross-site') return json(res,403,{error:'Open the editor on this computer.'});
        const owner = req.headers.authorization?.match(/^Bearer ([a-zA-Z0-9-]{64,128})$/)?.[1];
        if (!owner) return json(res,401,{error:'The read-only link cannot edit brackets.'});
        const token = url.pathname.match(/^\/local\/streams\/([a-f0-9]{48})$/)?.[1];
        const collection = url.pathname === '/local/streams';
        if (!collection && !token) return json(res,404,{error:'Not found.'});
        const stream = token && streams.get(token);
        if (token && (!stream || stream.owner !== owner)) return json(res,404,{error:'This live link has ended. Create a new one.'});
        if (collection && req.method === 'GET') return json(res,200,{streams:[...streams.entries()].filter(([,s]) => s.owner === owner).map(([token,s]) => ({token,bracketId:s.bracket.id}))});
        if (token && req.method === 'DELETE') { streams.delete(token); return json(res,200,{stopped:true}); }
        if ((collection && req.method === 'POST') || (token && req.method === 'PUT')) {
          if (!req.headers['content-type']?.startsWith('application/json')) return json(res,415,{error:'JSON required.'});
          let size = 0; const chunks = [];
          for await (const chunk of req) { size += chunk.length; if (size > 10_000_000) return json(res,413,{error:'Bracket is too large.'}); chunks.push(chunk); }
          let bracket;
          try { ({bracket} = JSON.parse(Buffer.concat(chunks).toString())); validateBackup({version:1,tournaments:[bracket]}); } catch { return json(res,400,{error:'Invalid bracket data.'}); }
          if (stream && bracket.id !== stream.bracket.id) return json(res,400,{error:'Bracket ID mismatch.'});
          let id = token || [...streams.entries()].find(([,s]) => s.owner === owner && s.bracket.id === bracket.id)?.[0];
          if (!id && streams.size >= 256) return json(res,429,{error:'Stop an existing live link before creating another.'});
          id ||= randomBytes(24).toString('hex');
          const revision = (streams.get(id)?.revision || 0) + 1;
          streams.set(id,{owner,bracket,revision,updatedAt:new Date().toISOString()});
          return json(res,200,{token:id,bracketId:bracket.id});
        }
        return json(res,405,{error:'Method not allowed.'});
      }
      if (url.pathname.startsWith('/live/')) {
        if (req.method !== 'GET') return json(res,405,{error:'This is a read-only bracket view.'});
        const token = url.pathname.match(/^\/live\/([a-f0-9]{48})$/)?.[1];
        const stream = streams.get(token);
        if (!stream) return json(res,404,{error:'This live link has ended.'});
        const {bracket,revision,updatedAt} = stream;
        return json(res,200,{bracket,revision,updatedAt});
      }
      const asset = assets[url.pathname];
      if (!asset || !['GET','HEAD'].includes(req.method)) { res.writeHead(404); res.end('Not found'); return; }
      const body = await readFile(new URL(asset,import.meta.url));
      res.writeHead(200,{'Content-Type':`${contentType(asset)}; charset=utf-8`,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { if (!res.headersSent) json(res,500,{error:'The local server could not complete this request.'}); else res.end(); }
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const port = Number(process.env.PORT || 3000);
  createArenaServer().listen(port,'127.0.0.1',() => console.log(`Arena is running at http://localhost:${port}`));
}
