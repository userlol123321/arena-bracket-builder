export class LocalStreams {
  constructor() {
    this.local = ['localhost','127.0.0.1','[::1]'].includes(location.hostname);
    this.links = new Map(); this.queue = Promise.resolve(); this.key = null;
  }
  linked(id) { return this.links.get(id); }
  exclusive(work) { const task = this.queue.then(work); this.queue = task.catch(() => {}); return task; }
  async request(path = '', options = {}) {
    if (!this.local) throw Error('Run npm start and use localhost for live OBS links.');
    if (!this.key) {
      this.key = localStorage.getItem('arena-local-editor');
      if (!this.key) { this.key = crypto.randomUUID() + crypto.randomUUID(); localStorage.setItem('arena-local-editor',this.key); }
    }
    let response;
    try { response = await fetch(`./local/streams${path}`,{...options,headers:{'Content-Type':'application/json',Authorization:`Bearer ${this.key}`},cache:'no-store',signal:AbortSignal.timeout(5000)}); }
    catch { throw Error('Local server unavailable. Keep npm start running. Live updates will retry automatically.'); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = Error(data.error || 'Could not update the local OBS stream.'); error.status = response.status; throw error; }
    return data;
  }
  refresh() { return this.exclusive(async () => { const data = await this.request(); this.links = new Map(data.streams.map(link => [link.bracketId,link])); }); }
  start(bracket) { return this.exclusive(async () => { const link = await this.request('',{method:'POST',body:JSON.stringify({bracket})}); this.links.set(bracket.id,link); return link; }); }
  update(bracket) { return this.exclusive(async () => {
    const link = this.linked(bracket.id); if (!link) return;
    try { await this.request(`/${link.token}`,{method:'PUT',body:JSON.stringify({bracket})}); }
    catch(error) { if (error.status === 404) { this.links.delete(bracket.id); throw Error('OBS link expired after a server restart. Create a new live link.'); } throw error; }
  }); }
  stop(id) { return this.exclusive(async () => {
    if (!this.local) return;
    // Find streams even if deletion happens immediately after loading the editor.
    const data = await this.request(); this.links = new Map(data.streams.map(link => [link.bracketId,link]));
    const link = this.linked(id); if (!link) return;
    await this.request(`/${link.token}`,{method:'DELETE'}); this.links.delete(id);
  }); }
  url(id,transparent = false) { const url = new URL('./viewer.html',location.href); url.hash = new URLSearchParams({stream:this.linked(id).token,...(transparent ? {transparent:'1'} : {})}).toString(); return url.href; }
}
