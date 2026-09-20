/* Performance and Activity views. Loaded after app.js. */
(function () {
  'use strict';
  BL.ver = BL.ver || {}; BL.ver['views-history'] = 8;
  const A = BL.app, C = BL.core, ui = A.ui, esc = A.esc, money = A.money, smoney = A.smoney, spct = A.spct, pct = A.pct, cls = A.cls, fin = Number.isFinite;
  const S = () => A.S(); const lineChart = A.lineChart;
  const today = () => new Date().toISOString().slice(0, 10);
  const rate = c => (c === S().base ? 1 : A.fxRate(c));
  const pc1 = v => fin(v) ? spct(v * 100, 1) : '–';

  /* ============================================================ Performance */
  function importHelp() {
    return '<div class="panel" style="margin-top:14px;max-width:80ch"><h3 style="font-size:15px;margin-bottom:6px">How to bring in every statement since you started</h3>' +
      '<ol style="padding-left:20px;line-height:1.6"><li>In IBKR open Performance &amp; Reports, then Statements, and run an <b>Activity</b> statement. Pick a period: one per year is the fastest way to get the whole history, and monthly gives finer detail. A custom date range may also be available, depending on your account.</li>' +
      '<li>Download each as <b>CSV</b>. Then choose all the files at once on the Data &amp; settings screen.</li>' +
      '<li>Ballast reads each statement in your browser, joins them, ignores overlaps, and shows any period that is missing.</li>' +
      '<li>For daily detail, an IBKR report that lists net asset value by date can also be imported as a CSV, as long as it has a date column and a net asset value column. Ballast checks it can find both.</li></ol>' +
      '<div class="row" style="margin-top:8px"><button class="btn" data-a="go" data-v="data">Import statements</button><button class="btn ghost" data-a="demo">Try sample data</button></div></div>';
  }
  function rangeCut(r) {
    const t = today(); const y = +t.slice(0, 4);
    return r === 'ytd' ? y + '-01-01' : r === '1y' ? C.addDays(t, -365) : r === '3y' ? C.addDays(t, -1096) : '';
  }
  function tile(label, value, sub, klass) {
    return '<div class="tile"><span class="lab">' + label + '</span><b class="' + (klass || '') + '">' + value + '</b>' + (sub ? '<span class="sub">' + sub + '</span>' : '') + '</div>';
  }
  function heat(months) {
    const by = {}; months.forEach(m => { const y = m.month.slice(0, 4); (by[y] = by[y] || {})[+m.month.slice(5)] = m.r; });
    const years = Object.keys(by).sort();
    const cell = v => { if (!fin(v)) return '<td class="num muted">·</td>'; const a = Math.min(60, Math.abs(v) * 900); return '<td class="num" style="background:color-mix(in srgb,var(' + (v >= 0 ? '--gain' : '--loss') + ') ' + a.toFixed(0) + '%,transparent)">' + (v * 100).toFixed(1) + '</td>'; };
    return '<div class="scroll"><table class="t heat"><thead><tr><th>Year</th>' + C.MON3.map(m => '<th class="num">' + m + '</th>').join('') + '</tr></thead><tbody>' +
      years.map(y => '<tr><td class="sym">' + y + '</td>' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(k => cell(by[y][k])).join('') + '</tr>').join('') + '</tbody></table></div>';
  }
  function crossCheck(p) {
    const rows = [];
    S().snaps.filter(s => fin(s.twrStmt) && s.from && s.to).forEach(s => {
      const iv = p.intervals.find(i => i.to === s.to && i.from === C.addDays(s.from, -1) && fin(i.rDietz)); if (!iv) return;
      rows.push({ label: s.label, ibkr: s.twrStmt / 100, mine: iv.rDietz });
    });
    if (!rows.length) return '';
    return '<section class="sec"><div class="sec-head"><h2>Cross-check against your statements</h2><span class="sub">Ballast uses the figure in your statement. This shows how far its own estimate from period-end values would be. Long periods with large deposits can be far off.</span></div><div class="scroll"><table class="t"><thead><tr><th>Period</th><th class="num">Statement says (used)</th><th class="num">Ballast estimate</th><th class="num">Difference</th></tr></thead><tbody>' +
      rows.slice(-12).reverse().map(r => '<tr><td>' + esc(r.label) + '</td><td class="num">' + pc1(r.ibkr) + '</td><td class="num">' + pc1(r.mine) + '</td><td class="num ' + (Math.abs(r.mine - r.ibkr) > 0.01 ? 'loss' : 'muted') + '">' + ((r.mine - r.ibkr) * 100).toFixed(2) + ' pts</td></tr>').join('') + '</tbody></table></div></section>';
  }
  function coverageSection() {
    const cov = C.coverage(S().snaps, today()); if (!cov.segments.length) return '';
    const notes = [];
    if (cov.gaps.length) notes.push('<div class="banner">Missing periods: ' + cov.gaps.map(g => esc(C.fmtDay(g.from) + ' to ' + C.fmtDay(g.to))).join('; ') + '. Import those statements to fill them. Returns are not calculated across a gap, so totals leave these periods out.</div>');
    if (cov.breaks.length) notes.push('<div class="banner">The starting value of the statement beginning ' + esc(C.fmtDay(cov.breaks[0].at)) + ' does not match the previous statement\'s ending value. Transfers in or out of the account or a restated statement can cause this.</div>');
    if (cov.overlapped) notes.push('<div class="banner info">' + cov.overlapped + ' overlapping statement' + (cov.overlapped > 1 ? 's were' : ' was') + ' ignored for the history because a finer-grained one covers the same days. Their transactions are still de-duplicated into Activity.</div>');
    if (fin(cov.staleDays) && cov.staleDays > 35) notes.push('<div class="banner info">The latest statement ends ' + esc(C.fmtDay(cov.last)) + ', ' + cov.staleDays + ' days ago.</div>');
    if (S().snaps.some(s => s.base && s.base !== S().base)) notes.push('<div class="banner">Some statements use a different base currency from ' + esc(S().base) + '. Their values are not converted here, so the history may be wrong.</div>');
    const bar = cov.segments.map(s => '<span class="tag" title="' + esc(C.fmtDay(s.from) + ' to ' + C.fmtDay(s.to)) + '">' + esc(s.label) + '</span>').join(' ');
    return '<section class="sec"><div class="sec-head"><h2>What your history is built from</h2><span class="sub">' + esc(C.fmtDay(cov.first)) + ' to ' + esc(C.fmtDay(cov.last)) + '</span></div>' + notes.join('') + '<div class="chips" style="margin-top:6px">' + bar + '</div></section>';
  }
  function vPerformance() {
    const st = S(); ui.pf = ui.pf || { range: 'all', bench: false, sym: '', hist: null, err: '', busy: false };
    if (!st.snaps.length && !st.navExtra.length) return '<div class="onboard"><h2>Your net asset value over time</h2><p>Import your statements and Ballast will chart your net asset value, how much you put in, and your returns with deposits and withdrawals taken out.</p>' + importHelp() + '</div>';
    const p = A.getPerf();
    if (p.series.length < 2) return '<div class="banner info">Only one point so far. Import more statements to see a history.</div>' + importHelp();
    const cut = rangeCut(ui.pf.range); const ser = cut ? p.series.filter(s => s.date >= cut) : p.series; const view = ser.length >= 2 ? ser : p.series;
    const base0 = view[0].idx; const rangeTwr = view[view.length - 1].idx / base0 - 1;
    const worst = p.maxDrawdown; const tk = C.trackedThrough(st.snaps, today());
    const R = [['all', 'Since the start'], ['3y', '3 years'], ['1y', '1 year'], ['ytd', 'This year']];
    let bench = '';
    const b = ui.pf;
    if (b.hist && b.hist.length) {
      const dates = view.map(s => s.date); const bi = C.benchmarkIndex(dates, b.hist); const idx = view.map(s => s.idx / base0 * 100);
      if (bi.length) {
        const priceOnly = /^\^/.test(b.sym);
        const last = bi.filter(fin).pop();
        bench = lineChart({ h: 220, label: 'Growth of 100 compared with a benchmark', fmt: v => v.toFixed(0), series: [{ name: 'You (time-weighted, deposits removed)', color: 'var(--ink)', pts: view.map((s, i) => ({ d: s.date, v: idx[i] })) }, { name: b.sym + (priceOnly ? ' (price index, excludes dividends)' : ' (dividends included)'), color: 'var(--c2)', pts: view.map((s, i) => ({ d: s.date, v: bi[i] })) }] }) +
          '<p class="sub" style="margin-top:6px">Over this period you are at ' + idx[idx.length - 1].toFixed(1) + ' and ' + esc(b.sym) + ' is at ' + (fin(last) ? last.toFixed(1) : '–') + ' (both start at 100). A benchmark is a yardstick, not a target: it has a different mix and currency from your portfolio.</p>';
      }
    }
    const dd = lineChart({ h: 150, label: 'Fall from the previous high', fmt: v => (v * 100).toFixed(0) + '%', zero: true, max: 0, series: [{ name: 'Fall from previous high', color: 'var(--loss)', nodots: true, pts: p.drawdown.filter(x => !cut || x.date >= cut).map(x => ({ d: x.date, v: x.dd })) }] });
    return (p.coarse ? '<div class="banner">Some of your statements cover long periods and do not report their own return, so the return figures below are approximate. They behave more like a money-weighted return when you add money gradually. Import monthly statements for accurate time-weighted returns. If your annual statements do report a Time Weighted Rate of Return, use Recalculate in Data &amp; settings, or import them again if it says there is no saved copy: statements imported before version 6 did not keep it.</div>' : '') +
      (p.avgIntervalDays > 60 ? '<div class="banner info">Falls from the previous high are measured only at statement dates. Real falls between them may be larger.</div>' : '') +
      (p.unverified ? '<div class="banner">' + p.unverified + ' period' + (p.unverified > 1 ? 's' : '') + ' between statements could not be verified, so they are left out of the return figures.</div>' : '') +
      '<div class="tiles">' +
      tile('Net asset value', money(p.nav), 'at ' + esc(C.fmtDay(p.series[p.series.length - 1].date))) +
      (tk && !st.demo ? tile('Statements tracked to', esc(C.fmtDay(tk.through)), esc(C.agoText(tk.days)) + (tk.status === 'current' ? '' : '. Next: ' + esc(tk.next.label)), tk.status === 'current' ? 'gain' : tk.status === 'overdue' ? 'loss' : '') : '') +
      tile('Money you put in', money(p.contributions), 'deposits less withdrawals') +
      tile('Gain', smoney(p.gain), p.contributions > 0 ? spct(p.gain / p.contributions * 100) + ' on what you put in' : '', cls(p.gain)) +
      tile('Return, deposits removed', pc1(p.totalTwr), (p.coarse ? 'approximate' : p.reportedCount ? 'as reported by your statements' : 'time-weighted') + (fin(p.annualised) ? ', about ' + spct(p.annualised * 100) + ' a year' : ''), cls(p.totalTwr)) +
      tile('Return, your timing', pc1(p.xirr), p.spanDays < 365 ? 'money-weighted, scaled to a year, so treat with caution on a short history' : 'money-weighted, per year', cls(p.xirr)) +
      tile('Worst fall', pc1(worst.dd), worst.from ? esc(C.fmtDay(worst.from)) + ' to ' + esc(C.fmtDay(worst.to)) : '', 'loss') +
      (fin(p.vol) ? tile('Volatility', pct(p.vol * 100, 1), 'yearly, from ' + p.volBasis + ' returns') : '') + '</div>' +
      '<div class="row" style="justify-content:space-between;margin:18px 0 8px"><div class="chips" role="group" aria-label="Period">' + R.map(r => '<button class="chip" aria-pressed="' + (ui.pf.range === r[0]) + '" data-a="pf-range" data-v="' + r[0] + '">' + r[1] + '</button>').join('') + '</div><span class="sub">Return in this period: <b class="' + cls(rangeTwr) + '">' + pc1(rangeTwr) + '</b></span></div>' +
      '<section class="sec" style="margin-top:8px"><div class="sec-head"><h2>Net asset value and money put in</h2></div>' +
      lineChart({ h: 240, label: 'Net asset value and net contributions', fmt: v => money(v), area: true, series: [{ name: 'Net asset value', color: 'var(--ink)', pts: view.map(s => ({ d: s.date, v: s.nav })) }, { name: 'Money you put in', color: 'var(--c2)', dash: '5 4', pts: view.map(s => ({ d: s.date, v: s.contrib })) }] }) +
      '<p class="sub" style="margin-top:6px">The gap between the lines is what your investments have earned. Points are ' + (p.avgIntervalDays > 200 ? 'yearly' : p.avgIntervalDays > 20 ? 'monthly' : 'frequent') + ' because that is what your files contain.</p></section>' +
      '<section class="sec"><div class="sec-head"><h2>Compared with a benchmark</h2></div>' + (BL.cloud.apiConfigured() && BL.cloud.hasIdToken() ?
        '<div class="row" style="margin-bottom:10px"><input class="in" id="pf-sym" style="width:130px" value="' + esc(b.sym || S().bench || '^GSPC') + '" aria-label="Benchmark symbol"><button class="btn ghost sm" data-a="pf-bench"' + (b.busy ? ' disabled' : '') + '>' + (b.busy ? 'Loading…' : 'Compare') + '</button><span class="sub">For example ^GSPC (S&amp;P 500), VT (world stocks), ^STI, ^FTSE</span></div>' + (b.err ? '<p class="loss">' + esc(b.err) + '</p>' : '') + (bench || '<p class="sub">Pick a benchmark to see growth of 100 side by side.</p>') :
        '<p class="sub">Needs the market data service. ' + (BL.cloud.apiConfigured() ? '<button class="link" data-a="id-signin">Allow market data</button>' : 'See Data &amp; settings, Storage and security.') + '</p>') + '</section>' +
      '<section class="sec"><div class="sec-head"><h2>Falls from the previous high</h2><span class="sub">Deposits are removed first, so adding cash does not hide a loss</span></div>' + dd + '</section>' +
      '<div class="two sec"><section><div class="sec-head"><h2>By year</h2></div>' + (p.years.length ? '<table class="t"><thead><tr><th>Year</th><th class="num">Return</th></tr></thead><tbody>' + p.years.slice().reverse().map(y => '<tr><td>' + y.year + '</td><td class="num ' + cls(y.r) + '">' + pc1(y.r) + '</td></tr>').join('') + '</tbody></table><p class="sub" style="margin-top:6px">A year may cover only part of a year if statements start or stop mid-way.</p>' : A.empty('No complete periods yet.')) + '</section>' +
      '<section><div class="sec-head"><h2>Best and worst</h2></div>' + (p.best ? '<div class="kv"><span class="muted">Best period</span><span class="gain">' + pc1(p.best.r) + ' <span class="muted">to ' + esc(C.fmtDay(p.best.to)) + '</span></span></div><div class="kv"><span class="muted">Worst period</span><span class="loss">' + pc1(p.worst.r) + ' <span class="muted">to ' + esc(C.fmtDay(p.worst.to)) + '</span></span></div><div class="kv"><span class="muted">Periods that gained</span><span>' + pct(p.hitRate * 100, 0) + '</span></div>' : '') + '</section></div>' +
      (p.months.length >= 6 && p.avgIntervalDays < 40 ? '<section class="sec"><div class="sec-head"><h2>Month by month</h2><span class="sub">Percent</span></div>' + heat(p.months) + '</section>' : '') +
      crossCheck(p) + coverageSection() +
      '<div class="row" style="margin-top:20px"><button class="btn ghost" data-a="export-nav">Export history as CSV</button><button class="btn ghost" data-a="go" data-v="data">Import more statements</button></div>' +
      '<p class="sub" style="margin-top:14px;max-width:80ch">Past performance is not a guide to future results. Returns are estimated from the period-end values in your files and the deposits and withdrawals listed in them. Foreign-currency deposits are converted at the exchange rates you set, so these figures can differ slightly from the broker\'s own reports.</p>';
  }

  /* ============================================================== Activity */
  const TYPES = { all: ['All', null], trades: ['Trades', ['buy', 'sell', 'fx']], income: ['Dividends and interest', ['div', 'tax', 'int']], fees: ['Fees', ['fee']], cash: ['Deposits and withdrawals', ['dep', 'wd']], other: ['Other', ['corp']] };
  function lgState() { return ui.lg = ui.lg || { type: 'all', year: 'all', q: '', n: 100 }; }
  function filtered() {
    const f = lgState(); const q = f.q.trim().toLowerCase();
    return A.getLedger().filter(e => (!TYPES[f.type][1] || TYPES[f.type][1].includes(e.type)) && (f.year === 'all' || e.date.slice(0, 4) === f.year) && (!q || (e.sym + ' ' + C.describeEntry(e)).toLowerCase().includes(q)));
  }
  function totals(entries) {
    const sm = C.ledgerSummary(entries, rate); const t = { trades: 0, buys: 0, sells: 0, comm: 0, div: 0, tax: 0, int: 0, fees: 0, dep: 0, wd: 0, pnl: 0 };
    sm.years.forEach(y => Object.keys(t).forEach(k => { t[k] += y[k]; })); return { t: t, sm: sm };
  }
  function dividends() {
    const led = A.getLedger(); const from = C.addDays(today(), -365); const held = new Set(S().positions.map(p => p.symbol));
    const divs = led.filter(e => e.type === 'div' && e.date > from); if (!divs.length) return '';
    const conv = e => { const r = rate(e.ccy); return r == null ? 0 : e.amt * r; };
    const tax = led.filter(e => e.type === 'tax' && e.date > from);
    const total = divs.reduce((s, e) => s + conv(e), 0), taxT = tax.reduce((s, e) => s + conv(e), 0);
    const by = {}; divs.forEach(e => { by[e.sym] = (by[e.sym] || 0) + conv(e); });
    const list = Object.keys(by).map(k => ({ label: k + (held.has(k) ? '' : ' (sold)'), v: by[k] })).sort((a, b) => b.v - a.v).slice(0, 8);
    const still = Object.keys(by).filter(k => held.has(k)).reduce((s, k) => s + by[k], 0);
    const nav = A.M().nav;
    return '<section class="sec"><div class="sec-head"><h2>Income</h2><span class="sub">Last 12 months</span></div><div class="tiles">' +
      tile('Dividends received', money(total), nav ? pct(total / nav * 100, 2) + ' of your portfolio' : '') + tile('Tax withheld', money(taxT), total ? pct(Math.abs(taxT) / total * 100, 0) + ' of dividends' : '', 'loss') +
      tile('Rough next 12 months', money(still + taxT * (total ? still / total : 0)), 'if the last year repeats for what you still hold, after tax') + '</div>' +
      '<div style="margin-top:12px">' + A.hbars(list, v => money(v)) + '</div><p class="sub" style="margin-top:6px;max-width:74ch">The forecast is only last year repeated. Payouts change, and it does not adjust for shares bought or sold since.</p></section>';
  }
  function vActivity() {
    const st = S(); const led = A.getLedger();
    if (!led.length) return '<div class="onboard"><h2>Every purchase, sale, fee and dividend</h2><p>Import your IBKR activity statements and Ballast lists each transaction: what you bought or sold, at what price, the commission, dividends, tax withheld, interest, fees, deposits and withdrawals. Statements that overlap are merged so nothing is counted twice.</p>' + importHelp() + '</div>';
    const f = lgState(); const rows = filtered(); const { t, sm } = totals(rows); const all = totals(led).sm;
    const years = Array.from(new Set(led.map(e => e.date.slice(0, 4)))).sort().reverse();
    const p = A.getPerf(); const avg = {};
    p.series.forEach(s => { const y = s.date.slice(0, 4); (avg[y] = avg[y] || []).push(s.nav); });
    const yrow = all.years.map(y => { const a = avg[y.year] ? avg[y.year].reduce((s, x) => s + x, 0) / avg[y.year].length : NaN; const cost = -(y.comm + y.fees + y.tax);
      return '<tr><td class="sym">' + y.year + '</td><td class="num">' + y.trades + '</td><td class="num">' + money(y.buys) + '</td><td class="num">' + money(y.sells) + '</td><td class="num">' + money(y.comm) + '</td><td class="num">' + money(y.fees) + '</td><td class="num">' + money(y.div) + '</td><td class="num">' + money(y.tax) + '</td><td class="num">' + money(y.int) + '</td><td class="num">' + money(y.dep + y.wd) + '</td><td class="num ' + cls(y.pnl) + '">' + smoney(y.pnl) + '</td><td class="num">' + (fin(a) && a > 0 ? pct(cost / a * 100, 2) : '–') + '</td></tr>'; }).join('');
    const sy = all.syms.slice().sort((a, b) => b.bought - a.bought).slice(0, 15).map(s => '<tr><td class="sym">' + esc(s.sym) + '</td><td class="num">' + s.trades + '</td><td class="num">' + money(s.bought) + '</td><td class="num">' + money(s.sold) + '</td><td class="num">' + money(s.comm) + '</td><td class="num">' + money(s.div) + '</td><td class="num">' + money(s.tax) + '</td><td class="num ' + cls(s.pnl) + '">' + smoney(s.pnl) + '</td></tr>').join('');
    const shown = rows.slice(0, f.n);
    const line = e => { const isTrade = e.type === 'buy' || e.type === 'sell' || e.type === 'fx';
      return '<tr><td class="nowrap">' + esc(e.date) + '</td><td>' + esc(C.describeEntry(e)) + (e.desc && (e.type === 'div' || e.type === 'tax') ? '<span class="desc">' + esc(e.desc) + '</span>' : '') + '</td><td class="sym">' + esc(e.sym || '') + '</td><td class="num ' + (e.qty < 0 ? 'loss' : '') + '">' + (isTrade && fin(e.qty) ? A.qtyFmt(e.qty) : '') + '</td><td class="num">' + (fin(e.price) ? A.px(e.price) : '') + '</td><td class="num ' + cls(e.amt) + '">' + (fin(e.amt) ? esc(e.ccy) + ' ' + A.px(e.amt) : '') + '</td><td class="num">' + (fin(e.fee) && e.fee ? esc(e.feeCcy || e.ccy) + ' ' + A.px(Math.abs(e.fee)) : '') + '</td><td class="num ' + cls(e.pnl) + '">' + (fin(e.pnl) && e.pnl ? A.px(e.pnl) : '') + '</td></tr>'; };
    const fx = led.filter(e => e.type === 'fx'); const tk = C.trackedThrough(st.snaps, today());
    const segs = C.chooseSegments(st.snaps); const notItemised = segs.reduce((a, sg) => a + (fin((sg.s.change || {})['Sales Tax']) ? sg.s.change['Sales Tax'] : 0), 0);
    return (tk && !st.demo ? '<p class="sub" style="margin-bottom:10px">Statements tracked to <b>' + esc(C.fmtDay(tk.through)) + '</b> (' + esc(C.agoText(tk.days)) + ')' + (tk.latestTx ? '. Latest transaction: ' + esc(C.fmtDay(tk.latestTx)) : '') + (tk.status === 'current' ? '' : '. Anything after that date is not shown until you import the statement starting ' + esc(C.fmtDay(tk.next.from))) + '.</p>' : '') + '<div class="tiles">' + tile('Transactions', String(rows.length), 'in this view') + tile('Bought', money(t.buys), t.trades + ' trades, sold ' + money(t.sells)) + tile('Commissions paid', money(-t.comm), 'on trades and conversions') + tile('Other fees', money(-t.fees)) + tile('Dividends', money(t.div), 'tax withheld ' + money(-t.tax)) + tile('Interest', money(t.int)) + tile('Net deposits', money(t.dep + t.wd)) + tile('Realized gain', smoney(t.pnl), 'as reported by IBKR', cls(t.pnl)) + '</div>' +
      (sm.missing.length ? '<div class="banner" style="margin-top:12px">No exchange rate set for ' + esc(sm.missing.join(', ')) + ', so those amounts are left out of the totals above. <button class="link" data-a="go" data-v="data">Set rates</button></div>' : '') +
      '<div class="row" style="margin:18px 0 10px;justify-content:space-between"><div class="chips" role="group" aria-label="Type">' + Object.keys(TYPES).map(k => '<button class="chip" aria-pressed="' + (f.type === k) + '" data-a="lg-type" data-v="' + k + '">' + TYPES[k][0] + '</button>').join('') + '</div>' +
      '<div class="row"><select class="in" data-vc="lg-year" aria-label="Year"><option value="all">All years</option>' + years.map(y => '<option' + (f.year === y ? ' selected' : '') + '>' + y + '</option>').join('') + '</select><input class="in" data-vc="lg-q" placeholder="Search symbol or text" value="' + esc(f.q) + '" style="width:190px"><button class="btn ghost sm" data-a="export-ledger">Export CSV</button></div></div>' +
      (rows.length ? '<div class="scroll"><table class="t"><thead><tr><th>Date</th><th>What happened</th><th>Symbol</th><th class="num">Quantity</th><th class="num">Price</th><th class="num">Amount</th><th class="num">Fee</th><th class="num">Realized</th></tr></thead><tbody>' + shown.map(line).join('') + '</tbody></table></div>' + (rows.length > shown.length ? '<div style="margin-top:10px"><button class="btn ghost" data-a="lg-more">Show more (' + (rows.length - shown.length) + ' left)</button></div>' : '') : A.empty('Nothing matches these filters.')) +
      '<section class="sec"><div class="sec-head"><h2>Year by year</h2><span class="sub">In ' + esc(st.base) + ', using your exchange rates. Cost is commissions, fees and tax withheld as a share of your average net asset value</span></div><div class="scroll"><table class="t"><thead><tr><th>Year</th><th class="num">Trades</th><th class="num">Bought</th><th class="num">Sold</th><th class="num">Commissions</th><th class="num">Fees</th><th class="num">Dividends</th><th class="num">Tax withheld</th><th class="num">Interest</th><th class="num">Net deposits</th><th class="num">Realized</th><th class="num">Cost</th></tr></thead><tbody>' + yrow + '</tbody></table></div>' + (Math.abs(notItemised) > 0.005 ? '<p class="sub" style="margin-top:8px;max-width:80ch">Your statements also report sales tax of ' + money(notItemised) + ' in total (in ' + esc(st.base) + '), for example on commissions. It is not itemised per transaction, so it is not in the cost figures above.</p>' : '') + '</section>' +
      '<section class="sec"><div class="sec-head"><h2>By holding</h2></div><div class="scroll"><table class="t"><thead><tr><th>Symbol</th><th class="num">Trades</th><th class="num">Bought</th><th class="num">Sold</th><th class="num">Commissions</th><th class="num">Dividends</th><th class="num">Tax withheld</th><th class="num">Realized</th></tr></thead><tbody>' + sy + '</tbody></table></div></section>' +
      dividends() +
      (fx.length ? '<section class="sec"><div class="sec-head"><h2>Currency conversions</h2></div><p>' + fx.length + ' conversion' + (fx.length > 1 ? 's' : '') + ', with commissions of ' + money(-fx.reduce((s, e) => s + (rate(e.feeCcy) == null ? 0 : e.fee * rate(e.feeCcy)), 0)) + '.</p><p class="sub" style="max-width:74ch;margin-top:4px">This counts the commission only. The exchange rate itself also carries a spread that statements do not show separately.</p></section>' : '');
  }

  /* ============================================================== Actions */
  Object.assign(A.ACT, {
    'pf-range': el => { ui.pf.range = el.dataset.v; A.render(true); },
    'pf-bench': async () => {
      const sym = (($('#pf-sym') || {}).value || '').trim().toUpperCase(); if (!/^[A-Z0-9.\-=^_]{1,20}$/.test(sym)) { ui.pf.err = 'Enter a valid symbol.'; A.render(true); return; }
      ui.pf.busy = true; ui.pf.err = ''; ui.pf.sym = sym; A.render(true);
      try {
        const r = await BL.cloud.api('/history', { symbol: sym, range: 'max', interval: '1wk' });
        ui.pf.hist = r.points.map(x => [x[0], x[6] != null ? x[6] : x[4]]); S().bench = sym; A.dirty();
      } catch (e) { ui.pf.err = e.message; ui.pf.hist = null; }
      ui.pf.busy = false; A.render(true);
    },
    'lg-type': el => { const f = lgState(); f.type = el.dataset.v; f.n = 100; A.render(true); },
    'lg-more': () => { lgState().n += 200; A.render(true); }
  });
  function $(s) { return document.querySelector(s); }
  document.addEventListener('change', e => { const el = e.target; if (el.dataset && el.dataset.vc === 'lg-year') { const f = lgState(); f.year = el.value; f.n = 100; A.render(true); } });
  let qt = 0; document.addEventListener('input', e => { const el = e.target; if (el.dataset && el.dataset.vc === 'lg-q') { clearTimeout(qt); qt = setTimeout(() => { const f = lgState(); f.q = el.value; f.n = 100; A.render(true); const b = $('[data-vc="lg-q"]'); if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); } }, 250); } });

  A.VIEW.performance = vPerformance; A.VIEW.activity = vActivity;
})();
