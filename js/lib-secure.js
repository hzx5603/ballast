/* Ballast client-side encryption. Exposes window.BL.secure.
 * AES-256-GCM with a key derived from a passphrase by PBKDF2-SHA-256. The passphrase never leaves the browser
 * and is never stored. If it is lost the data cannot be recovered. */
(function (root) {
  'use strict';
  const BL = root.BL = root.BL || {};
  const enc = new TextEncoder(), dec = new TextDecoder();
  const ITER = 600000, MIN_ITER = 1000, MAX_ITER = 2000000, AAD = enc.encode('ballast-v2');
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const subtle = () => { const c = root.crypto; if (!c || !c.subtle) throw new Error('Encryption needs a secure (https) page and a current browser.'); return c; };
  async function deriveKey(pass, salt, iter) {
    const c = subtle(); const km = await c.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return c.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  const isEnvelope = o => !!o && typeof o === 'object' && o.ballast === 2 && o.enc === 'AES-256-GCM' && typeof o.ct === 'string' && typeof o.iv === 'string' && typeof o.salt === 'string';
  async function encrypt(obj, pass, iter) {
    if (!pass || pass.length < 8) throw new Error('Use a passphrase of at least 8 characters.');
    iter = iter || ITER; const c = subtle(); const salt = c.getRandomValues(new Uint8Array(16)), iv = c.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(pass, salt, iter);
    const ct = new Uint8Array(await c.subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: AAD }, key, enc.encode(JSON.stringify(obj))));
    return { ballast: 2, enc: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iter: iter, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
  }
  async function decrypt(env, pass) {
    if (!isEnvelope(env)) throw new Error('This is not an encrypted Ballast file.');
    const iter = +env.iter; if (!(iter >= MIN_ITER && iter <= MAX_ITER)) throw new Error('Unsupported key settings in this file.');
    try {
      const key = await deriveKey(pass, unb64(env.salt), iter);
      const pt = await subtle().subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv), additionalData: AAD }, key, unb64(env.ct));
      return JSON.parse(dec.decode(pt));
    } catch (e) { throw new Error('Wrong passphrase, or the file was changed.'); }
  }
  BL.secure = { encrypt: encrypt, decrypt: decrypt, isEnvelope: isEnvelope, ITER: ITER };
  if (typeof module !== 'undefined' && module.exports) module.exports = BL;
})(typeof window !== 'undefined' ? window : globalThis);
