/* Ballast analysis library (pure functions, no DOM, no network). Exposes window.BL.ta / fa / risk / goals.
 * Everything here describes what data currently shows. Nothing is a forecast or a recommendation. */
(function (root) {
  'use strict';
  const BL = root.BL = root.BL || {};
  const fin = Number.isFinite;
  const mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
  const sd = a => { if (a.length < 2) return NaN; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1)); };
  const nans = n => new Array(n).fill(NaN);
  const lastFinite = a => { for (let i = a.length - 1; i >= 0; i--) if (fin(a[i])) return a[i]; return NaN; };

  /* ================================================================ TA */
  function sma(a, n) {
    const out = nans(a.length); let s = 0;
    for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; if (i >= n - 1) out[i] = s / n; }
    return out;
  }
  function ema(a, n) {
    const out = nans(a.length); let s = a.findIndex(fin); if (s < 0 || a.length - s < n) return out;
    const k = 2 / (n + 1); let prev = 0; for (let i = s; i < s + n; i++) prev += a[i]; prev /= n; out[s + n - 1] = prev;
    for (let i = s + n; i < a.length; i++) { prev = a[i] * k + prev * (1 - k); out[i] = prev; }
    return out;
  }
  function rsi(c, n) {
    n = n || 14; const out = nans(c.length); if (c.length <= n) return out;
    let g = 0, l = 0; for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; g += Math.max(d, 0); l += Math.max(-d, 0); }
    g /= n; l /= n; out[n] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    for (let i = n + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
    return out;
  }
  function macd(c, f, s, g) {
    f = f || 12; s = s || 26; g = g || 9; const ef = ema(c, f), es = ema(c, s);
    const line = c.map((_, i) => fin(ef[i]) && fin(es[i]) ? ef[i] - es[i] : NaN); const signal = ema(line, g);
    return { line: line, signal: signal, hist: line.map((v, i) => fin(v) && fin(signal[i]) ? v - signal[i] : NaN) };
  }
  function bollinger(c, n, k) {
    n = n || 20; k = k || 2; const mid = sma(c, n), up = nans(c.length), lo = nans(c.length), pb = nans(c.length), bw = nans(c.length);
    for (let i = n - 1; i < c.length; i++) {
      let v = 0; for (let j = i - n + 1; j <= i; j++) v += (c[j] - mid[i]) * (c[j] - mid[i]);
      const s = Math.sqrt(v / n); up[i] = mid[i] + k * s; lo[i] = mid[i] - k * s; pb[i] = up[i] === lo[i] ? 0.5 : (c[i] - lo[i]) / (up[i] - lo[i]); bw[i] = mid[i] ? (up[i] - lo[i]) / mid[i] : NaN;
    }
    return { mid: mid, up: up, lo: lo, pctB: pb, width: bw };
  }
  function trueRange(h, l, c) { return h.map((_, i) => i === 0 ? h[0] - l[0] : Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]))); }
  function atr(h, l, c, n) {
    n = n || 14; const tr = trueRange(h, l, c), out = nans(c.length); if (c.length <= n) return out;
    let a = 0; for (let i = 1; i <= n; i++) a += tr[i]; a /= n; out[n] = a;
    for (let i = n + 1; i < c.length; i++) { a = (a * (n - 1) + tr[i]) / n; out[i] = a; }
    return out;
  }
  function adx(h, l, c, n) {
    n = n || 14; const len = c.length, adxA = nans(len), pdi = nans(len), mdi = nans(len); if (len < 2 * n + 1) return { adx: adxA, pdi: pdi, mdi: mdi };
    const tr = trueRange(h, l, c); const pdm = [0], mdm = [0];
    for (let i = 1; i < len; i++) { const up = h[i] - h[i - 1], dn = l[i - 1] - l[i]; pdm.push(up > dn && up > 0 ? up : 0); mdm.push(dn > up && dn > 0 ? dn : 0); }
    let sTR = 0, sP = 0, sM = 0; for (let i = 1; i <= n; i++) { sTR += tr[i]; sP += pdm[i]; sM += mdm[i]; }
    const dx = nans(len);
    const put = i => { pdi[i] = sTR ? 100 * sP / sTR : 0; mdi[i] = sTR ? 100 * sM / sTR : 0; const t = pdi[i] + mdi[i]; dx[i] = t ? 100 * Math.abs(pdi[i] - mdi[i]) / t : 0; };
    put(n);
    for (let i = n + 1; i < len; i++) { sTR = sTR - sTR / n + tr[i]; sP = sP - sP / n + pdm[i]; sM = sM - sM / n + mdm[i]; put(i); }
    let a = 0; for (let i = n; i < 2 * n; i++) a += dx[i]; a /= n; adxA[2 * n - 1] = a;
    for (let i = 2 * n; i < len; i++) { a = (a * (n - 1) + dx[i]) / n; adxA[i] = a; }
    return { adx: adxA, pdi: pdi, mdi: mdi };
  }
  function obv(c, v) { const out = [0]; for (let i = 1; i < c.length; i++) out.push(out[i - 1] + (c[i] > c[i - 1] ? v[i] : c[i] < c[i - 1] ? -v[i] : 0)); return out; }

  /** Swing highs and lows clustered into price levels. Returns {support:[{price,touches}], resistance:[...]} nearest first. */
  function levels(h, l, price, w, lookback, tol) {
    w = w || 5; lookback = lookback || 250; tol = tol || 0.015; const from = Math.max(w, h.length - lookback); const raw = [];
    for (let i = from; i < h.length - w; i++) {
      let isH = true, isL = true; for (let j = i - w; j <= i + w; j++) { if (h[j] > h[i]) isH = false; if (l[j] < l[i]) isL = false; }
      if (isH) raw.push(h[i]); if (isL) raw.push(l[i]);
    }
    raw.sort((a, b) => a - b); const clusters = [];
    raw.forEach(p => { const c = clusters[clusters.length - 1]; if (c && Math.abs(p - c.mean) / c.mean <= tol) { c.sum += p; c.n++; c.mean = c.sum / c.n; } else clusters.push({ sum: p, n: 1, mean: p }); });
    const lv = clusters.map(c => ({ price: c.mean, touches: c.n }));
    return { support: lv.filter(x => x.price < price).sort((a, b) => b.price - a.price).slice(0, 3), resistance: lv.filter(x => x.price > price).sort((a, b) => a.price - b.price).slice(0, 3) };
  }
  function crossState(a, b, lookback) { // a above b now? and bars since last change
    let i = a.length - 1; if (!fin(a[i]) || !fin(b[i])) return null; const above = a[i] > b[i];
    for (let j = i; j >= Math.max(1, i - lookback); j--) { if (!fin(a[j - 1]) || !fin(b[j - 1])) break; if ((a[j - 1] > b[j - 1]) !== (a[j] > b[j])) return { above: above, barsAgo: i - j + 1 }; }
    return { above: above, barsAgo: null };
  }

  /** bars: [{t (ISO date), o,h,l,c,v}] ascending. */
  function technical(bars) {
    if (!bars || bars.length < 30) throw new Error('At least 30 price bars are needed for technical analysis.');
    const c = bars.map(b => b.c), h = bars.map(b => b.h), l = bars.map(b => b.l), v = bars.map(b => b.v || 0); const n = c.length, i = n - 1, px = c[i];
    const s20 = sma(c, 20), s50 = sma(c, 50), s200 = sma(c, 200), e12 = ema(c, 12), e26 = ema(c, 26);
    const r = rsi(c, 14), m = macd(c), bb = bollinger(c), at = atr(h, l, c, 14), ax = adx(h, l, c, 14), ob = obv(c, v);
    const back = k => n > k ? px / c[i - k] - 1 : NaN;
    const y0 = bars.findIndex(b => b.t.slice(0, 4) === bars[i].t.slice(0, 4)); const ytd = y0 > 0 ? px / c[y0 - 1] - 1 : NaN;
    const w52 = bars.slice(Math.max(0, n - 252)); const hi52 = Math.max.apply(null, w52.map(b => b.h)), lo52 = Math.min.apply(null, w52.map(b => b.l));
    const lr = []; for (let k = 1; k < n; k++) lr.push(Math.log(c[k] / c[k - 1]));
    const real30 = lr.length >= 30 ? sd(lr.slice(-30)) * Math.sqrt(252) : NaN;
    let peak = -Infinity, maxDD = 0; c.forEach(x => { if (x > peak) peak = x; const d = x / peak - 1; if (d < maxDD) maxDD = d; });
    const v20 = n >= 20 ? mean(v.slice(-20)) : NaN, v50 = n >= 50 ? mean(v.slice(-50)) : NaN;
    const lv = levels(h, l, px);
    const ind = { sma20: s20[i], sma50: s50[i], sma200: s200[i], ema12: e12[i], ema26: e26[i], rsi: r[i], macd: m.line[i], macdSignal: m.signal[i], macdHist: m.hist[i], bbUpper: bb.up[i], bbLower: bb.lo[i], bbPctB: bb.pctB[i], bbWidth: bb.width[i], atr: at[i], atrPct: at[i] / px * 100, adx: ax.adx[i], pdi: ax.pdi[i], mdi: ax.mdi[i] };
    const sig = []; const add = (name, view, note, weight) => sig.push({ name: name, view: view, note: note, weight: weight || 1 });
    const pctF = x => (Math.abs(x) * 100).toFixed(1) + '%';
    if (fin(ind.sma200)) add('Long-term trend', px > ind.sma200 ? 'bullish' : 'bearish', 'Price is ' + pctF(px / ind.sma200 - 1) + (px > ind.sma200 ? ' above' : ' below') + ' its 200-day average.', 2);
    if (fin(ind.sma50)) add('Medium-term trend', px > ind.sma50 ? 'bullish' : 'bearish', 'Price is ' + pctF(px / ind.sma50 - 1) + (px > ind.sma50 ? ' above' : ' below') + ' its 50-day average.', 2);
    const cx = crossState(s50, s200, 120);
    if (cx) add('50/200-day averages', cx.above ? 'bullish' : 'bearish', 'The 50-day average is ' + (cx.above ? 'above' : 'below') + ' the 200-day' + (cx.barsAgo != null ? ', a ' + (cx.above ? 'golden' : 'death') + ' cross ' + cx.barsAgo + ' trading days ago.' : '.'), 1);
    if (fin(ind.rsi)) {
      const t = ind.rsi; let view = 'neutral', note = 'RSI ' + t.toFixed(0) + ': ';
      if (t >= 70) { view = 'bearish'; note += 'overbought territory, so the recent run may be stretched.'; } else if (t <= 30) { view = 'bullish'; note += 'oversold territory, so recent selling may be stretched.'; }
      else if (t >= 55) { view = 'bullish'; note += 'positive momentum without being stretched.'; } else if (t <= 45) { view = 'bearish'; note += 'soft momentum.'; } else note += 'neutral momentum.';
      add('Momentum (RSI)', view, note, 1);
    }
    if (fin(ind.macd) && fin(ind.macdSignal)) {
      const mc = crossState(m.line, m.signal, 10);
      add('MACD', ind.macd > ind.macdSignal ? 'bullish' : 'bearish', 'MACD is ' + (ind.macd > ind.macdSignal ? 'above' : 'below') + ' its signal line' + (mc && mc.barsAgo != null ? ' after crossing ' + mc.barsAgo + ' trading days ago.' : '.'), 1);
    }
    if (fin(ind.bbPctB)) {
      let view = 'neutral', note = 'Price is inside its Bollinger bands.'; if (ind.bbPctB > 1) { view = 'bearish'; note = 'Price is above the upper Bollinger band, a stretched reading.'; } else if (ind.bbPctB < 0) { view = 'bullish'; note = 'Price is below the lower Bollinger band, a stretched reading.'; }
      const ws = bb.width.slice(-120).filter(fin); if (ws.length > 60 && ind.bbWidth <= ws.slice().sort((a, b) => a - b)[Math.floor(ws.length * 0.2)]) note += ' Bands are unusually tight, which often precedes a bigger move in either direction.';
      add('Bollinger bands', view, note, 1);
    }
    if (fin(ind.adx)) add('Trend strength (ADX)', ind.adx >= 25 ? (ind.pdi > ind.mdi ? 'bullish' : 'bearish') : 'neutral', 'ADX ' + ind.adx.toFixed(0) + (ind.adx >= 25 ? ': a firm ' + (ind.pdi > ind.mdi ? 'up' : 'down') + 'trend.' : ': no strong trend.'), 1);
    if (fin(v20) && fin(v50) && v50 > 0) {
      const obs = ob.slice(-20); const up = obs[obs.length - 1] > obs[0]; const pu = c[i] > c[i - 19];
      add('Volume', v20 > v50 * 1.15 && up === pu ? (pu ? 'bullish' : 'bearish') : 'neutral', '20-day volume is ' + (v20 / v50 * 100).toFixed(0) + '% of the 50-day average; accumulation flow (OBV) is ' + (up ? 'rising' : 'falling') + '.', 1);
    }
    const fromHi = px / hi52 - 1; add('52-week range', fromHi > -0.05 ? 'bullish' : fromHi < -0.3 ? 'bearish' : 'neutral', 'Price is ' + pctF(fromHi) + ' below its 52-week high and ' + pctF(px / lo52 - 1) + ' above its low.', 1);
    const wsum = sig.reduce((s, x) => s + x.weight, 0); const raw = sig.reduce((s, x) => s + x.weight * (x.view === 'bullish' ? 1 : x.view === 'bearish' ? -1 : 0), 0);
    const score = wsum ? Math.round(raw / wsum * 100) : 0;
    const label = score >= 50 ? 'Mostly positive signals' : score >= 15 ? 'Leaning positive' : score > -15 ? 'Mixed' : score > -50 ? 'Leaning negative' : 'Mostly negative signals';
    return { last: { date: bars[i].t, close: px, prev: c[i - 1] }, ind: ind, perf: { m1: back(21), m3: back(63), m6: back(126), y1: back(252), ytd: ytd },
      range: { hi52: hi52, lo52: lo52, fromHi: fromHi, fromLo: px / lo52 - 1 }, volatility: { realised30: real30, atrPct: ind.atrPct }, volume: { avg20: v20, avg50: v50 },
      drawdown: { max: maxDD, current: px / peak - 1 }, levels: lv, signals: sig, score: score, label: label,
      series: { sma20: s20, sma50: s50, sma200: s200, bbUp: bb.up, bbLo: bb.lo, rsi: r, macd: m.line, macdSignal: m.signal, macdHist: m.hist } };
  }

  /* ================================================================ FA */
  const R = (v, good, ok, higherBetter) => { if (!fin(v)) return null; if (higherBetter) return v >= good ? 'good' : v >= ok ? 'ok' : 'weak'; return v <= good ? 'good' : v <= ok ? 'ok' : 'weak'; };
  const pc = v => fin(v) ? (v * 100).toFixed(1) + '%' : 'n/a';
  const x2 = v => fin(v) ? v.toFixed(2) : 'n/a';
  const big = v => { if (!fin(v)) return 'n/a'; const a = Math.abs(v); const s = a >= 1e12 ? (a / 1e12).toFixed(2) + 'T' : a >= 1e9 ? (a / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (a / 1e6).toFixed(1) + 'M' : a.toFixed(0); return (v < 0 ? '-' : '') + s; };
  function scoreFundamentals(f) {
    if (!f) return null; const fund = /ETF|MUTUALFUND|FUND/i.test(f.quoteType || '') || (fin(f.expenseRatio) && !fin(f.trailingPE) && !fin(f.profitMargin));
    const groups = [];
    const G = (name, metrics, note) => { const rated = metrics.filter(m => m.rating); const s = rated.length ? Math.round(100 * rated.reduce((a, m) => a + (m.rating === 'good' ? 1 : m.rating === 'ok' ? 0.5 : 0), 0) / rated.length) : null; groups.push({ name: name, score: s, metrics: metrics, note: note || '' }); };
    const M = (label, value, text, rating, hint) => ({ label: label, value: value, text: text, rating: rating, hint: hint || '' });
    if (fund) {
      const top = (f.topHoldings || []).reduce((s, h) => s + (h.weight || 0), 0);
      G('Fund facts', [
        M('Expense ratio', f.expenseRatio, fin(f.expenseRatio) ? (f.expenseRatio * 100).toFixed(2) + '%' : 'n/a', R(f.expenseRatio, 0.002, 0.006, false), 'Lower is better. Index funds are often under 0.2%.'),
        M('Fund size', f.netAssets, big(f.netAssets), R(f.netAssets, 1e9, 1e8, true), 'Very small funds carry closure risk.'),
        M('Yield', f.yield, pc(f.yield), null),
        M('Year to date return', f.ytdReturn, pc(f.ytdReturn), null),
        M('Top holdings share', top || NaN, top ? (top * 100).toFixed(0) + '%' : 'n/a', top ? R(top, 0.25, 0.5, false) : null, 'How much of the fund sits in its ten largest holdings.')
      ], 'Company ratios do not apply to funds.');
    } else {
      G('Valuation', [
        M('Forward P/E', f.forwardPE, x2(f.forwardPE), R(f.forwardPE > 0 ? f.forwardPE : NaN, 15, 25, false), 'Price relative to expected earnings.'),
        M('Trailing P/E', f.trailingPE, x2(f.trailingPE), R(f.trailingPE > 0 ? f.trailingPE : NaN, 15, 25, false)),
        M('PEG ratio', f.pegRatio, x2(f.pegRatio), R(f.pegRatio > 0 ? f.pegRatio : NaN, 1, 2, false), 'P/E divided by earnings growth. Below 1 is usually cheap for the growth.'),
        M('Price / sales', f.priceToSales, x2(f.priceToSales), R(f.priceToSales, 2, 6, false)),
        M('Price / book', f.priceToBook, x2(f.priceToBook), R(f.priceToBook, 3, 6, false)),
        M('EV / EBITDA', f.evToEbitda, x2(f.evToEbitda), R(f.evToEbitda > 0 ? f.evToEbitda : NaN, 10, 18, false))
      ], 'Cheap is not the same as good value. Compare with companies in the same industry.');
      G('Profitability', [
        M('Gross margin', f.grossMargin, pc(f.grossMargin), R(f.grossMargin, 0.4, 0.2, true)),
        M('Operating margin', f.operatingMargin, pc(f.operatingMargin), R(f.operatingMargin, 0.2, 0.1, true)),
        M('Net margin', f.profitMargin, pc(f.profitMargin), R(f.profitMargin, 0.15, 0.05, true)),
        M('Return on equity', f.roe, pc(f.roe), R(f.roe, 0.15, 0.08, true)),
        M('Return on assets', f.roa, pc(f.roa), R(f.roa, 0.07, 0.03, true))
      ]);
      G('Growth', [
        M('Revenue growth (latest quarter, year on year)', f.revenueGrowth, pc(f.revenueGrowth), R(f.revenueGrowth, 0.1, 0.03, true)),
        M('Earnings growth (latest quarter, year on year)', f.earningsGrowth, pc(f.earningsGrowth), R(f.earningsGrowth, 0.1, 0, true))
      ]);
      const netCash = fin(f.totalCash) && fin(f.totalDebt) ? f.totalCash - f.totalDebt : NaN;
      G('Financial health', [
        M('Debt / equity', f.debtToEquity, x2(f.debtToEquity), R(f.debtToEquity, 0.5, 1.5, false), 'Banks and utilities normally run higher.'),
        M('Current ratio', f.currentRatio, x2(f.currentRatio), R(f.currentRatio, 1.5, 1, true)),
        M('Quick ratio', f.quickRatio, x2(f.quickRatio), R(f.quickRatio, 1, 0.7, true)),
        M('Free cash flow', f.freeCashflow, big(f.freeCashflow), fin(f.freeCashflow) ? (f.freeCashflow > 0 ? 'good' : 'weak') : null),
        M('Cash minus debt', netCash, big(netCash), fin(netCash) ? (netCash > 0 ? 'good' : 'ok') : null)
      ]);
      G('Income', [
        M('Dividend yield', f.dividendYield, pc(f.dividendYield), null),
        M('Payout ratio', f.payoutRatio, pc(f.payoutRatio), fin(f.payoutRatio) && f.payoutRatio > 0 ? R(f.payoutRatio, 0.6, 0.9, false) : null, 'Share of profit paid out. Above 100% is usually not sustainable.')
      ]);
    }
    const up = fin(f.targetMean) && fin(f.price) && f.price ? f.targetMean / f.price - 1 : NaN;
    if (fin(f.recommendationMean) || fin(up)) G('Analyst view', [
      M('Consensus (1 strong buy to 5 sell)', f.recommendationMean, fin(f.recommendationMean) ? f.recommendationMean.toFixed(1) + (f.analystCount ? ' from ' + f.analystCount + ' analysts' : '') : 'n/a', R(f.recommendationMean, 2, 3, false)),
      M('Average price target vs price', up, fin(up) ? (up >= 0 ? '+' : '-') + (Math.abs(up) * 100).toFixed(1) + '%' : 'n/a', fin(up) ? (up >= 0.15 ? 'good' : up >= 0 ? 'ok' : 'weak') : null, 'Analysts are often optimistic and slow to update.')
    ]);
    const sc = groups.filter(g => g.score != null && g.name !== 'Analyst view'); const overall = sc.length ? Math.round(mean(sc.map(g => g.score))) : null;
    return { kind: fund ? 'fund' : 'company', groups: groups, overall: overall, label: overall == null ? 'Not enough data' : overall >= 70 ? 'Strong on these measures' : overall >= 50 ? 'Mixed' : 'Weak on these measures' };
  }

  /* =============================================================== RISK */
  /** series: {SYM: [[date, close], ...]} ascending. Forward-fills across each market's holidays. Returns {dates, ret:{SYM:[...]}} using simple returns. */
  function alignReturns(series, minRows) {
    const syms = Object.keys(series).filter(s => series[s] && series[s].length > 20); if (syms.length === 0) return { dates: [], ret: {}, syms: [] };
    const start = syms.map(s => series[s][0][0]).sort().pop(); // latest first date
    const set = new Set(); syms.forEach(s => series[s].forEach(p => { if (p[0] >= start) set.add(p[0]); })); const dates = Array.from(set).sort();
    const px = {}; syms.forEach(s => { const m = new Map(series[s]); let last = NaN; const arr = []; dates.forEach(d => { if (m.has(d)) last = m.get(d); arr.push(last); }); px[s] = arr; });
    const ret = {}; syms.forEach(s => { ret[s] = []; for (let i = 1; i < dates.length; i++) ret[s].push(px[s][i - 1] > 0 && fin(px[s][i]) ? px[s][i] / px[s][i - 1] - 1 : 0); });
    if (dates.length - 1 < (minRows || 60)) return { dates: dates.slice(1), ret: ret, syms: syms, short: true };
    return { dates: dates.slice(1), ret: ret, syms: syms };
  }
  const cov = (a, b) => { const ma = mean(a), mb = mean(b); let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - ma) * (b[i] - mb); return s / (a.length - 1); };
  /** weights: {SYM: weight as fraction of whole portfolio (cash remainder counted as zero-risk)} */
  function riskAnalysis(series, weights, bench) {
    const al = alignReturns(series); const syms = al.syms.filter(s => weights[s] > 0); if (syms.length === 0 || al.dates.length < 30) return null;
    const T = al.dates.length, w = syms.map(s => weights[s]); const wsum = w.reduce((a, b) => a + b, 0);
    const vol = syms.map(s => sd(al.ret[s]) * Math.sqrt(252));
    const C = syms.map((a, i) => syms.map((b, j) => cov(al.ret[a], al.ret[b]) * 252));
    const sigma2 = w.reduce((s, wi, i) => s + w.reduce((t, wj, j) => t + wi * wj * C[i][j], 0), 0); const sigma = Math.sqrt(sigma2);
    const marg = syms.map((_, i) => w.reduce((t, wj, j) => t + wj * C[i][j], 0)); const rc = syms.map((_, i) => sigma2 ? w[i] * marg[i] / sigma2 : 0);
    const corr = syms.map((a, i) => syms.map((b, j) => C[i][j] / Math.sqrt(C[i][i] * C[j][j] || 1)));
    let pairs = 0, cs = 0; for (let i = 0; i < syms.length; i++) for (let j = i + 1; j < syms.length; j++) { cs += corr[i][j]; pairs++; }
    const port = []; for (let t = 0; t < T; t++) port.push(syms.reduce((s, sym, i) => s + w[i] * al.ret[sym][t], 0)); // cash sleeve returns 0
    let eq = 1, peak = 1, maxDD = 0; const curve = [{ date: al.dates[0], v: 100 }]; port.forEach((r, t) => { eq *= 1 + r; if (eq > peak) peak = eq; maxDD = Math.min(maxDD, eq / peak - 1); curve.push({ date: al.dates[t], v: eq * 100 }); });
    const sorted = port.slice().sort((a, b) => a - b); const q = p => sorted[Math.max(0, Math.floor(p * sorted.length) - 1)];
    const yrs = T / 252; const out = { syms: syms, weights: w, wsum: wsum, dates: al.dates, days: T, short: !!al.short, vol: vol, corr: corr, avgCorr: pairs ? cs / pairs : NaN,
      portVol: sigma, riskShare: rc, diversification: sigma ? w.reduce((s, wi, i) => s + wi * vol[i], 0) / sigma : NaN,
      effectiveHoldings: 1 / w.reduce((s, x) => s + (x / wsum) * (x / wsum), 0), effectiveBets: 1 / (rc.reduce((s, x) => s + x * x, 0) || 1),
      var95: q(0.05), worstDay: sorted[0], bestDay: sorted[sorted.length - 1], maxDrawdown: maxDD, cagr: yrs >= 0.5 ? Math.pow(eq, 1 / yrs) - 1 : NaN, curve: curve, totalReturn: eq - 1 };
    if (bench && bench.length > 20) { const bs = {}; bs.B = bench; const ba = alignReturns({ B: bench, P: al.dates.map((d, i) => [d, curve[i + 1].v]) }); if (ba.ret.B && ba.ret.P && ba.dates.length > 30) { const v = sd(ba.ret.B) ** 2; out.beta = v ? cov(ba.ret.P, ba.ret.B) / v : NaN; out.benchVol = sd(ba.ret.B) * Math.sqrt(252); } }
    return out;
  }

  /* ============================================================== GOALS */
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  /** Deterministic projection at a constant annual return with monthly contributions. */
  function project(p) {
    const months = Math.round(p.years * 12), r = Math.pow(1 + p.ret, 1 / 12) - 1; let v = p.start; const path = [{ m: 0, v: v }];
    for (let m = 1; m <= months; m++) { v = v * (1 + r) + p.monthly; path.push({ m: m, v: v }); }
    return { end: v, path: path, contributed: p.start + p.monthly * months };
  }
  /** Monthly contribution needed to reach target. */
  function requiredMonthly(p) {
    const months = Math.round(p.years * 12); if (months <= 0) return NaN; const r = Math.pow(1 + p.ret, 1 / 12) - 1;
    const fvStart = p.start * Math.pow(1 + r, months); const ann = r === 0 ? months : (Math.pow(1 + r, months) - 1) / r;
    return Math.max(0, (p.target - fvStart) / ann);
  }
  /** Monte Carlo with log-normal monthly returns. Returns yearly percentile bands and the chance of reaching the target. */
  function monteCarlo(p) {
    const sims = p.sims || 2000, months = Math.round(p.years * 12), rnd = mulberry32(p.seed || 12345);
    const mu = (p.ret - 0.5 * p.vol * p.vol) / 12, s = p.vol / Math.sqrt(12); const ends = [], yearly = []; for (let y = 0; y <= Math.ceil(months / 12); y++) yearly.push([]);
    let hit = 0;
    for (let k = 0; k < sims; k++) {
      let v = p.start; yearly[0].push(v);
      for (let m = 1; m <= months; m++) {
        const u1 = Math.max(rnd(), 1e-12), u2 = rnd(); const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        v = v * Math.exp(mu + s * z) + p.monthly; if (m % 12 === 0 || m === months) yearly[Math.ceil(m / 12)].push(v);
      }
      ends.push(v); if (p.target && v >= p.target) hit++;
    }
    const pct = (arr, q) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * a.length))]; };
    return { chance: p.target ? hit / sims : NaN, bands: yearly.map((arr, y) => ({ year: y, p10: pct(arr, 0.1), p25: pct(arr, 0.25), p50: pct(arr, 0.5), p75: pct(arr, 0.75), p90: pct(arr, 0.9) })), sims: sims };
  }

  BL.ta = { sma: sma, ema: ema, rsi: rsi, macd: macd, bollinger: bollinger, atr: atr, adx: adx, obv: obv, levels: levels, technical: technical, lastFinite: lastFinite };
  BL.fa = { score: scoreFundamentals, big: big, pc: pc };
  BL.risk = { alignReturns: alignReturns, analyse: riskAnalysis };
  BL.goals = { project: project, requiredMonthly: requiredMonthly, monteCarlo: monteCarlo, mulberry32: mulberry32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = BL;
})(typeof window !== 'undefined' ? window : globalThis);
