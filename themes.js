export const themes = {
  red: { name:'Red & black', accent:'#ff4655', highlight:'#ffa1a9', background:'#0b0b0e', panel:'#19171c', soft:'#321b23', border:'#62303b' },
  purple: { name:'Purple', accent:'#b298ff', highlight:'#d4c1ff', background:'#101016', panel:'#1b1923', soft:'#2d243e', border:'#58416f' },
  blue: { name:'Electric blue', accent:'#5ba8ff', highlight:'#a7cfff', background:'#0a1018', panel:'#151e2b', soft:'#1b304b', border:'#2a527a' },
  green: { name:'Emerald', accent:'#49d5a0', highlight:'#9aefd0', background:'#091310', panel:'#14221c', soft:'#193a2d', border:'#286348' },
  orange: { name:'Sunset orange', accent:'#ff9857', highlight:'#ffca9e', background:'#15100c', panel:'#241c17', soft:'#402b1d', border:'#785034' },
  gold: { name:'Championship gold', accent:'#ebc45e', highlight:'#ffe2a0', background:'#12110d', panel:'#222019', soft:'#38311c', border:'#706036' },
  mono: { name:'Black & white', accent:'#e2e5ec', highlight:'#ffffff', background:'#090a0c', panel:'#191b20', soft:'#30333a', border:'#626772' }
};
export const validLogo = logo => typeof logo === 'string' && logo.length <= 400000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(logo);
export function appearance(t) {
  const value = t?.appearance || {};
  return { theme:Object.hasOwn(themes,value.theme) ? value.theme : 'red', leagueName:typeof value.leagueName === 'string' ? value.leagueName.slice(0,80) : '', logo:validLogo(value.logo) ? value.logo : '' };
}
export function themeStyle(id) {
  const t = Object.hasOwn(themes,id) ? themes[id] : themes.red;
  return `--accent:${t.accent};--highlight:${t.highlight};--bg:${t.background};--panel:${t.panel};--theme-soft:${t.soft};--theme-border:${t.border}`;
}
export function applyTheme(id, element = document.documentElement) {
  const t = Object.hasOwn(themes,id) ? themes[id] : themes.red;
  for (const [key,value] of Object.entries({accent:t.accent,highlight:t.highlight,bg:t.background,panel:t.panel,'theme-soft':t.soft,'theme-border':t.border})) element.style.setProperty(`--${key}`,value);
  element.dataset.theme = Object.hasOwn(themes,id) ? id : 'red';
}
