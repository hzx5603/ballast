/* Research view, plus Risk, Goals, Events and Tax notes tabs in the Toolkit. Loaded after app.js.
 * Everything here describes what the data shows. Nothing is a recommendation. */
(function () {
  'use strict';
  const A = BL.app, C = BL.core, ui = A.ui, esc = A.esc, money = A.money, smoney = A.smoney, spct = A.spct, pct = A.pct, cls = A.cls, fin = Number.isFinite, lineChart = A.lineChart;
  const S = () => A.S(); const $ = s => document.querySelector(s);
  const ready = () => BL.cloud.apiConfigured() && BL.cloud.hasIdToken();
  const api = (p, b) => BL.cloud.api(p, b);
  const SYM = /^[A-Za-z0-9.\-=^_]{1,20}$/;
  const today = () => new Date().toISOString().slice(0, 10);
  const px = A.px, MINUS = A.MINUS;
  const f1 = v => fin(v) ? v.toFixed(1) : '–';
  const c2 = v => fin(v) ? (Math.round(v * 100) / 100 + 0).toFixed(2) : '–';
  const pz = (v, d) => pct(Math.abs(v) < 0.5 * Math.pow(10, -(d || 0)) ? 0 : v, d);
  const p1 = v => fin(v) ? spct(v * 100, 1) : '–';
  function needAccess(what) {
    return '<div class="banner info">' + (BL.cloud.apiConfigured() ? esc(what) + ' needs your permission for the market data service. <button class="link" data-a="id-signin">Allow market data</button>' : esc(what) + ' needs the market data service, which is not set up yet. See README step 3.') + '</div>';
  }
  const heldPos = sym => S().positions.find(p => p.symbol.toUpperCase() === sym || (p.yahoo || '').toUpperCase() === sym || A.yahooGuess(p).toUpperCase() === sym);
  const tile = (label, value, sub, klass) => '<div class="tile"><span class="lab">' + label + '</span><b class="' + (klass || '') + '">' + value + '</b>' + (sub ? '<span class="sub">' + sub + '</span>' : '') + '</div>';

  /* ============================================================= Research */
  const rs = () => ui.rs = ui.rs || { sym: '', win: 252, busy: false, err: '', note: '', res: null, ai: null, aiBusy: false, aiErr: '', recent: [] };
  async function analyse(sym) {
    const r = rs(); sym = String(sym || '').trim().toUpperCase(); r.err = ''; r.note = ''; r.ai = null; r.aiErr = '';
    if (!SYM.test(sym)) { r.err = 'Enter a valid symbol, for example VOO or 9988.HK.'; A.render(true); return; }
    r.busy = true; r.sym = sym; A.render(true);
    const held = heldPos(sym);
    const [h, f, n] = await Promise.allSettled([api('/history', { symbol: sym, range: '5y', interval: '1d' }), api('/fundamentals', { symbol: sym }), api('/news', { targets: [{ symbol: sym, name: held ? held.desc : '' }], days: 14 })]);
    const res = { sym: sym, at: Date.now() };
    if (h.status === 'fulfilled') {
      res.name = h.value.name; res.currency = h.value.currency; res.exchange = h.value.exchange; res.dividends = h.value.dividends;
      res.bars = h.value.points.map(x => ({ t: x[0], o: x[1], h: x[2], l: x[3], c: x[4], v: x[5] }));
      try { res.tech = BL.ta.technical(res.bars); } catch (e) { res.techErr = e.message; }
    } else r.note += 'Price history: ' + h.reason.message + '. ';
    if (f.status === 'fulfilled') { res.fund = f.value; res.name = res.name || f.value.name; res.fa = BL.fa.score(Object.assign({}, f.value, { price: f.value.price || (res.tech && res.tech.last.close) })); }
    else r.note += 'Fundamentals: ' + f.reason.message + '. ';
    if (n.status === 'fulfilled') res.news = (n.value.news || []).slice(0, 8);
    if (!res.bars && !res.fund) { r.err = r.note || 'Nothing came back for ' + sym + '.'; r.note = ''; }
    else { r.res = res; r.recent = [sym].concat(r.recent.filter(x => x !== sym)).slice(0, 8); }
    r.busy = false; A.render(true);
  }
  function csvBars(text) {
    const rows = C.parseCSV(String(text).replace(/^\uFEFF/, '')); const h = rows[0].map(x => x.trim().toLowerCase());
    const ix = k => h.findIndex(x => x === k); const di = ix('date'), oi = ix('open'), hi = ix('high'), li = ix('low'), ci = ix('close'), vi = ix('volume');
    if (di < 0 || ci < 0 || hi < 0 || li < 0) throw new Error('Expected columns Date, Open, High, Low, Close, Volume (the layout of Yahoo Finance\'s download).');
    const bars = []; rows.slice(1).forEach(r => { const t = C.parseDate(r[di]); const c = C.num(r[ci]); if (t && fin(c)) bars.push({ t: t, o: fin(C.num(r[oi])) ? C.num(r[oi]) : c, h: C.num(r[hi]), l: C.num(r[li]), c: c, v: fin(C.num(r[vi])) ? C.num(r[vi]) : 0 }); });
    bars.sort((a, b) => a.t < b.t ? -1 : 1); return bars;
  }

  function techChart(res, win) {
    const bars = res.bars, T = res.tech, n = bars.length, from = Math.max(0, n - win), W = 760, pl = 8, pr = 54;
    const X = i => pl + (W - pl - pr) * (i - from) / Math.max(1, n - 1 - from);
    const rng = (arr, a, b) => { let lo = Infinity, hi = -Infinity; for (let i = a; i < b; i++) { if (fin(arr[i])) { if (arr[i] < lo) lo = arr[i]; if (arr[i] > hi) hi = arr[i]; } } return [lo, hi]; };
    const P = { y: 8, h: 230 }, V = { y: 244, h: 38 }, R = { y: 292, h: 76 }, M = { y: 380, h: 84 }, H = 486;
    const sc = (pn, lo, hi) => v => pn.y + pn.h * (1 - (v - lo) / ((hi - lo) || 1));
    const s = T.series; const hiA = bars.map(b => b.h), loA = bars.map(b => b.l);
    let [plo, phi] = [rng(loA, from, n)[0], rng(hiA, from, n)[1]]; const padp = (phi - plo) * 0.05; plo -= padp; phi += padp; const Yp = sc(P, plo, phi);
    const path = (arr, Y) => { let d = '', pen = false; for (let i = from; i < n; i++) { if (!fin(arr[i])) { pen = false; continue; } d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(arr[i]).toFixed(1) + ' '; pen = true; } return d; };
    let g = '';
    for (let k = 0; k <= 3; k++) { const v = plo + (phi - plo) * k / 3; g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Yp(v).toFixed(1) + '" y2="' + Yp(v).toFixed(1) + '" stroke="var(--line-soft)"/><text x="' + (W - pr + 4) + '" y="' + (Yp(v) + 4).toFixed(1) + '" font-size="10.5" fill="var(--muted)">' + esc(px(v)) + '</text>'; }
    // Bollinger band
    let band = ''; const up = [], lo = []; for (let i = from; i < n; i++) if (fin(s.bbUp[i])) { up.push(X(i).toFixed(1) + ' ' + Yp(s.bbUp[i]).toFixed(1)); lo.push(X(i).toFixed(1) + ' ' + Yp(s.bbLo[i]).toFixed(1)); }
    if (up.length > 2) band = '<path d="M' + up.join(' L') + ' L' + lo.reverse().join(' L') + ' Z" fill="var(--c1)" opacity="0.08"/>';
    let lvl = ''; T.levels.support.forEach(l => { lvl += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Yp(l.price).toFixed(1) + '" y2="' + Yp(l.price).toFixed(1) + '" stroke="var(--gain)" stroke-dasharray="4 4" opacity="0.7"><title>Support ' + esc(px(l.price)) + ', touched ' + l.touches + ' times</title></line>'; });
    T.levels.resistance.forEach(l => { lvl += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Yp(l.price).toFixed(1) + '" y2="' + Yp(l.price).toFixed(1) + '" stroke="var(--loss)" stroke-dasharray="4 4" opacity="0.7"><title>Resistance ' + esc(px(l.price)) + ', touched ' + l.touches + ' times</title></line>'; });
    const close = bars.map(b => b.c);
    const price = band + lvl + '<path d="' + path(s.sma200, Yp) + '" fill="none" stroke="var(--c2)" stroke-width="1.5"/><path d="' + path(s.sma50, Yp) + '" fill="none" stroke="var(--c4)" stroke-width="1.5"/><path d="' + path(s.sma20, Yp) + '" fill="none" stroke="var(--c3)" stroke-width="1.2"/><path d="' + path(close, Yp) + '" fill="none" stroke="var(--ink)" stroke-width="1.6" stroke-linejoin="round"/>';
    // volume
    const vols = bars.map(b => b.v); const vmax = rng(vols, from, n)[1] || 1; const bw = Math.max(1, (W - pl - pr) / Math.max(1, n - from) - 0.6); let vb = '';
    for (let i = from; i < n; i++) { const hh = V.h * vols[i] / vmax; vb += '<rect x="' + (X(i) - bw / 2).toFixed(1) + '" y="' + (V.y + V.h - hh).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + hh.toFixed(1) + '" fill="' + (i && close[i] >= close[i - 1] ? 'var(--gain)' : 'var(--loss)') + '" opacity="0.45"/>'; }
    // rsi
    const Yr = sc(R, 0, 100); let rsi = '<rect x="' + pl + '" y="' + Yr(70).toFixed(1) + '" width="' + (W - pl - pr) + '" height="' + (Yr(30) - Yr(70)).toFixed(1) + '" fill="var(--line-soft)" opacity="0.6"/>';
    [30, 70].forEach(v => { rsi += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Yr(v).toFixed(1) + '" y2="' + Yr(v).toFixed(1) + '" stroke="var(--muted)" stroke-dasharray="2 3"/><text x="' + (W - pr + 4) + '" y="' + (Yr(v) + 4).toFixed(1) + '" font-size="10.5" fill="var(--muted)">' + v + '</text>'; });
    rsi += '<path d="' + path(s.rsi, Yr) + '" fill="none" stroke="var(--c1)" stroke-width="1.4"/>';
    // macd
    const [mlo, mhi] = [Math.min(rng(s.macd, from, n)[0], rng(s.macdHist, from, n)[0], rng(s.macdSignal, from, n)[0]), Math.max(rng(s.macd, from, n)[1], rng(s.macdHist, from, n)[1], rng(s.macdSignal, from, n)[1])]; const Ym = sc(M, mlo, mhi); let mb = '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Ym(0).toFixed(1) + '" y2="' + Ym(0).toFixed(1) + '" stroke="var(--muted)" stroke-dasharray="2 3"/>';
    for (let i = from; i < n; i++) if (fin(s.macdHist[i])) { const y0 = Ym(0), y1 = Ym(s.macdHist[i]); mb += '<rect x="' + (X(i) - bw / 2).toFixed(1) + '" y="' + Math.min(y0, y1).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.abs(y1 - y0).toFixed(1) + '" fill="' + (s.macdHist[i] >= 0 ? 'var(--gain)' : 'var(--loss)') + '" opacity="0.5"/>'; }
    mb += '<path d="' + path(s.macd, Ym) + '" fill="none" stroke="var(--c1)" stroke-width="1.3"/><path d="' + path(s.macdSignal, Ym) + '" fill="none" stroke="var(--c2)" stroke-width="1.3"/>';
    // x labels
    let xl = ''; const step = Math.max(1, Math.round((n - from) / 6)); for (let i = from; i < n; i += step) xl += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 4) + '" font-size="10.5" text-anchor="middle" fill="var(--muted)">' + esc(bars[i].t.slice(2, 7).replace('-', '/')) + '</text>';
    const lab = (t, y) => '<text x="' + (pl + 2) + '" y="' + (y + 11) + '" font-size="10.5" fill="var(--muted)">' + t + '</text>';
    ui.rs.geo = { from: from, n: n, W: W, pl: pl, pr: pr };
    return '<div class="tchart"><div class="readout" id="rs-read" aria-live="polite">Move over the chart for values on each day.</div><svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Price chart with moving averages, volume, RSI and MACD">' + g + price + lab('Price, 20 / 50 / 200-day averages, Bollinger band, support and resistance', P.y) + vb + lab('Volume', V.y) + rsi + lab('RSI (14)', R.y) + mb + lab('MACD (12, 26, 9)', M.y) + xl + '<line id="rs-xh" x1="0" x2="0" y1="0" y2="' + (H - 14) + '" stroke="var(--muted)" opacity="0" pointer-events="none"/><rect class="xh-hit" x="' + pl + '" y="0" width="' + (W - pl - pr) + '" height="' + (H - 14) + '" fill="transparent"/></svg>' +
      '<div class="legend2"><span class="lg2"><i style="background:var(--ink)"></i>Close</span><span class="lg2"><i style="background:var(--c3)"></i>20-day</span><span class="lg2"><i style="background:var(--c4)"></i>50-day</span><span class="lg2"><i style="background:var(--c2)"></i>200-day</span><span class="lg2"><i style="background:var(--gain)"></i>Support</span><span class="lg2"><i style="background:var(--loss)"></i>Resistance</span></div></div>';
  }
  document.addEventListener('mousemove', e => {
    const hit = e.target.closest && e.target.closest('.tchart svg'); const r = ui.rs; if (!hit || !r || !r.res || !r.res.tech || !r.geo) return;
    const rect = hit.getBoundingClientRect(); const g = r.geo; const x = (e.clientX - rect.left) / rect.width * g.W; const i = Math.max(g.from, Math.min(g.n - 1, Math.round(g.from + (x - g.pl) / (g.W - g.pl - g.pr) * (g.n - 1 - g.from))));
    const b = r.res.bars[i], s = r.res.tech.series; const line = $('#rs-xh'), out = $('#rs-read'); if (!line || !out) return;
    const xx = g.pl + (g.W - g.pl - g.pr) * (i - g.from) / Math.max(1, g.n - 1 - g.from); line.setAttribute('x1', xx); line.setAttribute('x2', xx); line.setAttribute('opacity', '0.6');
    const chg = i ? (b.c / r.res.bars[i - 1].c - 1) * 100 : NaN; out.textContent = b.t + '   Close ' + px(b.c) + (fin(chg) ? ' (' + (chg >= 0 ? '+' : MINUS) + Math.abs(chg).toFixed(2) + '%)' : '') + '   High ' + px(b.h) + '   Low ' + px(b.l) + '   Volume ' + A.nf0.format(b.v) + (fin(s.rsi[i]) ? '   RSI ' + s.rsi[i].toFixed(0) : '') + (fin(s.sma50[i]) ? '   50-day ' + px(s.sma50[i]) : '') + (fin(s.sma200[i]) ? '   200-day ' + px(s.sma200[i]) : '');
  });

  const VIEWCLS = { bullish: 'good', bearish: 'weak', neutral: 'ok' };
  function techPanel(res) {
    const T = res.tech; if (!T) return '<div class="banner info">' + esc(res.techErr || 'No price history to analyse.') + '</div>';
    const cur = T.last.close, i = T.ind, gauge = '<div class="gauge" role="img" aria-label="Score ' + T.score + ' on a scale from minus 100 to plus 100"><div class="gmid"></div><i style="left:' + ((T.score + 100) / 2) + '%"></i></div>';
    const rows = [['Price', px(cur)], ['20-day average', px(i.sma20)], ['50-day average', px(i.sma50)], ['200-day average', fin(i.sma200) ? px(i.sma200) : 'needs 200 days'], ['RSI (14)', f1(i.rsi)], ['MACD vs signal', fin(i.macd) ? i.macd.toFixed(2) + ' vs ' + i.macdSignal.toFixed(2) : '–'], ['Bollinger %B', fin(i.bbPctB) ? i.bbPctB.toFixed(2) : '–'], ['ADX (trend strength)', f1(i.adx)], ['Typical daily range (ATR)', fin(i.atrPct) ? i.atrPct.toFixed(1) + '% of price' : '–'], ['30-day volatility, yearly', fin(T.volatility.realised30) ? pct(T.volatility.realised30 * 100, 0) : '–']];
    const perf = [['1 month', T.perf.m1], ['3 months', T.perf.m3], ['6 months', T.perf.m6], ['1 year', T.perf.y1], ['This year', T.perf.ytd]];
    const lv = (arr, klass) => arr.length ? arr.map(l => '<span class="tag ' + klass + '">' + esc(px(l.price)) + ' <small>(' + l.touches + ' touches)</small></span>').join(' ') : '<span class="muted">none nearby</span>';
    const rangePos = (cur - T.range.lo52) / ((T.range.hi52 - T.range.lo52) || 1) * 100;
    return '<section class="sec"><div class="sec-head"><h2>Technical picture</h2><span class="sub">As of ' + esc(T.last.date) + '</span></div>' +
      '<div class="row" style="align-items:flex-start;gap:28px"><div style="min-width:240px;flex:1"><div style="font-size:22px;font-weight:650">' + esc(T.label) + '</div><div class="sub">Score ' + (T.score > 0 ? '+' : '') + T.score + ' of ±100, a tally of the signals below</div>' + gauge +
      '<div class="sub" style="margin-top:12px">52-week range</div><div class="dv range" aria-hidden="true"><i style="left:' + rangePos.toFixed(0) + '%"></i></div><div class="row" style="justify-content:space-between"><span class="sub">' + esc(px(T.range.lo52)) + '</span><span class="sub">' + esc(px(T.range.hi52)) + '</span></div>' +
      '<div class="sub" style="margin-top:10px">Nearby support</div><div class="chips">' + lv(T.levels.support, 'good') + '</div><div class="sub" style="margin-top:6px">Nearby resistance</div><div class="chips">' + lv(T.levels.resistance, 'weak') + '</div></div>' +
      '<div style="flex:1.4;min-width:300px">' + T.signals.map(sg => '<div class="sig"><span class="rt ' + VIEWCLS[sg.view] + '" title="' + sg.view + '"></span><div><b>' + esc(sg.name) + '</b> <span class="muted">' + sg.view + '</span><div class="sub">' + esc(sg.note) + '</div></div></div>').join('') + '</div></div>' +
      '<div class="two" style="margin-top:16px"><div><table class="t"><tbody>' + rows.map(r => '<tr><td class="muted">' + r[0] + '</td><td class="num">' + esc(r[1]) + '</td></tr>').join('') + '</tbody></table></div><div><table class="t"><tbody>' + perf.map(r => '<tr><td class="muted">' + r[0] + '</td><td class="num ' + cls(r[1]) + '">' + p1(r[1]) + '</td></tr>').join('') + '<tr><td class="muted">Deepest fall in this data</td><td class="num loss">' + p1(T.drawdown.max) + '</td></tr><tr><td class="muted">Now vs highest close</td><td class="num ' + cls(T.drawdown.current) + '">' + p1(T.drawdown.current) + '</td></tr></tbody></table></div></div></section>';
  }
  function factPanel(res) {
    const F = res.fa, f = res.fund; if (!F) return '<section class="sec"><div class="sec-head"><h2>Fundamentals</h2></div><p class="sub">Fundamentals were not available for this symbol.</p></section>';
    const grp = g => '<div class="panel" style="padding:12px 14px"><div class="row" style="justify-content:space-between"><b>' + esc(g.name) + '</b><span class="sub">' + (g.score == null ? 'n/a' : g.score + ' / 100') + '</span></div>' + (g.score != null ? '<div class="meter"><i style="width:' + g.score + '%"></i></div>' : '') + '<table class="t"><tbody>' + g.metrics.map(m => '<tr><td><span class="rt ' + (m.rating || 'none') + '" title="' + (m.rating || 'not rated') + '"></span> ' + esc(m.label) + (m.hint ? '<span class="desc">' + esc(m.hint) + '</span>' : '') + '</td><td class="num">' + esc(m.text) + '</td></tr>').join('') + '</tbody></table>' + (g.note ? '<div class="sub" style="margin-top:6px">' + esc(g.note) + '</div>' : '') + '</div>';
    const facts = [['Sector', f.sector], ['Industry', f.industry], ['Category', f.category], ['Fund family', f.fundFamily], ['Market cap', fin(f.marketCap) ? BL.fa.big(f.marketCap) : null], ['Beta', fin(f.beta) ? f.beta.toFixed(2) : null], ['Next earnings', f.nextEarnings], ['Next ex-dividend', f.exDividendDate], ['Short interest (of float)', fin(f.shortPercentFloat) ? pct(f.shortPercentFloat * 100, 1) : null]].filter(x => x[1]);
    return '<section class="sec"><div class="sec-head"><h2>Fundamentals</h2><span class="sub">' + (F.kind === 'fund' ? 'Fund' : 'Company') + ' scorecard: ' + esc(F.label) + (F.overall != null ? ' (' + F.overall + ' / 100)' : '') + '</span></div>' +
      (f.summary ? '<p style="max-width:80ch;margin-bottom:10px">' + esc(f.summary) + '</p>' : '') + (facts.length ? '<div class="chips" style="margin-bottom:12px">' + facts.map(x => '<span class="tag">' + esc(x[0]) + ': <b>' + esc(x[1]) + '</b></span>').join(' ') + '</div>' : '') +
      '<div class="cards">' + F.groups.map(grp).join('') + '</div>' +
      (f.topHoldings && f.topHoldings.length ? '<div class="sub" style="margin:12px 0 4px">Largest holdings</div><div class="chips">' + f.topHoldings.map(h => '<span class="tag">' + esc(h.symbol || h.name) + (fin(h.weight) ? ' ' + (h.weight * 100).toFixed(1) + '%' : '') + '</span>').join(' ') + '</div>' : '') +
      '<p class="sub" style="margin-top:10px;max-width:80ch">Ratings use generic rules of thumb. Banks, insurers, utilities, property companies and fast-growing firms are normally judged on different measures, so compare with similar companies. Data comes from Yahoo Finance and can be missing or out of date.</p></section>';
  }
  /* Compare this symbol against a chosen industry benchmark (a sector ETF proxy), the broad market, and up to four
   * companies the user picks by hand. There is no peer-list data source wired up (Yahoo's unofficial modules used
   * here do not include one), so "rivals" means whatever tickers the user types in. */
  const SECTOR_ETF = { Technology: ['XLK', 'Technology sector (XLK)'], 'Financial Services': ['XLF', 'Financials sector (XLF)'], Healthcare: ['XLV', 'Health care sector (XLV)'], 'Consumer Cyclical': ['XLY', 'Consumer discretionary sector (XLY)'], 'Consumer Defensive': ['XLP', 'Consumer staples sector (XLP)'], Industrials: ['XLI', 'Industrials sector (XLI)'], Energy: ['XLE', 'Energy sector (XLE)'], Utilities: ['XLU', 'Utilities sector (XLU)'], 'Basic Materials': ['XLB', 'Materials sector (XLB)'], 'Real Estate': ['XLRE', 'Real estate sector (XLRE)'], 'Communication Services': ['XLC', 'Communication services sector (XLC)'] };
  const CMP_METRICS = ['price', 'marketCap', 'trailingPE', 'forwardPE', 'pegRatio', 'priceToBook', 'dividendYield', 'revenueGrowth', 'grossMargin', 'profitMargin', 'roe', 'debtToEquity', 'beta'];
  const cmp = () => rs().cmp = rs().cmp || { input: '', tickers: [], bench: true, spx: false, busy: false, err: '', data: {}, at: 0 };
  async function oneReturn1y(sym) {
    try { const h = await api('/history', { symbol: sym, range: '1y', interval: '1d' }); const pts = h.points; if (!pts.length) return null; const c0 = pts[0][4], c1 = pts[pts.length - 1][4]; return fin(c0) && fin(c1) && c0 ? c1 / c0 - 1 : null; } catch (e) { return null; }
  }
  async function runCompare(res) {
    const c = cmp(); if (c.busy) return; const sector = res.fund && res.fund.sector;
    const targets = [{ sym: res.sym, label: res.sym }].concat(c.tickers.slice(0, 4).map(t => ({ sym: t, label: t })));
    if (c.bench && sector && SECTOR_ETF[sector]) targets.push({ sym: SECTOR_ETF[sector][0], label: SECTOR_ETF[sector][1] });
    if (c.spx) targets.push({ sym: '^GSPC', label: 'S&P 500' });
    c.busy = true; c.err = ''; A.render(true);
    await Promise.all(targets.map(async t => {
      const [f, r1] = await Promise.allSettled([api('/fundamentals', { symbol: t.sym }), oneReturn1y(t.sym)]);
      c.data[t.sym] = { label: t.label, fund: f.status === 'fulfilled' ? f.value : null, ret1y: r1.status === 'fulfilled' ? r1.value : null, err: f.status === 'rejected' ? f.reason.message : null };
    }));
    c.busy = false; c.at = Date.now(); A.render(true);
  }
  function comparePanel(res) {
    const c = cmp(); const sector = res.fund && res.fund.sector; const hasBench = sector && SECTOR_ETF[sector];
    const chips = c.tickers.map((t, i) => '<span class="chip" style="cursor:default">' + esc(t) + ' <button class="link" data-a="rs-cmp-del" data-i="' + i + '" aria-label="Remove ' + esc(t) + '" style="margin-left:2px">×</button></span>').join('');
    let table = '';
    if (c.at) {
      const order = [res.sym].concat(c.tickers.slice(0, 4)).concat(hasBench && c.bench ? [SECTOR_ETF[sector][0]] : []).concat(c.spx ? ['^GSPC'] : []);
      const cols = order.filter(s => c.data[s]);
      if (cols.length) {
        const head = '<tr><th>Figure</th>' + cols.map(s => '<th class="num">' + esc(c.data[s].label) + '</th>').join('') + '</tr>';
        const rows = [['1-year price return', s => p1(c.data[s].ret1y)]].concat(A.FUND_METRICS.filter(m => CMP_METRICS.includes(m[0])).map(m => [m[1], s => { const f = c.data[s].fund; return f ? A.fundMetricFmt(m[2])(f[m[0]]) : '<span class="muted" title="' + esc(c.data[s].err || '') + '">–</span>'; }]));
        const body = rows.map(r => '<tr><td>' + esc(r[0]) + '</td>' + cols.map(s => '<td class="num">' + r[1](s) + '</td>').join('') + '</tr>').join('');
        table = '<div class="scroll"><table class="t"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div><p class="sub" style="margin-top:8px">Pulled ' + esc(A.ago(c.at)) + '. Yahoo Finance is unofficial and figures can be missing, delayed or wrong. Not advice.</p>';
      } else table = A.empty('Nothing came back.');
    }
    return '<section class="sec"><div class="sec-head"><h2>Compare</h2><span class="sub">Against a sector benchmark, the market, or companies you name</span></div>' +
      '<p class="sub" style="max-width:78ch">There is no reliable free source of "who are the rivals" for a stock, so pick them yourself. The industry option uses a large sector ETF as a stand-in for the whole industry, which is rougher for a narrow sub-industry than for the sector as a whole.</p>' +
      '<div class="row" style="margin:10px 0"><input class="in" id="rs-cmp-in" placeholder="Add a ticker, for example MSFT" style="width:200px" maxlength="20"><button class="btn ghost sm" data-a="rs-cmp-add">Add</button>' + chips + '</div>' +
      '<div class="row" style="margin-bottom:10px">' + (hasBench ? '<label class="sub"><input type="checkbox" id="rs-cmp-bench" ' + (c.bench ? 'checked' : '') + '> Include industry (' + esc(SECTOR_ETF[sector][1]) + ')</label>' : '<span class="sub muted">No sector detected for this symbol, so no industry option.</span>') +
      '<label class="sub" style="margin-left:16px"><input type="checkbox" id="rs-cmp-spx" ' + (c.spx ? 'checked' : '') + '> Include the S&amp;P 500</label></div>' +
      (c.err ? '<p class="loss" style="margin-bottom:8px">' + esc(c.err) + '</p>' : '') +
      '<button class="btn" data-a="rs-cmp-go"' + (c.busy ? ' disabled' : '') + '>' + (c.busy ? 'Comparing…' : 'Compare') + '</button>' + table + '</section>';
  }
  function aiPanel(res) {
    const r = rs(); const a = r.ai; const list = (t, arr) => arr && arr.length ? '<h4>' + t + '</h4><ul>' + arr.slice(0, 5).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '';
    return '<section class="sec"><div class="sec-head"><h2>Written read</h2><span class="sub">By an AI model, from the figures on this page only</span></div>' +
      (a ? '<div class="aiout">' + (a.summary ? '<p>' + esc(a.summary) + '</p>' : '') + list('What looks good', a.whatLooksGood) + list('What looks weak', a.whatLooksWeak) + list('Risks to check', a.risksToCheck) + list('Questions before acting', a.questionsBeforeActing) + list('Missing information', a.dataGaps) + '</div>' : '') +
      (r.aiErr ? '<p class="loss">' + esc(r.aiErr) + '</p>' : '') +
      '<div class="row"><button class="btn ghost" data-a="rs-ai"' + (r.aiBusy ? ' disabled' : '') + '>' + (r.aiBusy ? 'Thinking…' : a ? 'Write it again' : 'Write a plain-language read') + '</button><span class="sub">Sends this symbol\'s public figures and headlines. Nothing about your portfolio. Not advice, and it can be wrong.</span></div></section>';
  }
  function vResearch() {
    const r = rs(); const st = S(); const res = r.res;
    const opts = Array.from(new Set(st.positions.filter(p => !A.isDeriv(p)).map(p => p.yahoo || A.yahooGuess(p)).concat(st.watch.map(w => w.yahoo || w.symbol)).concat(r.recent)));
    const W = [['126', '6 months'], ['252', '1 year'], ['504', '2 years'], ['1260', '5 years']];
    let out = '';
    if (r.busy) out = '<p class="sub" style="margin-top:20px">Loading price history, fundamentals and headlines for ' + esc(r.sym) + '…</p>';
    else if (res) {
      const held = heldPos(res.sym); const price = res.tech ? res.tech.last.close : (res.fund && res.fund.price); const dayChg = res.tech ? res.tech.last.close / res.tech.last.prev - 1 : NaN;
      const onWatch = st.watch.some(w => w.symbol === res.sym);
      out = '<div class="sec" style="margin-top:18px"><div class="row" style="justify-content:space-between;align-items:flex-start"><div><h2 style="font-size:22px">' + esc(res.sym) + ' <span class="muted" style="font-weight:400;font-size:16px">' + esc(res.name || '') + '</span></h2><div class="sub">' + esc(res.exchange || '') + (res.currency ? ' · ' + esc(res.currency) : '') + '</div></div><div style="text-align:right"><div class="nav-val" style="font-size:26px">' + (fin(price) ? esc(px(price)) : '–') + '</div><div class="' + cls(dayChg) + '">' + p1(dayChg) + ' on the day</div></div></div>' +
        '<div class="row" style="margin-top:10px">' + (held ? '<span class="tag flag">You hold this: ' + pct(A.M().rows.find(x => x.id === held.id).w, 1) + ' of your portfolio</span>' : '<span class="tag">Not in your portfolio</span>') + (!held && !onWatch ? '<button class="btn ghost sm" data-a="wl-quick" data-sym="' + esc(res.sym) + '" data-note="' + esc(res.name || '') + '">Add to watchlist</button>' : '') + (held && !held.flag ? '<button class="btn ghost sm" data-a="flag" data-id="' + esc(held.id) + '">Flag to track news</button>' : '') + '</div></div>' +
        (r.note ? '<div class="banner" style="margin-top:12px">' + esc(r.note) + 'Showing what could be loaded.</div>' : '') +
        (res.bars ? '<div class="row" style="justify-content:space-between;margin:16px 0 6px"><div class="chips" role="group" aria-label="Chart period">' + W.map(w => '<button class="chip" aria-pressed="' + (String(r.win) === w[0]) + '" data-a="rs-win" data-v="' + w[0] + '">' + w[1] + '</button>').join('') + '</div></div>' + (res.tech ? techChart(res, r.win) : '') : '') +
        techPanel(res) + factPanel(res) +
        (ready() ? comparePanel(res) : '') +
        ((res.news && res.news.length) ? '<section class="sec"><div class="sec-head"><h2>Recent headlines</h2></div>' + res.news.map(n => { const sv = A.sevOf(n); return '<article class="news" style="padding:8px 0"><div>' + (C.safeUrl(n.url) ? '<a href="' + esc(C.safeUrl(n.url)) + '" target="_blank" rel="noopener noreferrer">' + esc(n.title) + '</a>' : esc(n.title)) + '</div><div class="mt">' + (sv ? '<span class="tag ' + sv + '">' + (sv === 'high' ? 'High impact' : 'Worth a look') + '</span>' : '') + '<span>' + esc(n.source || '') + '</span>' + (n.published ? '<span>' + esc(A.ago(n.published)) + '</span>' : '') + '</div></article>'; }).join('') + '</section>' : '') +
        (A.aiOn() || ready() ? aiPanel(res) : '') +
        '<p class="sub" style="margin-top:18px;max-width:80ch">This page describes what the data shows. Indicators are built from past prices and lag them. It is not a forecast, and nothing here is a recommendation to buy, sell or hold. Consider your own goals, costs and taxes, and consult a licensed adviser if unsure.</p></div>';
    }
    return '<div class="panel"><div class="row"><input class="in" id="rs-sym" list="rs-list" placeholder="Symbol, for example VOO, AAPL, 9988.HK" value="' + esc(r.sym) + '" style="width:min(340px,100%)" autocomplete="off" aria-label="Symbol"><datalist id="rs-list">' + opts.map(o => '<option value="' + esc(o) + '">').join('') + '</datalist><button class="btn" data-a="rs-go"' + (r.busy || !ready() ? ' disabled' : '') + '>' + (r.busy ? 'Loading…' : 'Analyse') + '</button>' +
      '<label class="btn ghost" style="cursor:pointer">Use a price file<input type="file" id="rsfile" accept=".csv" hidden></label></div>' +
      '<p class="sub" style="margin-top:8px;max-width:80ch">Works for any listed symbol, whether or not you own it. Use Yahoo Finance symbols (add an exchange suffix such as .L, .HK or .SI where needed). A price file (Date, Open, High, Low, Close, Volume, as downloaded from Yahoo Finance) gives the technical analysis without the market data service.</p>' + (r.err ? '<p class="loss" style="margin-top:8px">' + esc(r.err) + '</p>' : '') + '</div>' + (ready() || res ? '' : needAccess('Looking up a symbol')) + out;
  }

  /* ============================================================= Toolkit: Risk */
  const rk = () => ui.rk = ui.rk || { busy: false, msg: '', hist: {}, bench: null, miss: [], at: 0 };
  async function loadRisk() {
    const r = rk(); r.busy = true; r.hist = {}; r.miss = []; r.msg = 'Starting…'; A.render(true);
    const m = A.M(); const list = m.rows.filter(x => !A.isDeriv(x) && x.cls !== 'Cash').sort((a, b) => b.val - a.val).slice(0, 25);
    for (let i = 0; i < list.length; i++) {
      const p = list[i]; const el = $('#rk-msg'); if (el) el.textContent = 'Loading ' + (i + 1) + ' of ' + list.length + ': ' + p.symbol;
      try { const h = await api('/history', { symbol: p.yahoo || A.yahooGuess(p), range: '2y', interval: '1d' }); r.hist[p.symbol] = h.points.map(x => [x[0], x[6] != null ? x[6] : x[4]]); } catch (e) { r.miss.push(p.symbol); }
    }
    try { const h = await api('/history', { symbol: S().bench || '^GSPC', range: '2y', interval: '1d' }); r.bench = h.points.map(x => [x[0], x[4]]); } catch (e) { r.bench = null; }
    r.busy = false; r.at = Date.now(); A.render(true);
  }
  function riskBody() {
    const r = rk(); const m = A.M(); if (!Object.keys(r.hist).length) return '';
    const w = {}; m.rows.forEach(p => { if (r.hist[p.symbol] && m.nav) w[p.symbol] = (w[p.symbol] || 0) + p.val / m.nav; });
    const k = BL.risk.analyse(r.hist, w, r.bench); if (!k) return '<div class="banner">Not enough overlapping price history to analyse.</div>';
    const rows = k.syms.map((s, i) => ({ s: s, w: k.weights[i], rs: k.riskShare[i], vol: k.vol[i] })).sort((a, b) => b.w - a.w);
    const top = rows.slice(0, 10); const idx = top.map(t => k.syms.indexOf(t.s));
    const hot = []; for (let a = 0; a < k.syms.length; a++) for (let b = a + 1; b < k.syms.length; b++) if (k.corr[a][b] > 0.85) hot.push([k.syms[a], k.syms[b], k.corr[a][b]]);
    const cc = v => { const a = Math.round(Math.max(0, Math.min(1, Math.abs(v))) * 55); return 'background:color-mix(in srgb,var(' + (v >= 0 ? '--c1' : '--flag') + ') ' + a + '%,transparent)'; };
    const curve = k.curve.map(c => ({ d: c.date, v: c.v })); let bench = [];
    if (r.bench) { const bi = C.benchmarkIndex(curve.map(c => c.d), r.bench); bench = curve.map((c, i) => ({ d: c.d, v: bi[i] })); }
    return '<div class="tiles">' + tile('Estimated volatility', pct(k.portVol * 100, 1), 'yearly, from the last ' + (k.days / 252).toFixed(1) + ' years') + tile('Holdings that matter', f1(k.effectiveHoldings), 'by weight, out of ' + k.syms.length) + tile('Independent bets', f1(k.effectiveBets), 'by share of risk') + tile('Average correlation', c2(k.avgCorr), '1 means they move together') +
      tile('A bad day (1 in 20)', pct(k.var95 * 100, 2), 'or worse; worst ' + pct(k.worstDay * 100, 1), 'loss') + tile('Deepest fall', pct(k.maxDrawdown * 100, 1), 'holding today\'s mix throughout', 'loss') + (fin(k.beta) ? tile('Beta', k.beta.toFixed(2), 'vs ' + esc(S().bench || '^GSPC')) : '') + '</div>' +
      (r.miss.length ? '<div class="banner" style="margin-top:12px">No price history for ' + esc(r.miss.join(', ')) + '. They are left out, and cash and missing holdings are treated as carrying no risk.</div>' : '') +
      '<div class="two sec"><section><div class="sec-head"><h2>Where the risk comes from</h2><span class="sub">Share of risk versus share of portfolio</span></div>' + A.hbars(rows.slice(0, 10).map(x => ({ label: x.s, v: Math.max(0, x.rs * 100), color: x.rs > x.w / k.wsum * 1.5 ? 'var(--flag)' : null })), v => v.toFixed(0) + '%') + '<div class="sub" style="margin-top:6px">Amber means a holding adds noticeably more risk than its weight.</div></section>' +
      '<section><div class="sec-head"><h2>Weight against risk</h2></div><table class="t"><thead><tr><th>Holding</th><th class="num">Weight</th><th class="num">Risk share</th><th class="num">Own volatility</th></tr></thead><tbody>' + rows.slice(0, 10).map(x => '<tr><td class="sym">' + esc(x.s) + '</td><td class="num">' + pct(x.w * 100, 1) + '</td><td class="num">' + pz(x.rs * 100, 0) + '</td><td class="num">' + pct(x.vol * 100, 0) + '</td></tr>').join('') + '</tbody></table></section></div>' +
      '<section class="sec"><div class="sec-head"><h2>How much they move together</h2><span class="sub">Correlation of daily returns, ten largest holdings</span></div><div class="scroll"><table class="t heat"><thead><tr><th></th>' + top.map(t => '<th class="num">' + esc(t.s) + '</th>').join('') + '</tr></thead><tbody>' + top.map((t, a) => '<tr><td class="sym">' + esc(t.s) + '</td>' + idx.map((ib, b) => '<td class="num" style="' + cc(k.corr[idx[a]][ib]) + '">' + c2(k.corr[idx[a]][ib]) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' +
      (hot.length ? '<p class="sub" style="margin-top:8px">Very similar pairs (above 0.85): ' + hot.slice(0, 6).map(h => esc(h[0]) + ' and ' + esc(h[1]) + ' (' + h[2].toFixed(2) + ')').join(', ') + '. Owning both adds little diversification.</p>' : '') + '</section>' +
      '<section class="sec"><div class="sec-head"><h2>If you had held today\'s mix</h2><span class="sub">Hypothetical, in each holding\'s own currency, with dividends included where the data has them</span></div>' + lineChart({ h: 200, label: 'Hypothetical growth of 100', fmt: v => v.toFixed(0), series: [{ name: 'Today\'s holdings, held throughout', color: 'var(--ink)', nodots: true, pts: curve }].concat(bench.length ? [{ name: (S().bench || '^GSPC') + ' (price)', color: 'var(--c2)', nodots: true, pts: bench }] : []) }) +
      '<p class="sub" style="margin-top:6px;max-width:80ch">This is a what-if about the past, not your actual results, and it ignores currency moves. The bad-day figure comes from history and real losses can be larger.</p></section>';
  }
  function tkRisk() {
    const r = rk(); if (!A.M().rows.length) return A.onboarding();
    return '<section class="sec"><div class="sec-head"><h2>Risk and diversification</h2></div><p class="sub" style="max-width:78ch">Downloads about two years of daily prices for each holding and measures how much they move together. Only tickers are sent. It takes around ten to thirty seconds.</p><div class="row" style="margin:10px 0"><button class="btn" data-a="rk-go"' + (r.busy || !ready() ? ' disabled' : '') + '>' + (r.busy ? 'Working…' : r.at ? 'Reload prices' : 'Load prices and analyse') + '</button><span class="sub" id="rk-msg">' + esc(r.busy ? r.msg : '') + '</span></div>' + (ready() ? '' : needAccess('Risk analysis')) + riskBody() + '</section>';
  }

  /* ============================================================= Toolkit: Goals */
  function goalDefaults() {
    const p = A.getPerf(); const g = S().goal; const yearAgo = C.addDays(today(), -365);
    const avg = p.flows.filter(f => f.date > yearAgo).reduce((s, f) => s + f.amt, 0) / 12;
    return { monthly: g.monthly !== '' && fin(+g.monthly) ? +g.monthly : Math.max(0, Math.round(avg)), avg: avg, vol: fin(p.vol) ? p.vol : null };
  }
  function tkGoals() {
    const st = S(), g = st.goal, m = A.M(); if (!m.nav) return A.onboarding();
    const d = goalDefaults(); const start = m.nav, monthly = d.monthly, years = Math.max(1, Math.min(60, +g.years || 20)), ret = (+g.ret || 0) / 100, vol = Math.max(0, (+g.vol || 0) / 100), infl = (+g.infl || 0) / 100, target = C.num(g.target);
    const det = BL.goals.project({ start: start, monthly: monthly, years: years, ret: ret });
    const mc = BL.goals.monteCarlo({ start: start, monthly: monthly, years: years, ret: ret, vol: vol, target: fin(target) ? target : 0, sims: 1500, seed: 7 });
    const need = fin(target) && target > 0 ? BL.goals.requiredMonthly({ start: start, years: years, ret: ret, target: target }) : NaN;
    const t0 = new Date(); const dt = y => new Date(Date.UTC(t0.getUTCFullYear() + y, t0.getUTCMonth(), t0.getUTCDate())).toISOString().slice(0, 10);
    const band = (lo, hi) => ({ upper: mc.bands.map(b => ({ d: dt(b.year), v: b[hi] })), lower: mc.bands.map(b => ({ d: dt(b.year), v: b[lo] })) });
    const inp = (k, label, val, step, unit) => '<label>' + label + '<input class="in" type="number" step="' + step + '" data-vc="goal" data-k="' + k + '" value="' + esc(val) + '"' + (unit ? ' placeholder="' + unit + '"' : '') + '></label>';
    const series = [{ name: 'Middle outcome', color: 'var(--ink)', nodots: true, pts: mc.bands.map(b => ({ d: dt(b.year), v: b.p50 })) }, { name: 'If returns are steady', color: 'var(--c2)', dash: '5 4', nodots: true, pts: det.path.filter(x => x.m % 12 === 0).map(x => ({ d: dt(x.m / 12), v: x.v })) }];
    if (fin(target) && target > 0) series.push({ name: 'Target', color: 'var(--gain)', dash: '2 3', nodots: true, pts: [{ d: dt(0), v: target }, { d: dt(mc.bands.length - 1), v: target }] });
    const b = mc.bands[mc.bands.length - 1];
    return '<section class="sec"><div class="sec-head"><h2>Goal planner</h2></div><p class="sub" style="max-width:78ch;margin-bottom:10px">Starts from your portfolio today and adds a monthly contribution. It shows a range of outcomes, because markets do not deliver the same return every year. These are illustrations, not forecasts.</p>' +
      '<div class="form">' + inp('target', 'Target amount (' + esc(st.base) + ')', g.target, 1000, 'optional') + inp('years', 'Years', g.years, 1) + inp('monthly', 'Monthly contribution', g.monthly === '' ? monthly : g.monthly, 50) + inp('ret', 'Assumed return a year (%)', g.ret, 0.5) + inp('vol', 'Ups and downs, yearly (%)', g.vol, 1) + inp('infl', 'Inflation (%)', g.infl, 0.5) + '</div>' +
      '<p class="sub" style="margin:6px 0 14px">' + (fin(d.avg) && d.avg > 0 ? 'Over the last 12 months you put in about ' + money(d.avg) + ' a month. ' : '') + (d.vol != null ? 'Your own history has yearly ups and downs of about ' + pct(d.vol * 100, 0) + '. ' : '') + 'Broad stock funds have historically been more volatile than bonds. Use assumptions you would be comfortable defending.</p>' +
      '<div class="tiles">' + tile('After ' + years + ' years, steady returns', money(det.end), 'you put in ' + money(det.contributed)) + tile('In today\'s money', money(det.end / Math.pow(1 + infl, years)), 'after ' + pct(infl * 100, 1) + ' inflation') + tile('Poor outcome (1 in 10)', money(b.p10), 'or worse') + tile('Middle outcome', money(b.p50)) + tile('Good outcome (1 in 10)', money(b.p90), 'or better') +
      (fin(target) && target > 0 ? tile('Chance of reaching target', pct(mc.chance * 100, 0), 'in this simulation', mc.chance >= 0.75 ? 'gain' : mc.chance < 0.4 ? 'loss' : '') + tile('Monthly needed, steady returns', fin(need) ? money(need) : '–', need <= monthly ? 'you are already above this' : 'to reach the target') : '') + '</div>' +
      '<div style="margin-top:14px">' + lineChart({ h: 250, label: 'Range of outcomes over time', fmt: v => money(v), bands: [Object.assign({ name: 'Middle 80% of outcomes', color: 'var(--c1)', opacity: 0.12 }, band('p10', 'p90')), Object.assign({ name: 'Middle 50%', color: 'var(--c1)', opacity: 0.22 }, band('p25', 'p75'))], series: series }) + '</div></section>';
  }

  /* ============================================================ Toolkit: Events */
  const ev = () => ui.ev = ui.ev || { busy: false, rows: [], msg: '', at: 0 };
  async function loadEvents() {
    const e = ev(); e.busy = true; e.rows = []; A.render(true);
    const list = A.M().rows.filter(x => !A.isDeriv(x) && x.cls !== 'Cash').sort((a, b) => b.val - a.val).slice(0, 20);
    for (let i = 0; i < list.length; i++) { const p = list[i]; const el = $('#ev-msg'); if (el) el.textContent = 'Checking ' + (i + 1) + ' of ' + list.length + ': ' + p.symbol; try { const f = await api('/fundamentals', { symbol: p.yahoo || A.yahooGuess(p) }); e.rows.push({ sym: p.symbol, name: p.desc, earn: f.nextEarnings, exd: f.exDividendDate, y: f.dividendYield }); } catch (err) { e.rows.push({ sym: p.symbol, name: p.desc, err: err.message }); } }
    e.busy = false; e.at = Date.now(); A.render(true);
  }
  function tkEvents() {
    const e = ev(); const t = today(); const items = [];
    e.rows.forEach(r => { if (r.earn && r.earn >= t) items.push({ d: r.earn, sym: r.sym, what: 'Earnings report' }); if (r.exd && r.exd >= t) items.push({ d: r.exd, sym: r.sym, what: 'Ex-dividend date' + (fin(r.y) ? ' (yield ' + pct(r.y * 100, 1) + ')' : '') }); });
    items.sort((a, b) => a.d < b.d ? -1 : 1); const noData = e.rows.filter(r => r.err).map(r => r.sym);
    return '<section class="sec"><div class="sec-head"><h2>Upcoming events for your holdings</h2></div><p class="sub" style="max-width:78ch">Looks up the next earnings and ex-dividend dates. Funds usually have no earnings date. Dates come from Yahoo Finance and companies can change them.</p><div class="row" style="margin:10px 0"><button class="btn" data-a="ev-go"' + (e.busy || !ready() ? ' disabled' : '') + '>' + (e.busy ? 'Working…' : e.at ? 'Check again' : 'Check upcoming dates') + '</button><span class="sub" id="ev-msg">' + esc(e.busy ? e.msg : '') + '</span></div>' + (ready() ? '' : needAccess('Looking up events')) +
      (e.at ? (items.length ? '<table class="t"><thead><tr><th>Date</th><th>In</th><th>Holding</th><th>What</th></tr></thead><tbody>' + items.map(i => { const dd = C.daysBetween(t, i.d); return '<tr><td>' + esc(C.fmtDay(i.d)) + '</td><td class="muted">' + (dd === 0 ? 'today' : dd + ' days') + '</td><td class="sym">' + esc(i.sym) + '</td><td>' + esc(i.what) + '</td></tr>'; }).join('') + '</tbody></table>' : A.empty('No upcoming dates were found.')) + (noData.length ? '<p class="sub" style="margin-top:8px">No data for ' + esc(noData.join(', ')) + '.</p>' : '') : '') + '</section>';
  }

  /* ========================================================= Toolkit: Tax notes */
  const US_EX = /^(NYSE|NASDAQ|NMS|NGM|NCM|ARCA|PCX|AMEX|BATS|ISLAND|PINK|IEX)/i;
  const isUs = p => US_EX.test(p.exch || '') || (!p.exch && p.ccy === 'USD' && p.region === 'United States' && /^[A-Z.]{1,5}$/.test(p.symbol));
  function tkTax() {
    const st = S(), m = A.M(); const led = A.getLedger();
    const usr = A.fxRate('USD'); const us = m.rows.filter(p => !A.isDeriv(p) && p.cls !== 'Cash' && isUs(p)); const usVal = us.reduce((s, p) => s + p.val, 0); const usd = usr ? usVal / usr : NaN;
    const T = 60000;
    const sm = C.ledgerSummary(led.filter(e => e.type === 'div' || e.type === 'tax'), c => c === st.base ? 1 : A.fxRate(c));
    return '<section class="sec"><div class="sec-head"><h2>Tax notes</h2><span class="sub">Information, not tax advice</span></div>' +
      '<div class="panel"><h3 style="font-size:15px">US-listed holdings</h3><p class="sub" style="margin:6px 0 10px;max-width:78ch">If you are not a US citizen or resident, US-listed stocks and funds can be subject to US estate tax on death above a threshold. At the time of writing that threshold is US$60,000 for non-residents, with rates up to 40% above it. Some assets are treated differently, and tax treaties or your own country\'s rules may change the picture. Check the current rules for your situation. Many people compare funds domiciled in Ireland or Luxembourg for this reason.</p>' +
      '<div class="tiles">' + tile('Probably US-listed', fin(usd) ? 'US$' + A.nf0.format(usd) : money(usVal), us.length + ' holding' + (us.length === 1 ? '' : 's') + (fin(usd) ? '' : ', no USD rate set')) + (fin(usd) ? tile('Compared with US$60,000', usd > T ? 'Above' : 'Below', usd > T ? 'by US$' + A.nf0.format(usd - T) : 'US$' + A.nf0.format(T - usd) + ' of room', usd > T ? 'loss' : 'gain') : '') + '</div>' +
      (us.length ? '<div class="chips" style="margin-top:10px">' + us.map(p => '<span class="tag">' + esc(p.symbol) + ' ' + pct(p.w, 1) + '</span>').join(' ') + '</div><p class="sub" style="margin-top:8px">Detected from exchange and currency, so it can be wrong. Edit a holding in Holdings to correct its exchange.</p>' : '') + '</div>' +
      '<div class="panel" style="margin-top:14px"><h3 style="font-size:15px">Tax withheld on dividends</h3>' + (sm.years.length ? '<table class="t" style="margin-top:8px"><thead><tr><th>Year</th><th class="num">Dividends</th><th class="num">Tax withheld</th><th class="num">Share withheld</th></tr></thead><tbody>' + sm.years.map(y => '<tr><td>' + y.year + '</td><td class="num">' + money(y.div) + '</td><td class="num">' + money(y.tax) + '</td><td class="num">' + (y.div > 0 ? pct(-y.tax / y.div * 100, 0) : '–') + '</td></tr>').join('') + '</tbody></table><p class="sub" style="margin-top:8px;max-width:78ch">Foreign dividends are often taxed at the source. The rate depends on the country and whether a treaty applies. Whether you can claim any of it back depends on where you live.</p>' : '<p class="sub" style="margin-top:6px">No dividends in the imported statements yet.</p>') + '</div>' +
      '<p class="sub" style="margin-top:14px;max-width:78ch">Ballast does not calculate your tax. Rules vary by country and change over time, so confirm anything important with a qualified professional.</p></section>';
  }

  /* ============================================================= Wiring */
  Object.assign(A.ACT, {
    'rs-go': () => analyse(($('#rs-sym') || {}).value),
    'rs-win': el => { rs().win = +el.dataset.v; A.render(true); },
    'rs-ai': async () => {
      const r = rs(), res = r.res; if (!res || r.aiBusy) return; r.aiBusy = true; r.aiErr = ''; A.render(true);
      const T = res.tech, F = res.fa, f = res.fund || {};
      const payload = { symbol: res.sym, name: res.name, currency: res.currency,
        technical: T ? { label: T.label, score: T.score, signals: T.signals.map(s => ({ name: s.name, view: s.view, note: s.note })), performance: T.perf, week52: T.range, volatility30d: T.volatility.realised30, atrPct: T.ind.atrPct, rsi: T.ind.rsi, maxDrawdownInData: T.drawdown.max } : null,
        fundamentals: F ? { kind: F.kind, overall: F.overall, sector: f.sector, industry: f.industry, category: f.category, marketCap: f.marketCap, nextEarnings: f.nextEarnings, groups: F.groups.map(g => ({ name: g.name, score: g.score, metrics: g.metrics.map(m => ({ label: m.label, value: m.text, rating: m.rating })) })) } : null,
        headlines: (res.news || []).slice(0, 8).map(n => n.title) };
      try { const out = await api('/ai', { task: 'analysis', payload: payload }); r.ai = out.result || null; if (!r.ai) r.aiErr = 'No answer came back.'; } catch (e) { r.aiErr = 'Could not write the read: ' + e.message; }
      r.aiBusy = false; A.render(true);
    },
    'rk-go': () => loadRisk(), 'ev-go': () => loadEvents(),
    'rs-cmp-add': () => {
      const r = rs(), c = cmp(), el = $('#rs-cmp-in'); const sym = String((el && el.value) || '').trim().toUpperCase();
      if (!sym) return; if (!SYM.test(sym)) { c.err = 'Enter a valid symbol.'; A.render(true); return; }
      if (c.tickers.length >= 4) { c.err = 'Up to four extra tickers at a time.'; A.render(true); return; }
      if (!c.tickers.includes(sym) && sym !== r.sym) c.tickers.push(sym);
      c.err = ''; A.render(true);
    },
    'rs-cmp-del': el => { cmp().tickers.splice(+el.dataset.i, 1); A.render(true); },
    'rs-cmp-go': () => { const r = rs(); return r.res ? runCompare(r.res) : undefined; }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'rs-sym') { e.preventDefault(); analyse(e.target.value); } });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.id === 'rsfile' && el.files && el.files[0]) {
      const file = el.files[0]; file.text().then(t => {
        const r = rs(); try { const bars = csvBars(t); const res = { sym: (file.name.replace(/\.csv$/i, '').toUpperCase().slice(0, 20) || 'FILE'), name: file.name, bars: bars, at: Date.now() }; res.tech = BL.ta.technical(bars); r.res = res; r.sym = ''; r.err = ''; r.note = 'Technical analysis only, from your file. '; }
        catch (err) { r.err = err.message; } A.render(true);
      }); el.value = '';
    } else if (el.dataset && el.dataset.vc === 'goal') { const k = el.dataset.k; S().goal[k] = el.value; A.dirty(); A.render(true); }
    else if (el.id === 'rs-cmp-bench') { cmp().bench = el.checked; }
    else if (el.id === 'rs-cmp-spx') { cmp().spx = el.checked; }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'rs-cmp-in') { e.preventDefault(); A.ACT['rs-cmp-add'](); } });
  A.VIEW.research = vResearch;
  A.TK.push(['risk', 'Risk', tkRisk], ['goals', 'Goals', tkGoals], ['events', 'Events', tkEvents], ['tax', 'Tax notes', tkTax]);
})();
