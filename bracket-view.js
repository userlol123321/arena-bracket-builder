import { formats } from './engine.js';
import { appearance, themes } from './themes.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function bracketArtwork(t,transparent = false) {
  const branding = appearance(t), palette = themes[branding.theme];
  const branded = Boolean(branding.logo || branding.leagueName);
  const headerHeight = branded ? 170 : 105;
  const groups = [...new Set(t.matches.map(m => m.group))];
  const layouts = groups.map(group => {
    const rounds = [...new Set(t.matches.filter(m => m.group === group).map(m => m.round))];
    return {group,rounds,height:Math.max(...rounds.map(r => t.matches.filter(m => m.group === group && m.round === r).length)) * 112 + 90};
  });
  const width = Math.max(800,...layouts.map(g => g.rounds.length * 285 + 50));
  const height = Math.max(300,headerHeight + 35 + layouts.reduce((sum,g) => sum + g.height,0));
  const short = (value,n) => value.length > n ? value.slice(0,n-1)+'…' : value;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(t.name)} bracket"><g font-family="Arial,sans-serif" fill="#f2f3f7">${transparent ? '' : `<rect width="${width}" height="${height}" rx="12" fill="${palette.background}"/>`}<rect x="24" y="12" width="52" height="4" rx="2" fill="${palette.accent}"/>`;
  if (branded) svg += `${branding.logo ? `<image href="${branding.logo}" x="24" y="26" width="64" height="64" preserveAspectRatio="xMidYMid meet"/>` : ''}<text x="${branding.logo ? 104 : 24}" y="57" font-size="20" font-weight="bold" fill="${palette.highlight}">${esc(short(branding.leagueName,Math.floor((width-130)/12)))}</text>`;
  svg += `<text x="24" y="${branded ? 116 : 48}" font-size="28" font-weight="bold">${esc(short(t.name,Math.floor((width-48)/17)))}</text><text x="24" y="${branded ? 143 : 78}" font-size="13" fill="${palette.highlight}">${esc(formats[t.format])} · ${t.participants.length} teams · ${t.status === 'complete' ? 'COMPLETE' : 'LIVE BRACKET'}</text>`;
  if (!t.matches.length) svg += `<text x="24" y="${headerHeight+50}" font-size="20">Waiting for the bracket to be generated…</text>`;
  const positions = new Map(); let top = headerHeight;
  for (const layout of layouts) {
    svg += `<text x="24" y="${top}" font-size="17" fill="${palette.highlight}">${esc(layout.group)}</text>`;
    layout.rounds.forEach((round,i) => {
      const x = 24 + i * 285;
      svg += `<text x="${x}" y="${top + 25}" font-size="11" fill="#a8a4b5">${layout.group === 'Finals' ? round === 1 ? 'GRAND FINAL' : 'RESET FINAL' : `ROUND ${round}`}</text>`;
      const matches = t.matches.filter(m => m.group === layout.group && m.round === round);
      matches.forEach((m,j) => positions.set(m.id,{x,y:top+40+j*(layout.height-70)/matches.length+((layout.height-70)/matches.length-92)/2}));
    });
    top += layout.height;
  }
  // Connect same-bracket advancing paths; cross-bracket drops use match IDs.
  for (const m of t.matches) {
    const p = positions.get(m.id);
    for (const [source,field] of m.sources || []) {
      const parent = t.matches.find(other => other.id === source), q = positions.get(source);
      if (q && parent.group === m.group && q.x < p.x && field === 'winner') svg += `<path d="M${q.x+250},${q.y+46} H${p.x-18} V${p.y+46} H${p.x}" fill="none" stroke="${palette.border}" stroke-width="2"/>`;
    }
  }
  for (const m of t.matches) {
    const {x,y} = positions.get(m.id);
    svg += `<g data-match="${esc(m.id)}"><rect x="${x}" y="${y}" width="250" height="92" rx="7" fill="${palette.panel}" stroke="${palette.border}"/><text x="${x+10}" y="${y+16}" font-size="9" fill="#a9a1b7">${esc(m.id)} · ${m.bye ? 'BYE' : m.done ? 'FINAL' : m.scores ? 'LIVE' : 'UPCOMING'}</text>`;
    [m.a,m.b].forEach((id,i) => {
      const label = id ? t.participants.find(p => p.id === id)?.name || 'Unknown' : m.bye ? 'Bye' : 'To be determined';
      const color = id && m.winner === id ? palette.highlight : '#eeeef3';
      svg += `<text x="${x+10}" y="${y+43+i*30}" font-size="13" fill="${color}">${esc(label.length>26 ? label.slice(0,25)+'…' : label)}</text><text x="${x+237}" y="${y+43+i*30}" font-size="14" text-anchor="end" fill="${color}">${m.scores?.[i] ?? '—'}</text>`;
    });
    svg += '</g>';
  }
  return {text:svg + '</g></svg>',width,height};
}
export function bracketSvg(t,transparent = false) { return bracketArtwork(t,transparent).text; }
