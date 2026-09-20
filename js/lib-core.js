/* Ballast core library (pure functions, no DOM, no network).
 * Loaded before app.js. Exposes window.BL.core. Also loadable in Node for tests.
 *
 * Privacy note: the statement parser reads only the fields it needs. Account
 * name, account number, address and free-text bank details are never copied
 * into the returned objects (see scrubDesc and the parser's switch statement).
 */
(function (root) {
  'use strict';
  const BL = root.BL = root.BL || {};
  BL.ver = BL.ver || {}; BL.ver['lib-core'] = 9; // release this file last changed in; app.js checks it
  const fin = Number.isFinite;

  /* ---------------------------------------------------------------- utils */
  function num(v) {
    if (v == null) return NaN;
    let s = String(v).trim(); if (!s) return NaN;
    const neg = /^\(.*\)$/.test(s);
    s = s.replace(/[,\s$€£¥%()]/g, '');
    const n = parseFloat(s);
    return neg ? -n : n;
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MON3 = MONTHS.map(m => m.slice(0, 3));
  const pad = n => String(n).padStart(2, '0');
  const isoOf = (y, m, d) => y + '-' + pad(m) + '-' + pad(d);
  function validIso(y, m, d) { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; }
  /** Accepts "January 1, 2022", "2022-01-01", "2022-01-01, 09:30:12", "20220101". Returns ISO date or ''. */
  function parseDate(s) {
    if (s == null) return '';
    s = String(s).trim();
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m && validIso(+m[1], +m[2], +m[3])) return isoOf(+m[1], +m[2], +m[3]);
    m = /^(\d{4})(\d{2})(\d{2})(?:$|[;,\s])/.exec(s);
    if (m && validIso(+m[1], +m[2], +m[3])) return isoOf(+m[1], +m[2], +m[3]);
    m = /^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(s);
    if (m) { const mi = MONTHS.findIndex(x => x.toLowerCase().startsWith(m[1].toLowerCase().slice(0, 3))); if (mi >= 0 && validIso(+m[3], mi + 1, +m[2])) return isoOf(+m[3], mi + 1, +m[2]); }
    m = /^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})/.exec(s);
    if (m) { const mi = MONTHS.findIndex(x => x.toLowerCase().startsWith(m[2].toLowerCase().slice(0, 3))); if (mi >= 0 && validIso(+m[3], mi + 1, +m[1])) return isoOf(+m[3], mi + 1, +m[1]); }
    return '';
  }
  function parseTime(s) { const m = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(s || '')); return m ? pad(+m[1]) + ':' + m[2] + ':' + pad(+(m[3] || 0)) : ''; }
  const dayNum = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : NaN; };
  const daysBetween = (a, b) => dayNum(b) - dayNum(a);
  function addDays(iso, n) { const t = new Date(dayNum(iso) * 864e5 + n * 864e5); return isoOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); }
  function lastDayOfMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function fmtDay(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? (+m[3]) + ' ' + MON3[+m[2] - 1] + ' ' + m[1] : ''; }
  function periodLabel(from, to) {
    if (!to) return '';
    if (!from || from === to) return fmtDay(to);
    const f = /^(\d{4})-(\d{2})-(\d{2})/.exec(from), t = /^(\d{4})-(\d{2})-(\d{2})/.exec(to);
    if (f && t) {
      if (f[1] === t[1] && f[2] === t[2] && +f[3] === 1 && +t[3] === lastDayOfMonth(+t[1], +t[2])) return MON3[+t[2] - 1] + ' ' + t[1];
      if (f[1] === t[1] && f[2] === '01' && f[3] === '01' && t[2] === '12' && t[3] === '31') return t[1];
    }
    return fmtDay(from) + ' to ' + fmtDay(to);
  }

  /** Neutralise spreadsheet formula injection when exporting CSV. */
  function csvCell(v) {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?\d+(\.\d+)?$/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  /** Only http(s) URLs may become links. Everything else (javascript:, data:) is dropped. */
  function safeUrl(u) {
    if (!u) return '';
    try { const x = new URL(String(u)); return (x.protocol === 'https:' || x.protocol === 'http:') ? x.href : ''; } catch (e) { return ''; }
  }
  /** Copy a parsed JSON object into a fresh one, skipping prototype-polluting keys at any depth. */
  function cleanJson(o, depth) {
    depth = depth || 0;
    if (depth > 40) return null;
    if (Array.isArray(o)) return o.map(x => cleanJson(x, depth + 1));
    if (o && typeof o === 'object') {
      const out = {};
      for (const k of Object.keys(o)) { if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue; out[k] = cleanJson(o[k], depth + 1); }
      return out;
    }
    return o;
  }

  /* ------------------------------------------------------------------ CSV */
  function parseCSV(text) {
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
      else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  /* ----------------------------------------------------------------- IBKR */
  function isIBKR(t) { return /^(Statement|Account Information|Open Positions|Net Asset Value),Header,/m.test(t); }

  /** Keep only generic wording for cash movements. Bank details or the account holder's name can appear in these free-text fields. */
  function scrubDesc(kind, desc) {
    const d = String(desc || '');
    if (kind === 'dep' || kind === 'wd') {
      const hints = ['Electronic Fund Transfer', 'Wire', 'Cheque', 'ACH', 'FAST', 'PayNow', 'Internal Transfer', 'Position Transfer', 'Cash Transfer'];
      const hit = hints.find(h => d.toLowerCase().includes(h.toLowerCase()));
      return (kind === 'dep' ? 'Deposit' : 'Withdrawal') + (hit ? ' (' + hit + ')' : '');
    }
    return d.replace(/[A-Za-z0-9]*\*{3,}[A-Za-z0-9]*/g, '').replace(/^[\s:;,\-]+/, '').replace(/\s+/g, ' ').trim().slice(0, 140);
  }
  /* ---- cleaned statement copies ---------------------------------------------------------------------------------------------------
   * Keeps only the sections and columns Ballast reads, with identity columns blanked and free text tidied, so the statement can be re-read later
   * (for example after an improvement to the parser) without asking for the file again. It is a whitelist: anything not listed is dropped. */
  const PARSER_VERSION = 3;
  const KEEP_SECTIONS = new Set(['Statement', 'Account Information', 'Net Asset Value', 'Change in NAV', 'Open Positions', 'Cash Report', 'Forex Balances', 'Trades', 'Deposits & Withdrawals', 'Dividends', 'Withholding Tax', 'Interest', 'Fees', 'Corporate Actions', 'Financial Instrument Information']);
  const PII_COL = /^(account|acct|address|alias|customer|holder|user|e-?mail|phone|street|city|postal|zip|name)\b/i;
  const csvQ = v => { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  function sanitizeIBKR(text) {
    const rows = parseCSV(String(text).replace(/^\uFEFF/, '')); const hdr = {}; const out = [];
    for (const r of rows) {
      const sec = r[0], kind = r[1];
      if (!KEEP_SECTIONS.has(sec) || (kind !== 'Header' && kind !== 'Data')) continue;
      if (kind === 'Header') { hdr[sec] = r; out.push(r.slice()); continue; }
      if (sec === 'Statement' && (r[2] || '') !== 'Period') continue;
      if (sec === 'Account Information' && (r[2] || '') !== 'Base Currency') continue;
      const h = hdr[sec] || []; const o = r.slice();
      h.forEach((name, i) => { if (i >= 2 && PII_COL.test(String(name || '').trim())) o[i] = ''; });
      const di = h.findIndex(x => /^description$/i.test(String(x).trim()));
      if (di >= 0 && o[di] != null) {
        if (sec === 'Deposits & Withdrawals') { const ai = h.findIndex(x => /^amount$/i.test(String(x).trim())); o[di] = scrubDesc(num(o[ai]) >= 0 ? 'dep' : 'wd', o[di]); }
        else o[di] = scrubDesc('x', o[di]);
      }
      out.push(o);
    }
    return out.map(r => r.map(csvQ).join(',')).join('\n');
  }
  function instrFromDesc(desc) { return String(desc || '').split('(')[0].trim().split(/\s+/)[0] || ''; }

  function parseIBKR(text) {
    const rows = parseCSV(String(text).replace(/^\uFEFF/, '')); const hdr = {};
    const out = { base: null, from: '', to: '', key: '', label: '', period: '', positions: [], cash: [], nav: NaN, navPrior: NaN, change: {}, twrStmt: NaN, ledger: [], info: {}, fx: {}, accruals: 0, sections: {} };
    const tradesOrder = [], tradesExec = [];
    for (const r of rows) {
      const sec = r[0], kind = r[1];
      if (kind === 'Header') { hdr[sec] = r; out.sections[sec] = true; continue; }
      if (kind !== 'Data') continue;
      const h = hdr[sec] || []; const o = {}; h.forEach((k, i) => { o[k] = r[i]; });
      switch (sec) {
        case 'Statement': if (o['Field Name'] === 'Period') out.period = o['Field Value'] || ''; break;
        case 'Account Information': if (o['Field Name'] === 'Base Currency') out.base = (o['Field Value'] || '').trim(); break; // name, account id and address are deliberately ignored
        case 'Net Asset Value':
          if ((o['Asset Class'] || '').trim() === 'Total') { out.nav = num(o['Current Total'] != null ? o['Current Total'] : o['Current Long']); out.navPrior = num(o['Prior Total']); }
          else if (/accrual/i.test(o['Asset Class'] || '')) { const a = num(o['Current Total'] != null ? o['Current Total'] : o['Current Long']); if (fin(a)) out.accruals += a; } // accrued dividends and interest are part of the statement's net asset value
          else if (o['Time Weighted Rate of Return'] != null && fin(num(o['Time Weighted Rate of Return']))) out.twrStmt = num(o['Time Weighted Rate of Return']);
          break;
        case 'Change in NAV':
          if (o['Field Name']) { const k = o['Field Name'].trim(); if (/time weighted/i.test(k)) out.twrStmt = num(o['Field Value']); else out.change[k] = num(o['Field Value']); }
          break;
        case 'Forex Balances': { // closing exchange rates in the base currency, per one unit of the currency held
          const c = (o['Description'] || '').trim(), px = num(o['Close Price']);
          if (/forex/i.test(o['Asset Category'] || '') && /^[A-Z]{3}$/.test(c) && c !== out.base && fin(px) && px > 0) out.fx[c] = px;
          break;
        }
        case 'Financial Instrument Information': if (o['Symbol']) out.info[o['Symbol']] = { desc: o['Description'], exch: o['Listing Exch'], type: o['Type'], asset: o['Asset Category'] }; break;
        case 'Open Positions':
          if (o['DataDiscriminator'] && o['DataDiscriminator'] !== 'Summary') break;
          if (!o['Symbol']) break;
          out.positions.push({ asset: o['Asset Category'] || 'Stocks', ccy: (o['Currency'] || '').trim(), symbol: o['Symbol'].trim(), qty: num(o['Quantity']), mult: num(o['Mult']) || 1, cost: num(o['Cost Basis']), price: num(o['Close Price']), value: num(o['Value']) });
          break;
        case 'Cash Report':
          if (o['Currency Summary'] === 'Ending Cash' && o['Currency'] && o['Currency'] !== 'Base Currency Summary' && /^[A-Z]{3}$/.test(o['Currency'])) out.cash.push({ ccy: o['Currency'], amount: num(o['Total']) });
          break;
        case 'Dividends': case 'Withholding Tax': case 'Interest': {
          const ccy = (o['Currency'] || '').trim(), amt = num(o['Amount']), date = parseDate(o['Date']);
          if (/^[A-Z]{3}$/.test(ccy) && fin(amt) && date) out.ledger.push({ type: sec === 'Dividends' ? 'div' : sec === 'Interest' ? 'int' : 'tax', date: date, time: '', sym: sec === 'Interest' ? '' : instrFromDesc(o['Description']), asset: '', ccy: ccy, qty: NaN, price: NaN, amt: amt, fee: 0, feeCcy: ccy, pnl: NaN, desc: scrubDesc('x', o['Description']), code: '' });
          break;
        }
        case 'Fees': {
          const ccy = (o['Currency'] || '').trim(), amt = num(o['Amount']), date = parseDate(o['Date']);
          if (/^[A-Z]{3}$/.test(ccy) && fin(amt) && date) out.ledger.push({ type: 'fee', date: date, time: '', sym: '', asset: '', ccy: ccy, qty: NaN, price: NaN, amt: amt, fee: 0, feeCcy: ccy, pnl: NaN, desc: scrubDesc('x', o['Description']), code: '' });
          break;
        }
        case 'Deposits & Withdrawals': {
          const ccy = (o['Currency'] || '').trim(), amt = num(o['Amount']), date = parseDate(o['Settle Date'] || o['Date']);
          if (/^[A-Z]{3}$/.test(ccy) && fin(amt) && date) { const k = amt >= 0 ? 'dep' : 'wd'; out.ledger.push({ type: k, date: date, time: '', sym: '', asset: '', ccy: ccy, qty: NaN, price: NaN, amt: amt, fee: 0, feeCcy: ccy, pnl: NaN, desc: scrubDesc(k, o['Description']), code: '' }); }
          break;
        }
        case 'Corporate Actions': {
          const ccy = (o['Currency'] || '').trim(), date = parseDate(o['Date/Time'] || o['Report Date']);
          if (/^[A-Z]{3}$/.test(ccy) && date && o['DataDiscriminator'] !== 'Total' && !/^Total/.test(o['Asset Category'] || '')) out.ledger.push({ type: 'corp', date: date, time: parseTime(o['Date/Time']), sym: instrFromDesc(o['Description']), asset: o['Asset Category'] || '', ccy: ccy, qty: num(o['Quantity']), price: NaN, amt: fin(num(o['Proceeds'])) ? num(o['Proceeds']) : 0, fee: 0, feeCcy: ccy, pnl: num(o['Realized P/L']), desc: scrubDesc('x', o['Description']), code: o['Code'] || '' });
          break;
        }
        case 'Trades': {
          const disc = o['DataDiscriminator']; const sym = (o['Symbol'] || '').trim();
          if (!sym || (disc !== 'Order' && disc !== 'Trade')) break;
          const ccy = (o['Currency'] || '').trim(); const date = parseDate(o['Date/Time']); if (!date || !/^[A-Z]{3}$/.test(ccy)) break;
          const commKey = Object.keys(o).find(k => /^Comm/i.test(k)); const asset = o['Asset Category'] || 'Stocks';
          const e = { type: /forex/i.test(asset) ? 'fx' : (num(o['Quantity']) >= 0 ? 'buy' : 'sell'), date: date, time: parseTime(o['Date/Time']), sym: sym, asset: asset, ccy: ccy, qty: num(o['Quantity']), price: num(o['T. Price']), amt: num(o['Proceeds']), fee: commKey ? num(o[commKey]) : 0, feeCcy: /forex/i.test(asset) ? '' : ccy, pnl: num(o['Realized P/L']), desc: '', code: o['Code'] || '' };
          if (!fin(e.fee)) e.fee = 0;
          (disc === 'Order' ? tradesOrder : tradesExec).push(e);
          break;
        }
      }
    }
    const trades = tradesOrder.length ? tradesOrder : tradesExec;
    trades.forEach(t => { if (t.feeCcy === '') t.feeCcy = out.base || t.ccy; out.ledger.push(t); });
    const parts = out.period.split(/\s+-\s+/);
    const to = parseDate(parts[parts.length - 1]); const from = parts.length > 1 ? parseDate(parts[0]) : to;
    out.to = to; out.from = from || to; out.key = to || new Date().toISOString().slice(0, 10);
    out.label = to ? periodLabel(out.from, to) : out.key;
    if (!out.positions.length && !fin(out.nav)) throw new Error('No open positions or net asset value found. Export an Activity statement (CSV) that includes Open Positions.');
    return out;
  }

  /* --------------------------------------------------------------- ledger */
  function entryKey(e) { return [e.type, e.date, e.time || '', e.sym || '', e.ccy, fin(e.qty) ? e.qty : '', fin(e.price) ? e.price : '', fin(e.amt) ? e.amt : '', fin(e.fee) ? e.fee : '', String(e.desc || '').slice(0, 40)].join('|'); }
  /** Union of several statements' entries. An entry present in two overlapping statements is counted once;
   *  identical entries genuinely repeated inside one statement are kept (multiset maximum). */
  function combineLedgers(lists) {
    const best = new Map();
    lists.forEach(list => {
      const local = new Map();
      (list || []).forEach(e => { const k = entryKey(e); if (!local.has(k)) local.set(k, []); local.get(k).push(e); });
      local.forEach((arr, k) => { if (!best.has(k) || best.get(k).length < arr.length) best.set(k, arr); });
    });
    const out = []; best.forEach(arr => arr.forEach(e => out.push(e)));
    out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.time < b.time ? 1 : a.time > b.time ? -1 : 0)));
    return out;
  }
  function describeEntry(e) {
    const q = Math.abs(e.qty), px = fin(e.price) ? e.price : null;
    const px2 = v => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: v < 10 ? 4 : 2 });
    const qf = v => String(+v.toFixed(4));
    switch (e.type) {
      case 'buy': return 'Bought ' + qf(q) + ' ' + e.sym + (px != null ? ' at ' + px2(px) + ' ' + e.ccy : '');
      case 'sell': return 'Sold ' + qf(q) + ' ' + e.sym + (px != null ? ' at ' + px2(px) + ' ' + e.ccy : '');
      case 'fx': { const pr = String(e.sym || '').split('.'); const b = pr[0], qc = pr[1] || e.ccy; const amt = fin(e.amt) ? Math.abs(e.amt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
        return e.qty >= 0 ? 'Bought ' + b + ' ' + qf(q) + (amt ? ' with ' + qc + ' ' + amt : '') : 'Sold ' + b + ' ' + qf(q) + (amt ? ' for ' + qc + ' ' + amt : ''); }
      case 'div': return 'Dividend' + (e.sym ? ' from ' + e.sym : '');
      case 'tax': return 'Tax withheld' + (e.sym ? ' on ' + e.sym : '');
      case 'int': return 'Interest';
      case 'fee': return 'Fee' + (e.desc ? ': ' + e.desc : '');
      case 'dep': return e.desc || 'Deposit';
      case 'wd': return e.desc || 'Withdrawal';
      case 'corp': return 'Corporate action' + (e.desc ? ': ' + e.desc : '');
      default: return e.desc || e.type;
    }
  }
  /** rate(ccy) -> multiplier to base currency or null. Returns totals per calendar year plus per-symbol totals. */
  function ledgerSummary(entries, rate) {
    const years = {}, syms = {}; const missing = new Set();
    const conv = (v, c) => { if (!fin(v)) return 0; const r = rate(c); if (r == null) { missing.add(c); return 0; } return v * r; };
    const Y = y => years[y] || (years[y] = { year: y, trades: 0, buys: 0, sells: 0, comm: 0, div: 0, tax: 0, int: 0, fees: 0, dep: 0, wd: 0, pnl: 0 });
    entries.forEach(e => {
      const y = Y(e.date.slice(0, 4));
      const S = e.sym ? (syms[e.sym] || (syms[e.sym] = { sym: e.sym, trades: 0, bought: 0, sold: 0, comm: 0, div: 0, tax: 0, pnl: 0 })) : null;
      const fee = conv(e.fee, e.feeCcy || e.ccy);
      if (e.type === 'buy' || e.type === 'sell' || e.type === 'fx') {
        y.trades++; y.comm += fee;
        if (e.type === 'buy') { const v = -conv(e.amt, e.ccy); y.buys += v; if (S) S.bought += v; }
        if (e.type === 'sell') { const v = conv(e.amt, e.ccy); y.sells += v; if (S) S.sold += v; }
        if (e.type !== 'fx') { const p = conv(e.pnl, e.ccy); y.pnl += p; if (S) { S.pnl += p; S.trades++; S.comm += fee; } }
      } else if (e.type === 'div') { const v = conv(e.amt, e.ccy); y.div += v; if (S) S.div += v; }
      else if (e.type === 'tax') { const v = conv(e.amt, e.ccy); y.tax += v; if (S) S.tax += v; }
      else if (e.type === 'int') y.int += conv(e.amt, e.ccy);
      else if (e.type === 'fee') y.fees += conv(e.amt, e.ccy);
      else if (e.type === 'dep') y.dep += conv(e.amt, e.ccy);
      else if (e.type === 'wd') y.wd += conv(e.amt, e.ccy);
    });
    return { years: Object.values(years).sort((a, b) => a.year < b.year ? 1 : -1), syms: Object.values(syms), missing: Array.from(missing) };
  }

  /* -------------------------------------------------- statement snapshots */
  /** Turn a parsed statement into the compact record kept in state.snaps. */
  function makeSnap(r, fallbackBase) {
    const c = r.change || {};
    return { key: r.key, from: r.from, to: r.to || r.key, label: r.label, base: r.base || fallbackBase, nav: r.nav,
      navStart: fin(c['Starting Value']) ? c['Starting Value'] : r.navPrior, change: c, twrStmt: r.twrStmt,
      n: r.positions.length, ledger: r.ledger, raw: r.raw || '', pv: PARSER_VERSION, accr: fin(r.accruals) ? r.accruals : 0, sections: Object.keys(r.sections || {}).filter(s => ['Open Positions', 'Trades', 'Deposits & Withdrawals', 'Dividends', 'Cash Report', 'Change in NAV', 'Net Asset Value'].includes(s)) };
  }
  /** Sanity checks on an imported statement. Returns list of {level:'ok'|'warn', msg}. */
  function checkSnap(s) {
    const res = []; const c = s.change || {};
    const skip = /^(starting value|ending value)$/i;
    const keys = Object.keys(c).filter(k => !skip.test(k) && fin(c[k]));
    if (fin(s.navStart) && keys.length && fin(s.nav)) {
      const bridge = s.navStart + sum(keys, k => c[k]); const tol = Math.max(1, Math.abs(s.nav) * 0.005);
      if (Math.abs(bridge - s.nav) > tol) res.push({ level: 'warn', msg: 'Starting value plus the listed changes gives ' + bridge.toFixed(2) + ' but the statement reports ' + s.nav.toFixed(2) + '. Some line items may not have been read.' });
    }
    if (!fin(s.nav)) res.push({ level: 'warn', msg: 'No net asset value found in this statement.' });
    if (s.sections && !s.sections.includes('Trades')) res.push({ level: 'warn', msg: 'No Trades section. Purchases and sales for this period will be missing from Activity.' });
    if (s.sections && !s.sections.includes('Deposits & Withdrawals') && fin(c['Deposits & Withdrawals']) && Math.abs(c['Deposits & Withdrawals']) > 0) res.push({ level: 'warn', msg: 'Deposits were made but no Deposits & Withdrawals section was found. Performance timing will be approximate.' });
    if (!res.length) res.push({ level: 'ok', msg: 'Checks passed.' });
    return res;
  }

  /* ---------------------------------------------------------- performance */
  /** Pick the finest, non-overlapping statement periods. A monthly statement beats an annual one covering the same days. */
  function chooseSegments(snaps) {
    const list = snaps.filter(s => s.to && fin(s.nav)).map(s => ({ s: s, from: s.from || s.to, to: s.to, len: daysBetween(s.from || s.to, s.to) + 1 }));
    list.sort((a, b) => a.len - b.len || (a.to < b.to ? -1 : 1));
    const chosen = [];
    list.forEach(c => { if (!chosen.some(x => !(c.to < x.from || c.from > x.to))) chosen.push(c); });
    chosen.sort((a, b) => a.from < b.from ? -1 : 1);
    return chosen;
  }
  function coverage(snaps, today) {
    const segs = chooseSegments(snaps); const gaps = [], breaks = [];
    for (let i = 1; i < segs.length; i++) {
      const prev = segs[i - 1], cur = segs[i];
      const gapStart = addDays(prev.to, 1), gapEnd = addDays(cur.from, -1);
      if (gapStart <= gapEnd) gaps.push({ from: gapStart, to: gapEnd, days: daysBetween(gapStart, gapEnd) + 1 });
      else if (fin(cur.s.navStart) && fin(prev.s.nav) && Math.abs(cur.s.navStart - prev.s.nav) > Math.max(1, Math.abs(prev.s.nav) * 0.005)) breaks.push({ at: cur.from, prevEnd: prev.s.nav, nextStart: cur.s.navStart });
    }
    const dropped = snaps.length - segs.length;
    const last = segs.length ? segs[segs.length - 1].to : '';
    return { segments: segs.map(x => ({ from: x.from, to: x.to, label: x.s.label, days: x.len })), gaps: gaps, breaks: breaks, overlapped: dropped, first: segs.length ? segs[0].from : '', last: last, staleDays: last && today ? daysBetween(last, today) : NaN };
  }

  /** rate(ccy) -> multiplier to base or null. */
  function segmentFlows(seg, rate, base) {
    const s = seg.s; const F = (s.change || {})['Deposits & Withdrawals'];
    const raw = (s.ledger || []).filter(e => e.type === 'dep' || e.type === 'wd').map(e => {
      const r = e.ccy === base ? 1 : rate(e.ccy); return r == null ? null : { date: e.date, amt: e.amt * r };
    }).filter(Boolean);
    const tot = sum(raw, x => x.amt);
    if (fin(F)) {
      if (raw.length && Math.abs(tot) > 1e-9 && F / tot > 0.5 && F / tot < 2) { const k = F / tot; return raw.map(x => ({ date: x.date, amt: x.amt * k })); }
      if (Math.abs(F) > 1e-9) { const mid = addDays(seg.from, Math.floor(daysBetween(seg.from, seg.to) / 2)); return [{ date: mid, amt: F }]; }
      return [];
    }
    return raw;
  }

  /**
   * NAV history, flow-adjusted returns and money-weighted return.
   * snaps: [{from,to,nav,navStart,change,ledger}], extra: [{date,nav}], opts: {rate, base}
   */
  function performance(snaps, extra, opts) {
    opts = opts || {}; const base = opts.base || 'USD'; const rate = opts.rate || (c => c === base ? 1 : null);
    const segs = chooseSegments(snaps);
    const points = new Map(); // date -> {date, nav, kind}
    const put = (d, nav, kind) => { if (!fin(nav) || !d) return; const cur = points.get(d); if (!cur || kind === 'statement') points.set(d, { date: d, nav: nav, kind: kind }); };
    segs.forEach(sg => {
      const startNav = sg.s.navStart; const d0 = addDays(sg.from, -1);
      if (fin(startNav) && !points.has(d0)) put(d0, startNav, 'statement');
      put(sg.to, sg.s.nav, 'statement');
    });
    (extra || []).forEach(x => { if (!points.has(x.date)) put(x.date, x.nav, 'file'); });
    const pts = Array.from(points.values()).sort((a, b) => a.date < b.date ? -1 : 1);
    // drop leading zero-NAV points (account opened later)
    let flows = []; segs.forEach(sg => { flows = flows.concat(segmentFlows(sg, rate, base)); });
    flows.sort((a, b) => a.date < b.date ? -1 : 1);
    const inSeg = (a, b) => segs.some(sg => a >= addDays(sg.from, -1) && b <= sg.to);
    const intervals = []; let idx = 100; const index = []; let contrib = 0; const series = [];
    pts.forEach((p, i) => {
      if (i === 0) { contrib = p.nav > 0 ? p.nav : 0; series.push({ date: p.date, nav: p.nav, contrib: contrib, gain: p.nav - contrib, idx: 100, kind: p.kind }); index.push(100); return; }
      const q = pts[i - 1]; const L = daysBetween(q.date, p.date);
      const F = flows.filter(f => f.date > q.date && f.date <= p.date);
      const Fsum = sum(F, f => f.amt); const wF = sum(F, f => f.amt * Math.max(0, Math.min(1, (daysBetween(f.date, p.date) + 1) / L)));
      const verified = inSeg(q.date, p.date); const den = q.nav + wF;
      const rDietz = (verified && den > 0) ? (p.nav - q.nav - Fsum) / den : NaN;
      // When an interval is exactly one statement and that statement reports its own time-weighted return (calculated daily by the broker), prefer it.
      const sg = segs.find(x => q.date === addDays(x.from, -1) && p.date === x.to);
      const rStmt = sg && fin(sg.s.twrStmt) && verified ? sg.s.twrStmt / 100 : NaN;
      const r = fin(rStmt) ? rStmt : rDietz;
      const usable = fin(r);
      if (usable) idx *= (1 + r);
      contrib += Fsum;
      intervals.push({ from: q.date, to: p.date, days: L, r: usable ? r : NaN, rDietz: rDietz, rStmt: rStmt, src: fin(rStmt) ? 'statement' : 'estimate', flow: Fsum, verified: verified, navFrom: q.nav, navTo: p.nav });
      series.push({ date: p.date, nav: p.nav, contrib: contrib, gain: p.nav - contrib, idx: idx, kind: p.kind });
      index.push(idx);
    });
    // drawdown on the flow-adjusted index
    let peak = -Infinity, maxDD = 0, ddFrom = '', ddTo = '', peakDate = ''; const dd = [];
    series.forEach(s => { if (s.idx > peak) { peak = s.idx; peakDate = s.date; } const d = s.idx / peak - 1; dd.push({ date: s.date, dd: d }); if (d < maxDD) { maxDD = d; ddFrom = peakDate; ddTo = s.date; } });
    // returns by calendar year (interval end) and month
    const byYear = {}, byMonth = {};
    intervals.forEach(iv => { if (!fin(iv.r)) return; const y = iv.to.slice(0, 4), m = iv.to.slice(0, 7); byYear[y] = (byYear[y] || 1) * (1 + iv.r); byMonth[m] = (byMonth[m] || 1) * (1 + iv.r); });
    const years = Object.keys(byYear).sort().map(y => ({ year: y, r: byYear[y] - 1 }));
    const months = Object.keys(byMonth).sort().map(m => ({ month: m, r: byMonth[m] - 1 }));
    const used = intervals.filter(i => fin(i.r));
    const spanDays = pts.length > 1 ? daysBetween(pts[0].date, pts[pts.length - 1].date) : 0; const usedDays = sum(used, i => i.days);
    const totalTwr = idx / 100 - 1; const yrs = usedDays / 365.25;
    const avgLen = used.length ? usedDays / used.length : NaN;
    // A flow-weighted estimate over long periods behaves like a money-weighted figure, not a time-weighted one. Flag it.
    const estDays = sum(used.filter(i => i.src === 'estimate'), i => i.days); const coarse = used.some(i => i.src === 'estimate' && i.days > 45);
    let vol = NaN, volBasis = '';
    if (used.length >= 6 && avgLen <= 35 && avgLen >= 20) { vol = sd(used.map(i => i.r)) * Math.sqrt(12); volBasis = 'monthly'; }
    else if (used.length >= 30 && avgLen <= 4) { vol = sd(used.map(i => i.r)) * Math.sqrt(252); volBasis = 'daily'; }
    // money-weighted return
    let xirrVal = NaN;
    if (pts.length > 1) {
      const cfs = []; const first = pts[0];
      if (first.nav > 0) cfs.push({ date: first.date, amt: -first.nav });
      flows.forEach(f => { if (first && f.date > first.date && f.date <= pts[pts.length - 1].date) cfs.push({ date: f.date, amt: -f.amt }); });
      const lastP = pts[pts.length - 1]; cfs.push({ date: lastP.date, amt: lastP.nav });
      cfs.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
      xirrVal = xirr(cfs);
    }
    const last = series[series.length - 1] || null;
    return { points: pts, series: series, intervals: intervals, drawdown: dd, maxDrawdown: { dd: maxDD, from: ddFrom, to: ddTo }, currentDrawdown: dd.length ? dd[dd.length - 1].dd : NaN,
      years: years, months: months, totalTwr: totalTwr, annualised: yrs > 0.5 ? Math.pow(idx / 100, 1 / yrs) - 1 : NaN, xirr: xirrVal, vol: vol, volBasis: volBasis,
      contributions: last ? last.contrib : NaN, nav: last ? last.nav : NaN, gain: last ? last.gain : NaN, spanDays: spanDays, verifiedDays: usedDays, flows: flows,
      best: used.length ? used.reduce((a, b) => b.r > a.r ? b : a) : null, worst: used.length ? used.reduce((a, b) => b.r < a.r ? b : a) : null,
      hitRate: used.length ? used.filter(i => i.r > 0).length / used.length : NaN, avgIntervalDays: avgLen, unverified: intervals.filter(i => !i.verified).length, coarse: coarse, reportedCount: used.filter(i => i.src === 'statement').length, estimatedDays: estDays };
  }
  function sd(a) { if (a.length < 2) return NaN; const m = sum(a) / a.length; return Math.sqrt(sum(a, x => (x - m) * (x - m)) / (a.length - 1)); }
  /** Annualised money-weighted return (XIRR). cfs: [{date, amt}] with at least one negative and one positive. */
  function xirr(cfs) {
    if (cfs.length < 2) return NaN; const t0 = dayNum(cfs[0].date);
    if (!cfs.some(c => c.amt < 0) || !cfs.some(c => c.amt > 0)) return NaN;
    const f = r => sum(cfs, c => c.amt / Math.pow(1 + r, (dayNum(c.date) - t0) / 365));
    let lo = -0.99, hi = 10, flo = f(lo), fhi = f(hi);
    if (!fin(flo) || !fin(fhi) || flo * fhi > 0) return NaN;
    for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2, fm = f(mid); if (Math.abs(fm) < 1e-7) return mid; if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; } }
    return (lo + hi) / 2;
  }
  /** Index a benchmark's closing prices to 100 at each NAV point date (last close on or before). hist: [[iso, close],...] ascending. */
  function benchmarkIndex(dates, hist) {
    if (!hist || !hist.length) return [];
    const val = d => { let lo = 0, hi = hist.length - 1, ans = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (hist[m][0] <= d) { ans = m; lo = m + 1; } else hi = m - 1; } return ans >= 0 ? hist[ans][1] : NaN; };
    const v0 = val(dates[0]); if (!fin(v0) || !v0) return [];
    return dates.map(d => { const v = val(d); return fin(v) ? v / v0 * 100 : NaN; });
  }
  /** Parse a NAV time series CSV (Flex query, PortfolioAnalyst export or a hand-made file). Returns {points, note} or throws. */
  function parseNavSeries(text) {
    const rows = parseCSV(String(text).replace(/^\uFEFF/, '')); if (rows.length < 3) throw new Error('No table found.');
    let hi = rows.findIndex(r => r.filter(c => c.trim()).length >= 2 && r.some(c => /date/i.test(c)) && r.some(c => /nav|net asset|equity|total|value|balance/i.test(c)));
    if (hi < 0) throw new Error('Could not find a header row with a date column and a NAV or total column.');
    const h = rows[hi].map(x => x.trim());
    const di = h.findIndex(x => /^(report ?date|date|as of|period end|month)$/i.test(x)) >= 0 ? h.findIndex(x => /^(report ?date|date|as of|period end|month)$/i.test(x)) : h.findIndex(x => /date/i.test(x));
    let vi = h.findIndex(x => /^(ending nav|end nav|nav|net asset value|net liquidation|total)$/i.test(x));
    if (vi < 0) vi = h.findIndex(x => /nav|net asset|equity|total|value|balance/i.test(x) && !/date/i.test(x));
    if (di < 0 || vi < 0) throw new Error('Could not identify the date and NAV columns.');
    const pts = []; rows.slice(hi + 1).forEach(r => { const d = parseDate(r[di]) || parseDate(String(r[di] || '').replace(/\//g, '-')); const v = num(r[vi]); if (d && fin(v)) pts.push({ date: d, nav: v }); });
    if (pts.length < 2) throw new Error('Fewer than two usable rows.');
    pts.sort((a, b) => a.date < b.date ? -1 : 1);
    return { points: pts, note: 'Used column "' + h[di] + '" for dates and "' + h[vi] + '" for NAV.' };
  }

  /** Where the imported statements stop, how old that is, and which statement to import next. */
  function trackedThrough(snaps, today) {
    const ss = (snaps || []).filter(s => s && s.to); if (!ss.length) return null;
    const last = ss.reduce((a, b) => b.to > a.to ? b : a); const through = last.to; const lastFrom = last.from || last.to;
    const since = ss.reduce((a, b) => (b.from || b.to) < a ? (b.from || b.to) : a, ss[0].from || ss[0].to);
    const days = today ? Math.max(0, daysBetween(through, today)) : NaN;
    let latestTx = ''; ss.forEach(s => (s.ledger || []).forEach(e => { if (e.date && e.date > latestTx) latestTx = e.date; }));
    const f = /^(\d{4})-(\d{2})-(\d{2})/.exec(lastFrom), t = /^(\d{4})-(\d{2})-(\d{2})/.exec(through);
    const nextFrom = addDays(through, 1); let nextTo, kind = 'other';
    if (f && t && f[1] === t[1] && f[2] === t[2] && +f[3] === 1 && +t[3] === lastDayOfMonth(+t[1], +t[2])) { // a whole month: the next month
      kind = 'monthly'; const y = +t[2] === 12 ? +t[1] + 1 : +t[1], m = +t[2] === 12 ? 1 : +t[2] + 1; nextTo = isoOf(y, m, lastDayOfMonth(y, m));
    } else if (f && t && f[1] === t[1] && f[2] === '01' && f[3] === '01' && t[2] === '12' && t[3] === '31') { kind = 'annual'; nextTo = (+t[1] + 1) + '-12-31'; }
    else nextTo = addDays(nextFrom, Math.max(0, daysBetween(lastFrom, through)));
    const status = !fin(days) ? 'unknown' : days <= 35 ? 'current' : days <= 70 ? 'due' : 'overdue';
    const nl = periodLabel(nextFrom, nextTo); const desc = kind === 'annual' ? 'the ' + nl + ' annual statement' : kind === 'monthly' ? 'the ' + nl + ' monthly statement' : 'a statement for ' + nl;
    return { through: through, since: since, days: days, status: status, latestTx: latestTx, kind: kind, next: { from: nextFrom, to: nextTo, label: nl, desc: desc } };
  }
  function agoText(d) { return !fin(d) ? '' : d === 0 ? 'today' : d === 1 ? '1 day ago' : d + ' days ago'; }

  BL.core = { sanitizeIBKR: sanitizeIBKR, PARSER_VERSION: PARSER_VERSION, trackedThrough: trackedThrough, agoText: agoText, fin: fin, num: num, esc: esc, sum: sum, parseDate: parseDate, parseTime: parseTime, dayNum: dayNum, daysBetween: daysBetween, addDays: addDays, fmtDay: fmtDay, periodLabel: periodLabel, MON3: MON3,
    csvCell: csvCell, safeUrl: safeUrl, cleanJson: cleanJson, parseCSV: parseCSV, isIBKR: isIBKR, parseIBKR: parseIBKR, scrubDesc: scrubDesc,
    entryKey: entryKey, combineLedgers: combineLedgers, describeEntry: describeEntry, ledgerSummary: ledgerSummary, makeSnap: makeSnap, checkSnap: checkSnap,
    chooseSegments: chooseSegments, coverage: coverage, performance: performance, xirr: xirr, benchmarkIndex: benchmarkIndex, parseNavSeries: parseNavSeries, sd: sd };
  if (typeof module !== 'undefined' && module.exports) module.exports = BL;
})(typeof window !== 'undefined' ? window : globalThis);
