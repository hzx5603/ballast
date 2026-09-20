/* Ballast cloud module. Exposes window.BL.cloud.
 *  - Google sign-in (token flow, in-memory only) and Google Drive storage (drive.file scope: the app can only see the
 *    files it created itself).
 *  - Optional client-side encryption of the stored file (see lib-secure.js).
 *  - A small client for the Cloudflare Worker (market data and AI). Only ticker symbols, public figures and
 *    percentage weights are ever sent there. Never statements, balances or account details.
 */
(function (root) {
  'use strict';
  const BL = root.BL = root.BL || {};
  // Two separate tokens on purpose. The Drive token only ever goes to Google. The identity token has no access to
  // any Google data and is the only thing the Worker ever sees.
  const SCOPES = { drive: 'https://www.googleapis.com/auth/drive.file', id: 'https://www.googleapis.com/auth/userinfo.email' };
  const FILE = 'ballast-data.json', PREV = 'ballast-data.prev.json', FOLDER = 'Ballast';
  const cfg = () => root.BALLAST_CONFIG || {};
  const clients = { drive: null, id: null }, tokens = { drive: null, id: null }, expiry = { drive: 0, id: 0 };
  let folderId = null, fileId = null, prevId = null, rawAtLoad = null, backedUp = false, email = '';

  const configured = () => /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/i.test(cfg().GOOGLE_CLIENT_ID || '');
  const apiConfigured = () => /^https:\/\/[^\s/]+$/.test(cfg().API_BASE || '') && !/YOUR-SUBDOMAIN/i.test(cfg().API_BASE || '');
  const gis = () => root.google && root.google.accounts && root.google.accounts.oauth2;

  function waitForGis(tries) {
    return new Promise((resolve, reject) => { let n = 0; (function tick() { if (gis()) return resolve(); if (++n > (tries || 60)) return reject(new Error('Could not load Google Sign-In. Check your connection and any content blocker.')); setTimeout(tick, 100); })(); });
  }
  async function ensureClient(kind) {
    if (clients[kind]) return clients[kind]; await waitForGis();
    clients[kind] = gis().initTokenClient({ client_id: cfg().GOOGLE_CLIENT_ID, scope: SCOPES[kind], hint: cfg().GOOGLE_ACCOUNT_HINT || undefined, callback: () => { }, error_callback: () => { } });
    return clients[kind];
  }
  /** kind: 'drive' (default) or 'id'. opts.silent: try without showing a prompt (works after the user has approved once). */
  async function signIn(opts, kind) {
    kind = kind || 'drive';
    if (!configured()) throw new Error('Google sign-in is not set up. Add your client ID to js/config.js.');
    const c = await ensureClient(kind);
    return new Promise((resolve, reject) => {
      c.callback = r => { if (r && r.access_token) { tokens[kind] = r.access_token; expiry[kind] = Date.now() + (Number(r.expires_in) || 3600) * 1000 - 60000; resolve(); } else reject(new Error((r && r.error_description) || 'Sign-in was not completed.')); };
      c.error_callback = e => reject(new Error(e && e.type === 'popup_closed' ? 'The sign-in window was closed.' : 'Sign-in was not completed.'));
      try { c.requestAccessToken({ prompt: opts && opts.silent ? '' : undefined }); } catch (e) { reject(e); }
    });
  }
  async function freshToken(kind) { if (!tokens[kind] || Date.now() > expiry[kind]) await signIn({ silent: true }, kind); return tokens[kind]; }
  function signOut() {
    ['drive', 'id'].forEach(k => { const t = tokens[k]; tokens[k] = null; expiry[k] = 0; try { if (t && gis()) gis().revoke(t, () => { }); } catch (e) { } });
    folderId = fileId = prevId = null; backedUp = false; rawAtLoad = null; email = '';
  }
  const isSignedIn = () => !!tokens.drive;
  const hasIdToken = () => !!tokens.id && Date.now() < expiry.id;

  async function authed(url, init, retry) {
    init = init || {}; init.headers = Object.assign({}, init.headers, { Authorization: 'Bearer ' + await freshToken('drive') });
    const res = await fetch(url, init);
    if (res.status === 401 && !retry) { tokens.drive = null; return authed(url, init, true); }
    return res;
  }

  /* ---------------------------------------------------------------- Drive */
  const q = s => encodeURIComponent(s);
  async function findFolder() {
    if (folderId) return folderId;
    let r = await authed('https://www.googleapis.com/drive/v3/files?q=' + q("name='" + FOLDER + "' and mimeType='application/vnd.google-apps.folder' and trashed=false") + '&spaces=drive&fields=files(id,name)');
    if (!r.ok) throw new Error('Drive folder lookup failed (' + r.status + ').');
    const d = await r.json(); if (d.files && d.files[0]) return (folderId = d.files[0].id);
    r = await authed('https://www.googleapis.com/drive/v3/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' }) });
    if (!r.ok) throw new Error('Could not create the Ballast folder in Drive (' + r.status + ').');
    return (folderId = (await r.json()).id);
  }
  async function findFile(name) {
    const fid = await findFolder();
    const r = await authed('https://www.googleapis.com/drive/v3/files?q=' + q("name='" + name + "' and trashed=false and '" + fid + "' in parents") + '&spaces=drive&fields=files(id,name)');
    if (!r.ok) throw new Error('Drive lookup failed (' + r.status + ').');
    const d = await r.json(); return d.files && d.files[0] ? d.files[0].id : null;
  }
  async function writeFile(name, id, content) {
    if (id) { const r = await authed('https://www.googleapis.com/upload/drive/v3/files/' + id + '?uploadType=media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: content }); if (!r.ok) throw new Error('Drive save failed (' + r.status + ').'); return id; }
    const fid = await findFolder(); const b = 'ballast_' + Math.random().toString(36).slice(2);
    const body = '--' + b + '\r\nContent-Type: application/json\r\n\r\n' + JSON.stringify({ name: name, mimeType: 'application/json', parents: [fid] }) + '\r\n--' + b + '\r\nContent-Type: application/json\r\n\r\n' + content + '\r\n--' + b + '--';
    const r = await authed('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body: body });
    if (!r.ok) throw new Error('Drive save failed (' + r.status + ').'); return (await r.json()).id;
  }
  /** Returns {status:'none'} | {status:'plain', data} | {status:'encrypted', envelope}. */
  async function load() {
    fileId = await findFile(FILE); rawAtLoad = null; backedUp = false; if (!fileId) return { status: 'none' };
    const r = await authed('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media'); if (!r.ok) throw new Error('Drive read failed (' + r.status + ').');
    const text = await r.text(); rawAtLoad = text; if (!text.trim()) return { status: 'none' };
    let o; try { o = JSON.parse(text); } catch (e) { throw new Error('The saved file in Drive is not valid JSON. It was left untouched.'); }
    return BL.secure && BL.secure.isEnvelope(o) ? { status: 'encrypted', envelope: o } : { status: 'plain', data: BL.core ? BL.core.cleanJson(o) : o };
  }
  /** pass: passphrase string to encrypt with, or null for plain JSON. */
  async function save(state, pass) {
    const content = JSON.stringify(pass ? await BL.secure.encrypt(state, pass) : state);
    if (rawAtLoad && !backedUp) { try { prevId = await findFile(PREV); prevId = await writeFile(PREV, prevId, rawAtLoad); } catch (e) { /* the backup is a bonus, not a blocker */ } backedUp = true; }
    fileId = await writeFile(FILE, fileId, content); rawAtLoad = content; return true;
  }
  /** The copy kept before the first overwrite of a session. Returns the same shape as load(). */
  async function loadPrev() {
    const id = await findFile(PREV); if (!id) return { status: 'none' };
    const r = await authed('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media'); if (!r.ok) throw new Error('Drive read failed (' + r.status + ').');
    let o; try { o = JSON.parse(await r.text()); } catch (e) { throw new Error('The previous version is not valid JSON.'); }
    return BL.secure && BL.secure.isEnvelope(o) ? { status: 'encrypted', envelope: o } : { status: 'plain', data: BL.core ? BL.core.cleanJson(o) : o };
  }
  async function whoAmI() {
    if (email) return email; const t = await freshToken('id'); const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + t } }); if (!r.ok) return ''; const d = await r.json(); return (email = d.email || '');
  }

  /* --------------------------------------------------------------- Worker */
  async function api(path, body) {
    if (!apiConfigured()) throw new Error('The market data service is not set up. Add your Worker address to js/config.js.');
    const go = async () => { let t; try { t = await freshToken('id'); } catch (e) { throw new Error('Allow market data access first (Data & settings, or the button on this screen).'); } return fetch(cfg().API_BASE.replace(/\/$/, '') + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body || {}) }); };
    let r = await go(); if (r.status === 401) { tokens.id = null; r = await go(); }
    let d = null; try { d = await r.json(); } catch (e) { }
    if (!r.ok) throw new Error((d && d.error) || 'Service error ' + r.status);
    return d;
  }

  BL.cloud = { configured: configured, apiConfigured: apiConfigured, signIn: signIn, signInId: () => signIn(null, 'id'), signOut: signOut, isSignedIn: isSignedIn, hasIdToken: hasIdToken, load: load, loadPrev: loadPrev, save: save, api: api, whoAmI: whoAmI, FILE: FILE };
  if (typeof module !== 'undefined' && module.exports) module.exports = BL;
})(typeof window !== 'undefined' ? window : globalThis);
