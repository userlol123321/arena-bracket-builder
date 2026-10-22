import { validateBackup } from './backup.js';
const APP = 'arena-bracket-v1';
const FIELDS = 'id,name,modifiedTime,appProperties,parents,trashed,size';
export class DriveStorage {
  constructor({ storage = localStorage, fetcher = (...args) => fetch(...args) } = {}) {
    this.storage = storage; this.fetcher = fetcher; this.token = null; this.expires = 0; this.folder = null; this.busy = false;
    try { this.links = JSON.parse(storage.getItem('arena-drive-links') || '{}'); } catch { this.links = {}; }
    if (!this.links || Array.isArray(this.links) || typeof this.links !== 'object') this.links = {};
  }
  get connected() { return Boolean(this.token && Date.now() < this.expires && this.folder); }
  linked(id) { return Object.hasOwn(this.links, id) ? this.links[id] : null; }
  remember(id, file) {
    const links = { ...this.links, [id]: { fileId: file.id, modifiedTime: file.modifiedTime, folder: this.folder } };
    // Persist linkage before mutating memory, so an unavailable local store is visible.
    this.storage.setItem('arena-drive-links', JSON.stringify(links)); this.links = links;
  }
  forget(id) { const links = { ...this.links }; delete links[id]; this.storage.setItem('arena-drive-links', JSON.stringify(links)); this.links = links; }
  disconnect() { this.token = null; this.expires = 0; this.folder = null; }
  async connect(clientId) {
    if (!clientId?.endsWith('.apps.googleusercontent.com')) throw Error('Enter your Google OAuth browser client ID first.');
    if (!globalThis.google?.accounts?.oauth2) throw Error('Google sign-in has not loaded. Check your connection and try again.');
    const result = await new Promise((resolve,reject) => {
      const client = google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: 'https://www.googleapis.com/auth/drive.file', callback: result => result.error ? reject(Error(result.error_description || result.error)) : resolve(result), error_callback: error => reject(Error(error.type === 'popup_closed' ? 'Sign-in was cancelled.' : 'Allow the Google sign-in popup and try again.')) });
      client.requestAccessToken({ prompt: 'select_account' });
    });
    this.token = result.access_token; this.expires = Date.now() + (Number(result.expires_in) - 60) * 1000;
    try {
      const folders = await this.listAll(`trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='arenaApp' and value='${APP}' }`);
      const folder = folders[0] || await this.request('/files?fields=id', { method:'POST', body:JSON.stringify({ name:'Arena Brackets', mimeType:'application/vnd.google-apps.folder', appProperties:{ arenaApp:APP } }) });
      this.folder = folder.id;
    } catch (error) { this.disconnect(); throw error; }
  }
  async request(path, options = {}, upload = false) {
    if (!this.token || Date.now() >= this.expires) { this.disconnect(); throw Error('Connect to Google Drive to continue. Your local brackets are safe.'); }
    let response;
    try { response = await this.fetcher(`https://www.googleapis.com/${upload ? 'upload/' : ''}drive/v3${path}`, { ...options, headers:{ Authorization:`Bearer ${this.token}`, ...(options.body && !(options.body instanceof FormData) ? {'Content-Type':'application/json'} : {}), ...options.headers } }); }
    catch { throw Error('Google Drive could not be reached. Check your connection and retry.'); }
    if (!response.ok) {
      if (response.status === 401) { this.disconnect(); throw Error('Google sign-in expired. Reconnect and retry.'); }
      if (response.status === 404) throw Error('This Drive file no longer exists or belongs to another Google account.');
      if (response.status === 403) throw Error('Google Drive access was denied. Check API access, permissions, and available storage.');
      if (response.status === 429) throw Error('Google Drive is busy. Wait a moment and retry.');
      throw Error(`Google Drive request failed (${response.status}). Retry before leaving this device.`);
    }
    return response.status === 204 ? null : response.json();
  }
  async listAll(q) {
    let files = [], nextPageToken;
    do {
      const params = new URLSearchParams({ q, fields:`nextPageToken,files(${FIELDS})`, pageSize:'100', orderBy:'createdTime', ...(nextPageToken ? {pageToken:nextPageToken} : {}) });
      const page = await this.request(`/files?${params}`); files.push(...page.files); nextPageToken = page.nextPageToken;
    } while (nextPageToken);
    return files;
  }
  async list() {
    if (!this.connected) throw Error('Connect to Google Drive first.');
    return this.listAll(`trashed = false and '${this.folder}' in parents and appProperties has { key='arenaApp' and value='${APP}' }`);
  }
  async metadata(fileId, bracketId) {
    const file = await this.request(`/files/${encodeURIComponent(fileId)}?fields=${FIELDS}`);
    if (file.trashed || !file.parents?.includes(this.folder) || file.appProperties?.arenaApp !== APP || (bracketId && file.appProperties?.bracketId !== bracketId)) throw Error('This file is not an available bracket in the connected Arena folder.');
    return file;
  }
  async load(fileId) {
    const file = await this.metadata(fileId);
    if (Number(file.size) > 10_000_000) throw Error('This bracket file is too large.');
    const data = await this.request(`/files/${encodeURIComponent(file.id)}?alt=media`);
    const brackets = validateBackup(data);
    if (brackets.length !== 1 || brackets[0].id !== file.appProperties?.bracketId) throw Error('This file is not a valid Arena bracket.');
    // Remember the version we read, rather than a newer version from another device.
    this.remember(brackets[0].id, file);
    return brackets[0];
  }
  async save(bracket) {
    validateBackup({ version:1, tournaments:[bracket] });
    if (!this.connected) throw Error('Connect to Google Drive first.');
    const link = this.linked(bracket.id);
    let file;
    if (link) {
      if (link.folder !== this.folder) throw Error('This bracket is linked to another Google account. Reconnect with its account.');
      file = await this.metadata(link.fileId, bracket.id);
      if (file.modifiedTime !== link.modifiedTime) throw Error('This bracket changed in Drive. Export your local JSON backup, then load the Drive copy before editing.');
    } else {
      const existing = (await this.list()).find(f => f.appProperties?.bracketId === bracket.id);
      if (existing) throw Error('This bracket already exists in Drive. Load its saved copy first to avoid overwriting changes.');
    }
    const metadata = { name:`${bracket.name}.json`, appProperties:{ arenaApp:APP, bracketId:bracket.id }, ...(!file ? { parents:[this.folder] } : {}) };
    const boundary = `arena_${crypto.randomUUID()}`;
    const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,JSON.stringify(metadata),`\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,JSON.stringify({version:1,tournaments:[bracket]}),`\r\n--${boundary}--`]);
    const saved = await this.request(`/files${file ? `/${encodeURIComponent(file.id)}` : ''}?uploadType=multipart&fields=${FIELDS}`, {method:file ? 'PATCH' : 'POST',body,headers:{'Content-Type':`multipart/related; boundary=${boundary}`}},true);
    this.remember(bracket.id,saved);
    return saved;
  }
  async trash(fileId, bracketId, expectedModifiedTime) {
    if (!this.connected) throw Error('Connect to Google Drive before deleting a saved bracket.');
    const file = await this.metadata(fileId,bracketId);
    if (expectedModifiedTime && file.modifiedTime !== expectedModifiedTime) throw Error('This bracket changed in Drive. Refresh the Drive list before deleting it.');
    await this.request(`/files/${encodeURIComponent(file.id)}?fields=id`,{method:'PATCH',body:JSON.stringify({trashed:true})});
    this.forget(file.appProperties.bracketId);
  }
  async deleteLinked(bracketId) {
    const link = this.linked(bracketId); if (!link) return;
    if (link.folder !== this.folder) throw Error('Connect to the Google account where this bracket is saved before deleting it.');
    await this.trash(link.fileId,bracketId,link.modifiedTime);
  }
}
