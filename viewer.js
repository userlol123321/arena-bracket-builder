import { bracketSvg } from './bracket-view.js';
import { validateBackup } from './backup.js';
import { themes, appearance } from './themes.js';
window.addEventListener('hashchange',() => location.reload());
const params = new URLSearchParams(location.hash.slice(1)), token = params.get('stream');
const canvas = document.querySelector('#canvas'), message = document.querySelector('#viewer-message');
const transparent = params.get('transparent') === '1';
document.body.classList.toggle('transparent',transparent);
let revision = null, ended = false;
function status(text) { message.textContent = text; message.hidden = false; }
async function poll() {
  try {
    const response = await fetch(`./live/${token}`,{cache:'no-store',signal:AbortSignal.timeout(4000)});
    if (response.status === 404) { ended = true; canvas.replaceChildren(); status('This live link has ended.'); return; }
    if (!response.ok) throw Error();
    const data = await response.json(); validateBackup({version:1,tournaments:[data.bracket]});
    if (data.revision !== revision) {
      canvas.innerHTML = bracketSvg(data.bracket,transparent); document.title = `${data.bracket.name} — Live bracket`; revision = data.revision;
      const background = transparent ? 'transparent' : themes[appearance(data.bracket).theme].background;
      document.body.style.background = background; document.documentElement.style.background = background;
    }
    message.hidden = true;
  } catch { status('Connection lost · Showing the last update · Reconnecting…'); }
  finally { if (!ended) setTimeout(poll,1000); }
}
if (!/^[a-f0-9]{48}$/.test(token || '')) status('This live link is invalid. Create a new link in the bracket editor.');
else poll();
