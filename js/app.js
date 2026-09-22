(function(){
'use strict';
const BL=window.BL; const CFG=window.BALLAST_CONFIG||{};
BL.ver=BL.ver||{}; BL.ver.app=12;
/* Version tracking. Each file records the release it last changed in. If one of them on your site is older than this file expects, Ballast says which. */
const RELEASE={n:12,date:'2026-09-22'};
const REQUIRES={'lib-core':9,'cloud':6,'views-history':8,'boot':6};
function versionRows(){ const v=BL.ver||{}; const rows=[{file:'app.js',have:RELEASE.n,need:RELEASE.n}]; Object.keys(REQUIRES).forEach(k=>rows.push({file:k+'.js',have:v[k]==null?null:v[k],need:REQUIRES[k]})); rows.forEach(r=>{ r.ok=r.have!=null&&r.have>=r.need; }); return rows; }
function versionProblems(){ return versionRows().filter(r=>!r.ok); }
const {fin,num,esc,sum,parseCSV,isIBKR,parseIBKR,safeUrl,csvCell,cleanJson}=BL.core;

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */
const KEY='ballast.v2';
const REGIONS=['United States','Europe & UK','Japan','Asia-Pacific ex-Japan','China','Emerging ex-China','Other'];
const REGION_TAGS=REGIONS.concat(['Global fund','Emerging (broad)']);
const CLASSES=['Equity','Fixed income','Real assets','Cash','Crypto & other'];
const LOOK={
  'Global fund':{'United States':63,'Europe & UK':16,'Japan':5.5,'Asia-Pacific ex-Japan':3.5,'China':3,'Emerging ex-China':6.5,'Other':2.5},
  'Emerging (broad)':{'China':27,'Emerging ex-China':73}
};
const REGION_PROFILES={
  'Global market weight':{'United States':62,'Europe & UK':16,'Japan':5.5,'Asia-Pacific ex-Japan':4,'China':3,'Emerging ex-China':7,'Other':2.5},
  'Less US-heavy':{'United States':45,'Europe & UK':20,'Japan':8,'Asia-Pacific ex-Japan':7,'China':5,'Emerging ex-China':12,'Other':3},
  'Asia tilt':{'United States':40,'Europe & UK':15,'Japan':10,'Asia-Pacific ex-Japan':12,'China':8,'Emerging ex-China':12,'Other':3}
};
const CLASS_PROFILES={
  'Growth':{'Equity':85,'Fixed income':5,'Real assets':5,'Cash':5,'Crypto & other':0},
  'Balanced':{'Equity':60,'Fixed income':25,'Real assets':10,'Cash':5,'Crypto & other':0},
  'Conservative':{'Equity':35,'Fixed income':45,'Real assets':10,'Cash':10,'Crypto & other':0}
};
const CAND={
  region:{
    'United States':[['VOO','Vanguard S&P 500 ETF'],['VTI','Vanguard Total Stock Market ETF'],['CSPX','iShares Core S&P 500 UCITS (LSE)']],
    'Europe & UK':[['VGK','Vanguard FTSE Europe ETF'],['IEUR','iShares Core MSCI Europe ETF'],['EZU','iShares MSCI Eurozone ETF']],
    'Japan':[['EWJ','iShares MSCI Japan ETF'],['BBJP','JPMorgan BetaBuilders Japan ETF']],
    'Asia-Pacific ex-Japan':[['EPP','iShares MSCI Pacific ex Japan ETF'],['EWA','iShares MSCI Australia ETF'],['EWS','iShares MSCI Singapore ETF']],
    'China':[['MCHI','iShares MSCI China ETF'],['FXI','iShares China Large-Cap ETF'],['ASHR','Xtrackers Harvest CSI 300 China A-Shares ETF']],
    'Emerging ex-China':[['EMXC','iShares MSCI Emerging Markets ex China ETF'],['INDA','iShares MSCI India ETF'],['EWT','iShares MSCI Taiwan ETF']],
    'Other':[['EWC','iShares MSCI Canada ETF']]
  },
  cls:{
    'Equity':[['VT','Vanguard Total World Stock ETF'],['VWRA','Vanguard FTSE All-World UCITS (LSE)'],['IWDA','iShares Core MSCI World UCITS (LSE)']],
    'Fixed income':[['AGG','iShares Core US Aggregate Bond ETF'],['BNDX','Vanguard Total International Bond ETF'],['IEF','iShares 7-10 Year Treasury Bond ETF']],
    'Real assets':[['GLD','SPDR Gold Shares'],['IAU','iShares Gold Trust'],['VNQI','Vanguard Global ex-US Real Estate ETF']],
    'Cash':[['SGOV','iShares 0-3 Month Treasury Bond ETF'],['BIL','SPDR Bloomberg 1-3 Month T-Bill ETF']],
    'Crypto & other':[]
  }
};
const KNOWN={};
(function(){
  const reg=(syms,region,cls,sector)=>syms.split(' ').forEach(s=>KNOWN[s]={region:region,cls:cls||'Equity',sector:sector||'Diversified fund'});
  reg('SPY VOO IVV VTI QQQ IWM DIA SCHD VUG VTV CSPX VUAA SPLG ITOT','United States');
  reg('VT ACWI VWRA VWRL IWDA SWRD URTH','Global fund');
  reg('VGK IEUR EZU FEZ VEUR IEV EWG EWQ EWU ISF','Europe & UK');
  reg('EWJ BBJP DXJ JPXN','Japan');
  reg('EPP EWA EWS EWH','Asia-Pacific ex-Japan');
  reg('MCHI FXI KWEB ASHR GXC CQQQ','China');
  reg('VWO IEMG EEM EIMI','Emerging (broad)');
  reg('EMXC INDA EPI EWZ EWT EWY SMIN','Emerging ex-China');
  reg('AGG BND BNDX TLT IEF SHY LQD HYG TIP VCIT AGGU','United States','Fixed income');
  reg('SGOV BIL SHV','United States','Cash');
  reg('GLD IAU GLDM SLV SGOL IAUM','Global fund','Real assets','Commodity fund');
  reg('VNQ VNQI REET DBC GSG','Global fund','Real assets');
  reg('IBIT FBTC GBTC ETHA BITO','Global fund','Crypto & other');
  const one=(syms,region,sector)=>syms.split(' ').forEach(s=>KNOWN[s]={region:region,cls:'Equity',sector:sector||'Unclassified'});
  one('TSM','Emerging ex-China','Technology'); one('ASML SAP','Europe & UK','Technology'); one('NVO AZN','Europe & UK','Health care');
  one('SHEL','Europe & UK','Energy'); one('TM','Japan','Consumer discretionary'); one('SONY','Japan','Consumer discretionary');
  one('BABA PDD JD','China','Consumer discretionary'); one('BIDU','China','Communication');
})();
const SECT={AAPL:'Technology',MSFT:'Technology',NVDA:'Technology',AVGO:'Technology',GOOGL:'Communication',GOOG:'Communication',META:'Communication',
  AMZN:'Consumer discretionary',TSLA:'Consumer discretionary','BRK B':'Financials',JPM:'Financials',V:'Financials',MA:'Financials',
  JNJ:'Health care',UNH:'Health care',LLY:'Health care',XOM:'Energy',CVX:'Energy',WMT:'Consumer staples',PG:'Consumer staples',KO:'Consumer staples'};
const SECTORS=['Technology','Communication','Consumer discretionary','Consumer staples','Financials','Health care','Industrials','Energy','Utilities','Materials','Real estate','Diversified fund','Commodity fund','Unclassified'];
const DEFAULT_INDICES=[
  {name:'S&P 500',symbol:'^GSPC'},{name:'Nasdaq Composite',symbol:'^IXIC'},{name:'STOXX Europe 600',symbol:'^STOXX'},
  {name:'FTSE 100',symbol:'^FTSE'},{name:'Nikkei 225',symbol:'^N225'},{name:'Hang Seng',symbol:'^HSI'},
  {name:'Shanghai Composite',symbol:'^SSEC'},{name:'Nifty 50',symbol:'^NSEI'},{name:'US 10-year yield',symbol:'^TNX'},
  {name:'Gold futures',symbol:'GC=F'},{name:'VIX',symbol:'^VIX'},{name:'US dollar index',symbol:'DX-Y.NYB'}
];
const HIGH=/\b(downgrad\w*|lawsuit|sues?|sued|probe|investigat\w*|fraud|recall\w*|bankrupt\w*|default\w*|delist\w*|halts?|profit warning|guidance cut|plunge\w*|plummet\w*|tumbl\w*|short[- ]seller|sec charges|subpoena|breach|cyber ?attack|resign\w*|misses)\b|\bcuts? (?:its )?(?:guidance|forecast|outlook)\b/i;
const MED=/\b(earnings|results|guidance|outlook|dividend|merger|acquir\w*|acquisition|takeover|buyback|upgrad\w*|layoffs?|job cuts|regulat\w*|antitrust|tariff\w*|offering|stake|ceo|cfo|forecast)\b/i;

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
const $=(s,r)=>(r||document).querySelector(s);
const $$=(s,r)=>Array.from((r||document).querySelectorAll(s));
const slug=k=>String(k).replace(/\W+/g,'-');
const escRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const MINUS='\u2212';
const spct=(v,d)=>fin(v)?((v>0.0004?'+':v<-0.0004?MINUS:'')+Math.abs(v).toFixed(d==null?1:d)+'%'):'–';
const pct=(v,d)=>fin(v)?v.toFixed(d==null?1:d)+'%':'–';
const cls=v=>fin(v)?(v>0.0004?'gain':v<-0.0004?'loss':''):'';
const nf0=new Intl.NumberFormat('en-US',{maximumFractionDigits:0});
const nfc={};
function money(v,d){ d=d||0; if(!fin(v)) return '–'; try{ const k=state.base+d; nfc[k]=nfc[k]||new Intl.NumberFormat('en-US',{style:'currency',currency:state.base,minimumFractionDigits:d,maximumFractionDigits:d}); return nfc[k].format(v).replace('-',MINUS); }catch(e){ return nf0.format(v)+' '+state.base; } }
const smoney=v=>fin(v)?((v>0.5?'+':v<-0.5?MINUS:'')+money(Math.abs(v))):'–';
const qtyFmt=v=>fin(v)?(Math.abs(v)>=1000?nf0.format(v):String(+v.toFixed(4))):'–';
const px=v=>fin(v)?v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:v<10?4:2}):'–';
function fdate(iso){ try{ const d=new Date(iso); if(isNaN(d)) return ''; return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }catch(e){ return ''; } }
function ago(iso){ const t=new Date(iso).getTime(); if(!fin(t)) return ''; const h=(Date.now()-t)/36e5; if(h<1) return 'just now'; if(h<48) return Math.round(h)+' h ago'; const d=Math.round(h/24); return d<60?d+' days ago':fdate(iso); }
const catColor=i=>'var(--c'+((i%8)+1)+')';
const store={mem:{},get(k){ try{ return localStorage.getItem(k); }catch(e){ return this.mem[k]==null?null:this.mem[k]; } },set(k,v){ try{ localStorage.setItem(k,v); }catch(e){ this.mem[k]=v; } },remove(k){ try{ localStorage.removeItem(k); }catch(e){} delete this.mem[k]; }};
const flagSvg=on=>'<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M3.5 1.5v13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M3.5 2.5h9l-2.2 3.2 2.2 3.3h-9z" fill="'+(on?'currentColor':'none')+'" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';

/* ------------------------------------------------------------------ *
 * State
 * ------------------------------------------------------------------ */
function blank(){
  return {v:2,base:'USD',fx:{},fxImplied:{},fxSrc:{},positions:[],cash:[],snaps:[],navExtra:[],asOf:'',asOfLabel:'',stmtNav:null,accr:0,demo:false,
    tg:{regionProfile:'Global market weight',clsProfile:'Growth',region:Object.assign({},REGION_PROFILES['Global market weight']),cls:Object.assign({},CLASS_PROFILES.Growth)},
    watch:[],feed:null,newsManual:[],ai:{},
    src:{custom:[],indices:DEFAULT_INDICES.map(x=>Object.assign({},x)),queries:[],days:7},
    goal:{target:'',years:20,monthly:'',ret:6,vol:15,infl:2},bench:'^GSPC',
    set:{live:true,tol:5,dd:15,conc:10,move:4,theme:'auto',estate:true,keepCopies:true}};
}
let state=load();
function load(){
  const b=blank();
  try{ const raw=store.get(KEY); if(raw) merge(b,JSON.parse(raw)); }catch(e){}
  return normalise(b);
}
function upgradeSnap(s){
  if(!s||typeof s!=='object') return null;
  const to=s.to||s.key; if(!to) return null;
  const c=Object.assign({},s.change);
  if(!s.change){ if(fin(s.dep)) c['Deposits & Withdrawals']=s.dep; if(fin(s.div)) c['Dividends']=s.div; if(fin(s.int)) c['Interest']=s.int; if(fin(s.comm)) c['Commissions']=s.comm; }
  return Object.assign({},s,{from:s.from||to,to:to,key:s.key||to,change:c,navStart:fin(s.navStart)?s.navStart:(fin(s.start)?s.start:NaN),ledger:Array.isArray(s.ledger)?s.ledger:[],sections:Array.isArray(s.sections)?s.sections:[]});
}
function normalise(b){
  b.snaps=(b.snaps||[]).map(upgradeSnap).filter(Boolean).sort((x,y)=>x.to>y.to?1:x.to<y.to?-1:0);
  ['positions','cash','watch','newsManual','navExtra'].forEach(k=>{ if(!Array.isArray(b[k])) b[k]=[]; });
  b.navExtra=b.navExtra.filter(x=>x&&fin(x.nav)&&/^\d{4}-\d{2}-\d{2}$/.test(x.date));
  if(!b.set||typeof b.set!=='object') b.set=blank().set;
  if(!b.fxSrc||typeof b.fxSrc!=='object') b.fxSrc={};
  return b;
}
function merge(b,s){
  if(!s||typeof s!=='object'||Array.isArray(s)) return b;
  s=cleanJson(s);
  for(const k of Object.keys(s)){
    if(['tg','src','set','fx','fxImplied','fxSrc','ai','goal'].includes(k)&&s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])) b[k]=Object.assign(b[k]||{},s[k]);
    else if(Array.isArray(b[k])&&!Array.isArray(s[k])) continue;
    else b[k]=s[k];
  }
  return b;
}
let saveT=0;
const persist={mode:'local',pass:null,blocked:false,status:'idle',err:'',migrated:false,last:0,email:''};
function save(){ clearTimeout(saveT); persist.status='pending'; setBadge(); saveT=setTimeout(persistNow,persist.mode==='drive'?900:150); }
async function persistNow(){
  if(persist.blocked){ persist.status='blocked'; setBadge(); return; }
  if(persist.mode==='drive'){
    persist.status='saving'; setBadge();
    try{
      await BL.cloud.save(state,persist.pass); persist.status='idle'; persist.err=''; persist.last=Date.now();
      if(persist.migrated){ persist.migrated=false; store.remove(KEY); toast('Moved to your Drive. The copy in this browser was removed.'); }
    }catch(e){ persist.status='error'; persist.err=e.message||'Save failed.'; }
  } else { store.set(KEY,JSON.stringify(state)); persist.status='idle'; }
  setBadge();
}
function footHtml(){
  const st=persist.status; let line;
  if(persist.mode==='drive') line=st==='saving'||st==='pending'?'Saving to your Google Drive…':st==='error'?'<b class="loss">Could not save to Drive.</b> '+esc(persist.err)+' It will retry on your next change.':st==='blocked'?'<b class="loss">Saving is paused</b> until the problem on the sign-in screen is fixed.':'Saved to your Google Drive'+(persist.pass?', encrypted':'')+'.';
  else line='Saved in this browser only. <button class="link" data-a="go" data-v="data">Set up Drive sync</button>';
  return line+'<br><span class="muted">Statements are read in your browser and never uploaded.</span><br><span class="muted">Version '+RELEASE.n+' · '+esc(RELEASE.date)+(versionProblems().length?' · <b class="loss">some files are out of date</b>':'')+'</span>';
}
function setBadge(){ const f=$('#foot'); if(f) f.innerHTML=footHtml(); }


const ui={view:'overview',tk:'stress',dim:'region',mk:'prices',sortK:'val',sortD:-1,q:'',filt:'all',newsF:'flagged',gen:null,log:[],
  stress:{'Equity':-20,'Fixed income':0,'Real assets':0,'Crypto & other':-30,fx:-5},contrib:0,aiBusy:false,aiText:'',newsBusy:false,ctl:null};
const caps={};
let ledgerMemo=null, perfMemo=null;
function getLedger(){ return ledgerMemo||(ledgerMemo=BL.core.combineLedgers(state.snaps.map(s=>s.ledger||[]))); }
function getPerf(){ return perfMemo||(perfMemo=BL.core.performance(state.snaps,state.navExtra,{base:state.base,rate:fxRate})); }

/* ------------------------------------------------------------------ *
 * Model
 * ------------------------------------------------------------------ */
function fxRate(c){ if(c===state.base) return 1; const r=state.fx[c]; return r>0?r:null; }
function livePrice(p){ return state.set.live?quotePrice(p):null; }
function quotePrice(p){
  if(!state.feed||!state.feed.quotes) return null;
  const q=state.feed.quotes[p.symbol]; if(!q||!fin(q.price)) return null;
  let v=q.price; const qc=q.currency;
  if(qc&&qc!==p.ccy){ if(qc==='GBp'&&p.ccy==='GBP') v=v/100; else if(qc==='GBP'&&p.ccy==='GBp') v=v*100; else return null; }
  return v;
}
let memo=null;
function M(){
  if(memo) return memo;
  const missing=new Set();
  const rows=state.positions.map(p=>{
    const lp=livePrice(p); const price=lp!=null?lp:p.price; const r=fxRate(p.ccy); if(r==null) missing.add(p.ccy);
    const nat=p.qty*price*(p.mult||1); const val=nat*(r==null?1:r);
    const hasCost=fin(p.cost); const pnl=hasCost?(nat-p.cost)*(r==null?1:r):NaN;
    return Object.assign({},p,{live:lp!=null,px:price,r:r,nat:nat,val:val,pnl:pnl,pnlPct:hasCost&&p.cost?(nat-p.cost)/Math.abs(p.cost)*100:NaN});
  });
  const cash=state.cash.map(c=>{ const r=fxRate(c.ccy); if(r==null) missing.add(c.ccy); return Object.assign({},c,{val:c.amount*(r==null?1:r)}); });
  const inv=sum(rows,r=>r.val), cashV=sum(cash,c=>c.val), nav=inv+cashV, accr=state.accr>0?state.accr:0;
  rows.forEach(r=>{ r.w=nav?r.val/nav*100:0; });
  memo={rows:rows,cash:cash,inv:inv,cashV:cashV,nav:nav,accr:accr,total:nav+accr,missing:Array.from(missing)};
  return memo;
}
function dirty(){ memo=null; ledgerMemo=null; perfMemo=null; save(); }
function exposure(m,dim){
  const map=new Map(); const add=(k,v)=>{ if(v) map.set(k,(map.get(k)||0)+v); };
  let keys;
  if(dim==='class'){ keys=CLASSES; m.rows.forEach(r=>add(r.cls,r.val)); add('Cash',m.cashV); }
  else if(dim==='region'){
    keys=REGIONS;
    m.rows.filter(r=>r.cls==='Equity').forEach(r=>{ const lt=LOOK[r.region]; if(lt){ for(const k in lt) add(k,r.val*lt[k]/100); } else add(REGIONS.includes(r.region)?r.region:'Other',r.val); });
  }
  else if(dim==='currency'){ m.rows.forEach(r=>add(r.ccy,r.val)); m.cash.forEach(c=>add(c.ccy,c.val)); keys=Array.from(map.keys()); }
  else { m.rows.filter(r=>r.cls==='Equity').forEach(r=>add(r.sector||'Unclassified',r.val)); keys=Array.from(map.keys()); }
  const total=dim==='class'?m.nav:sum(Array.from(map.values()));
  const items=keys.map(k=>{ const v=map.get(k)||0; return {key:k,val:v,pct:total?v/total*100:0}; });
  if(dim==='currency'||dim==='sector') items.sort((a,b)=>b.val-a.val);
  return {items:items,total:total};
}
function alloc(rows,add){
  rows.forEach(r=>{ r.add=0; });
  const pos=rows.filter(r=>r.gap>0); const sp=sum(pos,r=>r.gap);
  if(add<=0||sp<=0) return;
  pos.forEach(r=>{ r.add=add*r.gap/sp; });
}
function calcBuckets(kind,add){
  const m=M(); const e=exposure(m,kind); const tg=state.tg[kind==='class'?'cls':'region'];
  const keys=e.items.map(i=>i.key); const raw=sum(keys,k=>+tg[k]||0); const sT=raw||1;
  const total=e.total+(add||0);
  const rows=e.items.map(i=>{ const t=(+tg[i.key]||0)/sT*100; return {key:i.key,val:i.val,now:i.pct,t:t,gap:total*t/100-i.val,drift:i.pct-t,add:0}; });
  alloc(rows,add||0);
  return {rows:rows,total:e.total,sumT:raw};
}
function isDeriv(p){ return /option|future|warrant|cfd/i.test(p.asset||''); }

/* ------------------------------------------------------------------ *
 * Parsing: CSV, IBKR statements, generic broker files
 * ------------------------------------------------------------------ */
function inferRegion(sym,ccy,exch){
  if(KNOWN[sym]) return {region:KNOWN[sym].region,auto:false};
  const ex=(exch||'').toUpperCase();
  const byEx=[[/^(NYSE|NASDAQ|ARCA|AMEX|BATS|ISLAND|PINK|NYSE ?ARCA|IEX)/,'United States'],[/^SEHK|^HKFE/,'China'],[/^TSE\.JPN|^TSEJ|^JPX|^OSE/,'Japan'],[/^ASX|^SGX|^NZX/,'Asia-Pacific ex-Japan'],[/^NSE|^BSE|^KRX|^TWSE|^BOVESPA|^JSE/,'Emerging ex-China'],[/^(LSE|IBIS|EBS|SBF|AEB|BVME|BM$|SWX|VSE|OMX|CPH|HEX|SFB|WSE|ENEXT)/,'Europe & UK'],[/^(TSE$|VENTURE|TSXV)/,'Other']];
  for(const p of byEx) if(p[0].test(ex)) return {region:p[1],auto:true};
  const byC={USD:'United States',EUR:'Europe & UK',GBP:'Europe & UK',CHF:'Europe & UK',SEK:'Europe & UK',NOK:'Europe & UK',DKK:'Europe & UK',PLN:'Europe & UK',JPY:'Japan',CNH:'China',CNY:'China',HKD:'China',SGD:'Asia-Pacific ex-Japan',AUD:'Asia-Pacific ex-Japan',NZD:'Asia-Pacific ex-Japan',INR:'Emerging ex-China',KRW:'Emerging ex-China',TWD:'Emerging ex-China',BRL:'Emerging ex-China',MXN:'Emerging ex-China',ZAR:'Emerging ex-China',CAD:'Other'};
  return {region:byC[ccy]||'Other',auto:true};
}
function inferClass(asset,desc,sym){
  if(KNOWN[sym]) return KNOWN[sym].cls;
  if(/bond/i.test(asset)) return 'Fixed income';
  if(/forex/i.test(asset)) return 'Cash';
  if(/option|future|warrant|cfd/i.test(asset)) return 'Crypto & other';
  if(/money market|\bmmf\b|treasury bill|t-bill/i.test(desc||'')) return 'Cash';
  if(/bitcoin|ethereum|crypto/i.test(desc||'')) return 'Crypto & other';
  return 'Equity';
}
function yahooGuess(p){
  const s=String(p.symbol).replace(/\s+/g,'-'); const ex=(p.exch||'').toUpperCase();
  if(/^LSE/.test(ex)) return s+'.L';
  const suf={GBP:'.L',JPY:'.T',SGD:'.SI',AUD:'.AX',CAD:'.TO',INR:'.NS'}[p.ccy];
  if(p.ccy==='HKD') return String(p.symbol).padStart(4,'0')+'.HK';
  return suf?s+suf:s;
}
function buildPosition(raw,info,old){
  const sym=raw.symbol,inf=info[sym]||{};
  const desc=(old&&old.desc)||inf.desc||raw.desc||sym;
  const k=KNOWN[sym]; const rg=inferRegion(sym,raw.ccy,inf.exch||raw.exch);
  const price=fin(raw.price)?raw.price:(fin(raw.value)&&raw.qty?raw.value/(raw.qty*(raw.mult||1)):NaN);
  const p={id:sym+'|'+raw.ccy,symbol:sym,desc:desc,asset:raw.asset||'Stocks',cls:raw.cls||inferClass(raw.asset||'',desc,sym),ccy:raw.ccy,qty:raw.qty,mult:raw.mult||1,
    cost:fin(raw.cost)?raw.cost:null,price:price,exch:inf.exch||raw.exch||'',region:rg.region,auto:rg.auto,
    sector:(k&&k.sector)||SECT[sym]||(/ETF|fund/i.test(inf.type||desc)?'Diversified fund':'Unclassified'),flag:false,notes:'',aliases:'',yahoo:'',target:''};
  if(old){ ['flag','notes','aliases','yahoo','sector'].forEach(f=>{ p[f]=old[f]; }); if(!old.auto){ p.region=old.region; p.auto=false; } p.cls=old.cls; }
  return p;
}
function adoptHoldings(r){
  const old={}; state.positions.forEach(p=>{ old[p.id]=p; });
  if(r.base) { if(r.base!==state.base){ state.fx={}; state.fxImplied={}; state.fxSrc={}; } state.base=r.base; }
  Object.keys(r.fx||{}).forEach(c=>setRate(c,r.fx[c],'statement'));
  state.positions=r.positions.filter(p=>p.symbol&&fin(p.qty)).map(p=>buildPosition(p,r.info,old[p.symbol+'|'+p.ccy]));
  state.cash=r.cash; state.asOf=r.key; state.asOfLabel=r.label; state.stmtNav=fin(r.nav)?r.nav:null; state.accr=fin(r.accruals)?r.accruals:0; state.demo=false;
  solveFx(r.nav);
}
function solveFx(target){
  const amt={}; state.positions.forEach(p=>{ amt[p.ccy]=(amt[p.ccy]||0)+p.qty*p.price*p.mult; });
  state.cash.forEach(c=>{ amt[c.ccy]=(amt[c.ccy]||0)+c.amount; });
  const foreign=Object.keys(amt).filter(c=>c!==state.base&&Math.abs(amt[c])>0);
  if(foreign.length===1&&fin(target)){
    const c=foreign[0]; const rate=(target-(amt[state.base]||0))/amt[c];
    if(rate>0&&fin(rate)) setRate(c,rate,'implied');
  }
}
/* Exchange rates. state.fx[c] is the value of ONE unit of currency c in the base currency (1 USD = 1.28 SGD gives fx.USD = 1.28).
 * Where a rate came from is kept in state.fxSrc: manual (typed by you), statement (the statement's own closing rate), market (a live rate),
 * implied (worked backwards from the statement total). A rate you typed is never replaced automatically. */
/* ---- cleaned statement copies and recalculation ---- */
function copyStats(){ const stale=state.snaps.filter(s=>(s.pv||1)<BL.core.PARSER_VERSION); return {total:state.snaps.length,withCopy:state.snaps.filter(s=>s.raw).length,stale:stale,staleWithCopy:stale.filter(s=>s.raw).length,staleNoCopy:stale.filter(s=>!s.raw).length}; }
function recalcFromSaved(){
  const list=[]; let skipped=0;
  state.snaps.forEach(s=>{ if(!s.raw){ skipped++; return; } try{ const r=parseIBKR(s.raw); r.raw=s.raw; list.push(r); }catch(e){ skipped++; } });
  if(!list.length) return {done:0,skipped:skipped};
  ingest(list); return {done:list.length,skipped:skipped};
}
function recalcNote(){
  if(state.demo||!state.snaps.length) return ''; const c=copyStats(); if(!c.stale.length) return ''; const parts=[];
  if(c.staleWithCopy) parts.push('Ballast now reads statements more completely (reported returns and exchange rates). <button class="link" data-a="recalc">Recalculate '+c.staleWithCopy+' statement'+(c.staleWithCopy>1?'s':'')+'</button> from the copies it saved.');
  if(c.staleNoCopy) parts.push(c.staleNoCopy+' statement'+(c.staleNoCopy>1?'s were':' was')+' imported before Ballast kept cleaned copies, so '+(c.staleNoCopy>1?'they are':'it is')+' missing those details. <button class="link" data-a="go" data-v="data">Import '+(c.staleNoCopy>1?'them':'it')+' once more</button>. After that the Recalculate button works without the files.');
  return '<div class="banner info">'+parts.join(' ')+'</div>';
}
/* ---- quick actions on the Overview ---- */
/** Statement values: the statement's own prices and exchange rates. Live prices: prices from the feed with market rates, so both come from the same place. */
async function setValueMode(live){
  state.set.live=!!live; dirty();
  try{
    if(!live){ if(copyStats().withCopy){ recalcFromSaved(); toast('Showing statement values'); } else toast('Showing statement values. Import your statements once more to restore the statement\'s exchange rates.'); }
    else if(liveInUse()){ if(BL.cloud.apiConfigured()&&BL.cloud.hasIdToken()) await fetchRates(true); toast('Showing live prices'); }
    else toast('Live prices are on. Press Refresh market data to load them.');
  }catch(e){ toast(e.message); }
  render(true);
}
function quickBar(){
  if(state.demo||!state.positions.length) return '';
  const api=BL.cloud.apiConfigured(), id=BL.cloud.hasIdToken(), cs=copyStats(), live=!!state.set.live, lu=liveInUse(), t=tracked(); const b=[];
  b.push('<div class="chips" role="group" aria-label="Values shown"><button class="chip" aria-pressed="'+(!live)+'" data-a="values" data-v="statement">Statement values</button><button class="chip" aria-pressed="'+live+'" data-a="values" data-v="live">Live prices</button></div>');
  if(api) b.push(id?'<button class="btn sm" data-a="refresh-feed"'+(ui.refreshing?' disabled':'')+'>'+(ui.refreshing?'Refreshing…':'Refresh market data')+'</button>':'<button class="btn sm" data-a="id-signin">Allow market data</button>');
  if(state.snaps.length) b.push('<button class="btn ghost sm" data-a="recalc"'+(cs.withCopy?'':' disabled title="Import your statements once more so Ballast can keep a cleaned copy"')+'>Recalculate</button>');
  if(persist.mode==='drive') b.push('<button class="btn ghost sm" data-a="sign-out" title="Sign out and clear your data from this page">Lock</button>');
  const st=[live?(lu?'Live prices with market exchange rates':'Live prices are on but not loaded yet'):'Values as at '+(t?esc(BL.core.fmtDay(t.through)):'your last statement')+', with your statement\'s exchange rates'];
  if(state.feed&&(state.feed.generated_at||state.feed.imported_at)) st.push('market data '+esc(ago(state.feed.generated_at||state.feed.imported_at)));
  if(ui.refreshMsg) st.push(esc(ui.refreshMsg));
  return '<div class="row" style="margin:6px 0 4px;gap:10px;flex-wrap:wrap">'+b.join('')+'</div><div class="sub" style="margin-bottom:10px">'+st.join(' · ')+'</div>';
}
function rateSrc(c){ if(!(state.fx[c]>0)) return ''; return (state.fxSrc&&state.fxSrc[c])||(state.fxImplied[c]?'implied':'manual'); }
function setRate(c,v,src,force){
  if(!(v>0)||!fin(v)||c===state.base) return false; const cur=rateSrc(c);
  if(cur==='manual') return false;
  if(!force){
    const live=liveInUse();
    if(src==='market'&&cur&&!live) return false;                 // statement view: keep the statement's own rates
    if(src==='statement'&&cur==='market'&&live) return false;
    if(src==='implied'&&(cur==='statement'||cur==='market')) return false;
  }
  state.fx[c]=+(+v).toPrecision(6); state.fxImplied[c]=true; state.fxSrc[c]=src; return true;
}
/** True only when live prices are switched on AND the feed actually holds quotes, so rates and prices come from the same place. */
function liveInUse(){ return !!(state.set.live&&state.feed&&state.feed.quotes&&Object.keys(state.feed.quotes).length); }
function rateNote(c){ const s=rateSrc(c); return s==='statement'?' (from your statement)':s==='market'?' (market rate)':s==='implied'?' (worked out from your statement total)':''; }
/** Live rates through the market data service. It returns units of each currency per 1 USD, so base-per-unit is (base per USD) / (c per USD). */
async function fetchRates(force){
  if(!(BL.cloud.apiConfigured()&&BL.cloud.hasIdToken())) throw new Error('Allow market data first (Data & settings, Storage and security).');
  const used=new Set(state.positions.map(p=>p.ccy).concat(state.cash.map(c=>c.ccy))); used.delete(state.base); const list=Array.from(used).filter(c=>/^[A-Z]{3}$/.test(c));
  if(!list.length) return 0;
  const r=await BL.cloud.api('/fx',{currencies:list.concat([state.base])}); const per=r&&r.fx_per_usd;
  if(!per||!(per[state.base]>0)) throw new Error('The service did not return a rate for '+state.base+'.');
  let n=0; list.forEach(c=>{ if(per[c]>0&&setRate(c,per[state.base]/per[c],'market',!!force)) n++; });
  if(n) dirty(); return n;
}
async function autoRates(){
  try{ if(!BL.cloud.apiConfigured()||!BL.cloud.hasIdToken()) return; memo=null; if(!M().missing.length) return; if(await fetchRates(false)){ toast('Exchange rates fetched'); render(true); } }catch(e){}
}
function ingest(list){
  list.sort((a,b)=>a.key>b.key?1:a.key<b.key?-1:0);
  list.forEach(r=>{
    const snap=BL.core.makeSnap(r,state.base);
    state.snaps=state.snaps.filter(s=>!(s.from===snap.from&&s.to===snap.to)); state.snaps.push(snap);
  });
  state.snaps.sort((a,b)=>a.to>b.to?1:a.to<b.to?-1:0);
  const latest=list.reduce((a,b)=>(!a||b.key>=a.key)?b:a,null);
  if(latest&&(!state.asOf||latest.key>=state.asOf)) adoptHoldings(latest);
  dirty();
}
function parseGeneric(name,text){
  const rows=parseCSV(text.replace(/^\uFEFF/,''));
  const hi=rows.findIndex(r=>r.filter(c=>c.trim()).length>=3);
  if(hi<0||rows.length<hi+2) throw new Error('No table found in '+name);
  const headers=rows[hi].map(h=>h.trim()); const data=rows.slice(hi+1).filter(r=>r.some(c=>c.trim()));
  const find=(...res)=>{ for(const re of res){ const i=headers.findIndex(h=>re.test(h)); if(i>=0) return i; } return -1; };
  const map={symbol:find(/^(symbol|ticker|instrument|code|security|stock)$/i,/symbol|ticker/i),desc:find(/^(description|name|security name)$/i,/description|name/i),
    qty:find(/^(qty|quantity|shares|units|position|holding)s?$/i,/quantity|shares/i),price:find(/^(price|last price|close price|market price|current price|last)$/i,/price/i),
    value:find(/^(market value|mkt value|value)$/i,/value/i),cost:find(/^(cost basis|total cost|book cost|cost)$/i),avg:find(/(avg|average).*(cost|price)|cost price|unit cost/i),
    ccy:find(/^(currency|ccy|curr)$/i),cls:find(/^(asset (class|category)|type|category|class)$/i)};
  return {name:name,headers:headers,data:data,map:map};
}
function generatePositions(g,map,defCcy){
  const col=(r,k)=>map[k]>=0?r[map[k]]:undefined; const out=[];
  g.data.forEach(r=>{
    const sym=(col(r,'symbol')||'').trim(); if(!sym||/^total/i.test(sym)) return;
    const qty=num(col(r,'qty')); if(!fin(qty)) return;
    let price=num(col(r,'price')); const value=num(col(r,'value'));
    if(!fin(price)&&fin(value)&&qty) price=value/qty;
    let cost=num(col(r,'cost')); const avg=num(col(r,'avg')); if(!fin(cost)&&fin(avg)) cost=avg*qty;
    const a=(col(r,'cls')||'').trim();
    out.push({symbol:sym,desc:(col(r,'desc')||'').trim(),asset:a||'Stocks',qty:qty,price:price,cost:fin(cost)?cost:null,ccy:((col(r,'ccy')||'').trim().toUpperCase())||defCcy,mult:1,
      cls:KNOWN[sym]?null:/bond|fixed/i.test(a)?'Fixed income':/cash|money/i.test(a)?'Cash':/crypto|option|future/i.test(a)?'Crypto & other':null});
  });
  return out;
}

/* ------------------------------------------------------------------ *
 * Feed, news, alerts
 * ------------------------------------------------------------------ */
function importFeed(o){
  if(!o||typeof o!=='object'||!('quotes' in o||'news' in o||'custom' in o||'indices' in o||'fx_per_usd' in o)) throw new Error('This does not look like a Ballast feed file.');
  o.imported_at=new Date().toISOString(); state.feed=o;
  const per=o.fx_per_usd;
  if(per&&per[state.base]>0){ for(const c in per){ if(c!==state.base&&per[c]>0) setRate(c,per[state.base]/per[c],'market'); } }
  dirty();
}
function newsKey(t){ return String(t||'').toLowerCase().replace(/\W+/g,' ').trim().slice(0,90); }
function allNews(){
  const seen=new Set(); const out=[];
  const list=((state.feed&&state.feed.news)||[]).concat(state.newsManual);
  list.forEach(n=>{ if(!n||!n.title) return; const k=newsKey(n.title); if(seen.has(k)) return; seen.add(k); out.push(Object.assign({},n,{key:k})); });
  out.sort((a,b)=>(b.published||'')>(a.published||'')?1:-1);
  return out;
}
let matchers=null;
function buildMatchers(){
  return state.positions.filter(p=>!isDeriv(p)).map(p=>{
    const names=new Set();
    const d=(p.desc||'').replace(/\b(inc|corp|corporation|ltd|plc|co|company|holdings|group|class [a-z]|common stock|ordinary shares?|adr|ads|etf|trust|ag|sa|nv)\b\.?/ig,'').replace(/[^\w &.-]/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
    if(d.length>=5&&!/^(ishares|vanguard|spdr|invesco)/.test(d)) names.add(d);
    (p.aliases||'').split(',').map(s=>s.trim().toLowerCase()).filter(s=>s.length>=3).forEach(s=>names.add(s));
    const s=p.symbol; const re=s.length>=4?new RegExp('\\b'+escRe(s)+'\\b','i'):new RegExp('(^|[^A-Za-z0-9])'+escRe(s)+'(?![A-Za-z0-9])');
    return {sym:s,re:re,names:Array.from(names)};
  });
}
function matchItem(it){
  matchers=matchers||buildMatchers();
  const text=it.title+' '+(it.summary||''); const low=text.toLowerCase(); const hits=new Set();
  (it.symbols||[]).forEach(s=>{ if(matchers.some(m=>m.sym===s)) hits.add(s); });
  const ai=state.ai[it.key]; if(ai&&ai.symbols) ai.symbols.forEach(s=>{ if(matchers.some(m=>m.sym===s)) hits.add(s); });
  matchers.forEach(m=>{ if(m.re.test(text)||m.names.some(n=>low.includes(n))) hits.add(m.sym); });
  return Array.from(hits);
}
function sevOf(it){ const t=it.title; return HIGH.test(t)?'high':MED.test(t)?'med':''; }
function getAlerts(){
  const m=M(); const out=[]; const flagged=new Set(m.rows.filter(r=>r.flag).map(r=>r.symbol));
  allNews().forEach(it=>{
    const hits=matchItem(it).filter(s=>flagged.has(s)); if(!hits.length) return;
    const ai=state.ai[it.key]; const s=ai&&ai.impact==='high'?'high':ai&&ai.impact==='medium'?'med':sevOf(it);
    out.push({sev:s==='high'?'high':s==='med'?'med':'info',title:it.title,detail:hits.join(', ')+(it.source?' from '+it.source:''),url:it.url,kind:'news'});
  });
  m.rows.filter(r=>r.flag).forEach(r=>{ const q=state.feed&&state.feed.quotes&&state.feed.quotes[r.symbol]; if(q&&fin(q.change_pct)&&Math.abs(q.change_pct)>=state.set.move) out.push({sev:'med',title:r.symbol+' moved '+spct(q.change_pct)+' on the day',detail:'From the latest feed',kind:'move'}); });
  m.rows.filter(r=>!r.flag&&r.cls!=='Cash'&&fin(r.pnlPct)&&r.pnlPct<=-state.set.dd).forEach(r=>out.push({sev:'info',title:r.symbol+' is '+spct(r.pnlPct,0)+' against cost',detail:'Flag it to track its news',action:{id:r.id,label:'Flag'},kind:'dd'}));
  m.rows.filter(r=>!r.flag&&r.w>=state.set.conc&&r.cls!=='Cash'&&!/fund/i.test(r.sector)).forEach(r=>out.push({sev:'info',title:r.symbol+' is '+pct(r.w,0)+' of your portfolio',detail:'Above your '+state.set.conc+'% concentration limit',action:{id:r.id,label:'Flag'},kind:'conc'}));
  const o={high:0,med:1,info:2}; out.sort((a,b)=>o[a.sev]-o[b.sev]);
  return out;
}

/* ------------------------------------------------------------------ *
 * Building blocks (charts and small components)
 * ------------------------------------------------------------------ */
function strip(items,colorOf,thin){
  const list=items.filter(i=>i.pct>0.05);
  if(!list.length) return '<div class="strip'+(thin?' thin':'')+'" aria-hidden="true"></div>';
  return '<div class="strip'+(thin?' thin':'')+'" role="img" aria-label="'+esc(list.map(i=>i.key+' '+i.pct.toFixed(0)+'%').join(', '))+'">'+
    list.map(i=>'<div class="seg" style="flex-grow:'+i.pct+';flex-basis:0;background:'+colorOf(i.key)+'" title="'+esc(i.key)+' '+i.pct.toFixed(1)+'%">'+(!thin&&i.pct>=7?pct(i.pct,0):'')+'</div>').join('')+'</div>';
}
function hbars(items,fmt){
  const mx=Math.max.apply(null,items.map(i=>Math.abs(i.v)).concat([0.0001]));
  return items.map(i=>'<div class="hb"><span title="'+esc(i.label)+'">'+esc(i.label)+'</span><div class="tr"><div class="fl" style="width:'+(Math.abs(i.v)/mx*100)+'%;'+(i.color?'background:'+i.color:'')+'"></div></div><span class="n">'+(fmt?fmt(i.v):pct(i.v))+'</span></div>').join('');
}
function diverge(d){
  const w=Math.min(Math.abs(d)/20,1)*50;
  return '<div class="dv" aria-hidden="true"><i class="'+(d>0?'over':'under')+'" style="'+(d>0?'left:50%':'right:50%')+';width:'+w+'%"></i></div>';
}
function driftChip(d){
  if(Math.abs(d)<state.set.tol) return '';
  return '<span class="drift '+(d>0?'over':'under')+'">'+(d>0?'+':MINUS)+Math.abs(d).toFixed(0)+' pts</span>';
}
function navChart(){
  const p=getPerf(); if(p.series.length<2) return '<p class="sub">Import two or more statements (monthly, or one per year) to see how your net asset value has moved.</p>';
  return lineChart({h:230,label:'Net asset value and net contributions',fmt:v=>money(v),area:true,series:[{name:'Net asset value',color:'var(--ink)',pts:p.series.map(s=>({d:s.date,v:s.nav}))},{name:'Money you put in',color:'var(--c2)',dash:'5 4',pts:p.series.map(s=>({d:s.date,v:s.contrib}))}]});
}
function lineChart(o){
  const D=BL.core.dayNum; const W=o.w||680,H=o.h||220,pl=8,pr=58,pt=14,pb=24;
  const S=(o.series||[]).map(s=>Object.assign({},s,{pts:(s.pts||[]).filter(p=>p&&p.d&&fin(D(p.d)))})).filter(s=>s.pts.length);
  const bands=(o.bands||[]).filter(b=>b.upper&&b.upper.length);
  if(!S.length&&!bands.length) return '';
  const dates=[].concat.apply([],S.map(s=>s.pts.map(p=>D(p.d)))).concat([].concat.apply([],bands.map(b=>b.upper.map(p=>D(p.d)))));
  const t0=Math.min.apply(null,dates), t1=Math.max.apply(null,dates);
  let vs=[].concat.apply([],S.map(s=>s.pts.map(p=>p.v).filter(fin))).concat([].concat.apply([],bands.map(b=>b.upper.concat(b.lower).map(p=>p.v).filter(fin)))); if(o.zero) vs.push(0);
  let lo=o.min!=null?o.min:Math.min.apply(null,vs), hi=o.max!=null?o.max:Math.max.apply(null,vs); if(!fin(lo)||!fin(hi)) return '';
  const allNonNeg=Math.min.apply(null,vs)>=0; if(lo===hi){ lo-=1; hi+=1; } const pad=(hi-lo)*0.06; if(o.min==null){ lo-=pad; if(allNonNeg&&lo<0) lo=0; } if(o.max==null) hi+=pad;
  const X=t=>pl+(W-pl-pr)*(t1===t0?0.5:(t-t0)/(t1-t0)); const Y=v=>pt+(H-pt-pb)*(1-(v-lo)/(hi-lo));
  const fmt=o.fmt||(v=>String(Math.round(v)));
  let g='';
  for(let i=0;i<=3;i++){ const v=lo+(hi-lo)*i/3, y=Y(v).toFixed(1); g+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y+'" y2="'+y+'" stroke="var(--line-soft)"/><text x="'+(W-pr+6)+'" y="'+(+y+4)+'" font-size="11" fill="var(--muted)">'+esc(fmt(v))+'</text>'; }
  if(o.zero&&lo<0&&hi>0){ const y=Y(0).toFixed(1); g+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y+'" y2="'+y+'" stroke="var(--muted)" stroke-dasharray="2 3"/>'; }
  const y0=+new Date(t0*864e5).getUTCFullYear(), y1=+new Date(t1*864e5).getUTCFullYear(); const span=t1-t0; const ticks=[];
  const ystep=Math.max(1,Math.ceil((y1-y0+1)/8)); for(let y=y0;y<=y1+1;y+=ystep){ [['01-01',String(y)],['07-01','Jul']].forEach(x=>{ if(x[0]==='07-01'&&(span>1100||ystep>1)) return; const t=D(y+'-'+x[0]); if(t>=t0&&t<=t1) ticks.push([t,x[1]]); }); }
  if(ticks.length<2){ ticks.length=0; ticks.push([t0,BL.core.fmtDay(new Date(t0*864e5).toISOString().slice(0,10))],[t1,BL.core.fmtDay(new Date(t1*864e5).toISOString().slice(0,10))]); }
  ticks.forEach((k,i)=>{ const anchor=ticks.length===2?(i?'end':'start'):'middle'; g+='<text x="'+X(k[0]).toFixed(1)+'" y="'+(H-7)+'" text-anchor="'+anchor+'" font-size="11.5" fill="var(--muted)">'+esc(k[1])+'</text>'; });
  let body='';
  bands.forEach(b=>{ const up=b.upper.map(p=>X(D(p.d)).toFixed(1)+' '+Y(p.v).toFixed(1)); const lw=b.lower.slice().reverse().map(p=>X(D(p.d)).toFixed(1)+' '+Y(p.v).toFixed(1)); body+='<path d="M'+up.join(' L')+' L'+lw.join(' L')+' Z" fill="'+(b.color||'var(--c1)')+'" opacity="'+(b.opacity||0.15)+'"/>'; });
  S.forEach((s,si)=>{
    let d='',pen=false; s.pts.forEach(p=>{ if(!fin(p.v)){ pen=false; return; } d+=(pen?'L':'M')+X(D(p.d)).toFixed(1)+' '+Y(p.v).toFixed(1)+' '; pen=true; });
    if(o.area&&si===0&&s.pts.every(p=>fin(p.v))){ const first=s.pts[0],last=s.pts[s.pts.length-1]; body+='<path d="'+d+'L'+X(D(last.d)).toFixed(1)+' '+(H-pb)+' L'+X(D(first.d)).toFixed(1)+' '+(H-pb)+' Z" fill="'+(s.color||'var(--ink)')+'" opacity="0.07"/>'; }
    body+='<path d="'+d+'" fill="none" stroke="'+(s.color||'var(--ink)')+'" stroke-width="'+(s.w||2)+'" stroke-linejoin="round"'+(s.dash?' stroke-dasharray="'+s.dash+'"':'')+'/>';
    if(s.pts.length<=90&&!s.nodots) s.pts.forEach(p=>{ if(fin(p.v)) body+='<circle cx="'+X(D(p.d)).toFixed(1)+'" cy="'+Y(p.v).toFixed(1)+'" r="2.6" fill="var(--surface)" stroke="'+(s.color||'var(--ink)')+'" stroke-width="1.6"><title>'+esc(BL.core.fmtDay(p.d)+' · '+s.name+': '+fmt(p.v))+'</title></circle>'; });
  });
  const legend=S.map(s=>'<span class="lg2"><i style="background:'+(s.color||'var(--ink)')+'"></i>'+esc(s.name)+'</span>').join('')+bands.map(b=>'<span class="lg2"><i style="background:'+(b.color||'var(--c1)')+';opacity:.4"></i>'+esc(b.name||'')+'</span>').join('');
  return '<div class="chart"><svg viewBox="0 0 '+W+' '+H+'" width="100%" role="img" aria-label="'+esc(o.label||'Chart')+'" style="max-height:'+(o.h||220)*1.15+'px">'+g+body+'</svg><div class="legend2">'+legend+'</div></div>';
}
function empty(msg){ return '<div class="empty">'+msg+'</div>'; }

/* ------------------------------------------------------------------ *
 * Views
 * ------------------------------------------------------------------ */
const VIEWS=[['overview','Overview'],['holdings','Holdings'],['performance','Performance'],['activity','Activity'],['research','Research'],['markets','Markets'],['rebalance','Rebalance'],['news','News'],['toolkit','Toolkit'],['data','Data & settings']];

function warnings(m){
  const w=[];
  if(state.demo) w.push('<div class="banner info">You are looking at sample data. <button class="link" data-a="clear-demo">Clear it</button> before importing your own statement.</div>');
  if(m.missing.length) w.push('<div class="banner"><b>Totals are wrong until exchange rates are set.</b> There is no rate for '+esc(m.missing.join(', '))+', so those holdings are being counted as if 1 unit equalled 1 '+esc(state.base)+'. '+(BL.cloud.apiConfigured()&&BL.cloud.hasIdToken()?'<button class="link" data-a="fx-fetch">Fetch current rates</button> or ':'')+'<button class="link" data-a="go" data-v="data">enter them yourself</button>.</div>');
  const anyLive=m.rows.some(r=>r.live);
  if(fin(state.stmtNav)&&!anyLive&&!state.demo&&m.nav){ const d=Math.abs(m.total-state.stmtNav)/Math.abs(state.stmtNav); if(d>0.015) w.push('<div class="banner">Holdings, cash and accrued income add up to '+money(m.total)+' but the statement reports '+money(state.stmtNav)+' ('+pct(d*100)+' apart). Usual causes are exchange rates, cash held in a currency the report omits, or accrued interest.</div>'); }
  const g=state.positions.filter(p=>p.auto&&p.cls==='Equity').length;
  if(g) w.push('<div class="banner info">'+g+' equity holding'+(g>1?'s have':' has')+' a region guessed from its currency or exchange (marked ? in Holdings). Review them so your regional mix is right.</div>');
  if(state.feed&&state.feed.generated_at&&(Date.now()-new Date(state.feed.generated_at).getTime())>3*864e5) w.push('<div class="banner info">Your market feed is from '+ago(state.feed.generated_at)+'. Run the scraper again for fresh prices and news.</div>');
  const stale=staleNote(); if(stale) w.push(stale);
  const rn=recalcNote(); if(rn) w.push(rn);
  return w.join('');
}
function onboarding(){
  return '<div class="onboard"><h2>Bring in your first statement</h2>'+
    '<p>Ballast reads an Interactive Brokers activity statement, or a CSV from another broker, and turns it into allocation, balance and news tracking. Everything is processed in this browser.</p>'+
    '<ol><li>In IBKR open Performance &amp; Reports, then Statements, and run an Activity statement for a month.</li><li>Choose CSV as the format and download it.</li><li>Drop the file into the import area. Add several months to see your net asset value over time.</li></ol>'+
    '<div class="row"><button class="btn" data-a="go" data-v="data">Import a statement</button><button class="btn ghost" data-a="demo">Try sample data</button></div></div>';
}
function vOverview(){
  const m=M(); if(!state.positions.length&&!state.cash.length) return onboarding();
  const monthLine=overviewLine();
  const pnl=sum(m.rows.filter(r=>fin(r.pnl)),r=>r.pnl); const cost=sum(m.rows.filter(r=>fin(r.pnl)),r=>r.val-r.pnl);
  const dims=[['region','Region'],['class','Asset class'],['currency','Currency'],['sector','Sector']];
  const e=exposure(m,ui.dim); const hasT=ui.dim==='region'||ui.dim==='class';
  let b=null,colorOf; 
  if(hasT){ b=calcBuckets(ui.dim,0); colorOf=k=>catColor((ui.dim==='region'?REGIONS:CLASSES).indexOf(k)); }
  else { const idx={}; e.items.forEach((i,n)=>{ idx[i.key]=n; }); colorOf=k=>catColor(idx[k]); }
  const tItems=hasT?b.rows.map(r=>({key:r.key,pct:r.t})):null;
  const legend=e.items.filter(i=>i.pct>0.05||(hasT&&b.rows.find(r=>r.key===i.key).t>0)).map(i=>{
    const r=hasT?b.rows.find(x=>x.key===i.key):null;
    return '<div class="lg"><i style="background:'+colorOf(i.key)+'"></i><span>'+esc(i.key)+'</span><span class="v"><b>'+pct(i.pct)+'</b>'+(r?' of '+pct(r.t,0)+driftChip(r.drift):'')+'</span></div>';
  }).join('');
  const alerts=getAlerts().slice(0,7);
  const top=m.rows.slice().sort((a,b)=>b.val-a.val).slice(0,8).map(r=>({label:r.symbol,v:r.w,color:r.flag?'var(--flag)':null}));
  const scaleNote=ui.dim==='region'?'Equities only, with global and broad emerging funds split by their approximate look-through weights.':ui.dim==='sector'?'Equities only.':'';
  return warnings(m)+quickBar()+
  '<section class="sec"><div class="nav-val">'+money(m.total)+'</div><div class="sub" style="margin-top:4px">'+trackedSub()+(m.rows.some(r=>r.live)?', prices updated from your feed':'')+(m.accr>=1?'. Includes '+money(m.accr)+' of accrued dividends and interest, as your statement does':'')+'</div>'+
    (monthLine?'<div style="margin-top:4px">'+monthLine+'</div>':'')+
    '<div class="stats"><div><span class="lab">Invested</span><b>'+money(m.inv)+'</b></div><div><span class="lab">Cash</span><b>'+money(m.cashV)+'</b></div>'+
    '<div><span class="lab">Unrealized gain</span><b class="'+cls(pnl)+'">'+smoney(pnl)+(cost>0?' ('+spct(pnl/cost*100)+')':'')+'</b></div><div><span class="lab">Positions</span><b>'+m.rows.length+'</b></div></div></section>'+
  '<section class="sec"><div class="sec-head"><h2>Composition</h2><div class="chips" role="group" aria-label="Group by">'+dims.map(d=>'<button class="chip" aria-pressed="'+(ui.dim===d[0])+'" data-a="dim" data-v="'+d[0]+'">'+d[1]+'</button>').join('')+'</div></div>'+
    '<div class="strip-row"><span class="lab">Now</span>'+strip(e.items,colorOf)+'</div>'+
    (hasT?'<div class="strip-row"><span class="lab">Target</span>'+strip(tItems,colorOf,true)+'</div>':'')+
    '<div class="legend">'+legend+'</div>'+(scaleNote?'<p class="sub" style="margin-top:10px">'+scaleNote+'</p>':'')+
    (hasT?'<p class="sub" style="margin-top:6px">Tags show a gap of '+state.set.tol+' points or more. <button class="link" data-a="go" data-v="rebalance">See what to do about it</button></p>':'')+'</section>'+
  '<div class="two sec"><section><div class="sec-head"><h2>Needs attention</h2><button class="link" data-a="go" data-v="news">All news</button></div>'+
    (alerts.length?alerts.map(a=>'<div class="alert '+a.sev+'"><div class="bar"></div><div><div class="ti">'+(safeUrl(a.url)?'<a href="'+esc(safeUrl(a.url))+'" target="_blank" rel="noopener noreferrer">'+esc(a.title)+'</a>':esc(a.title))+'</div><div class="de">'+esc(a.detail)+'</div></div>'+(a.action?'<button class="btn ghost sm" data-a="flag" data-id="'+esc(a.action.id)+'">'+a.action.label+'</button>':'<span></span>')+'</div>').join(''):empty('Nothing needs attention. Flag positions in Holdings to track their news here.'))+'</section>'+
  '<section><div class="sec-head"><h2>Largest positions</h2><span class="sub">Share of portfolio</span></div>'+hbars(top)+'</section></div>'+
  '<section class="sec"><div class="sec-head"><h2>Net asset value over time</h2><button class="link" data-a="go" data-v="performance">Full performance history</button></div>'+navChart()+'</section>';
}

function holdingsRows(){
  const m=M(); let rows=m.rows.slice();
  const q=ui.q.trim().toLowerCase();
  if(q) rows=rows.filter(r=>(r.symbol+' '+r.desc+' '+r.region+' '+r.sector).toLowerCase().includes(q));
  if(ui.filt==='flagged') rows=rows.filter(r=>r.flag); else if(ui.filt!=='all') rows=rows.filter(r=>r.cls===ui.filt);
  const k=ui.sortK,d=ui.sortD;
  rows.sort((a,b)=>{ const x=a[k],y=b[k]; if(typeof x==='string') return d*x.localeCompare(y); return d*((fin(x)?x:-Infinity)-(fin(y)?y:-Infinity)); });
  return {rows:rows,m:m};
}
function holdingsTable(){
  const h=holdingsRows(); const rows=h.rows,m=h.m;
  const th=(k,label,num)=>'<th'+(num?' class="num"':'')+'><button data-a="sort" data-k="'+k+'">'+label+(ui.sortK===k?(ui.sortD>0?' ↑':' ↓'):'')+'</button></th>';
  if(!rows.length&&!m.cash.length) return empty('No holdings match.');
  return '<div class="scroll"><table class="t"><thead><tr><th style="width:30px"></th>'+th('symbol','Holding')+th('cls','Class')+th('region','Region')+th('qty','Quantity',1)+th('px','Price',1)+th('val','Value ('+esc(state.base)+')',1)+th('w','Weight',1)+th('pnlPct','Unrealized',1)+'</tr></thead><tbody>'+
    rows.map(r=>'<tr data-a="edit" tabindex="0" data-id="'+esc(r.id)+'"><td><button class="flagbtn'+(r.flag?' on':'')+'" data-a="flag" data-id="'+esc(r.id)+'" aria-label="'+(r.flag?'Unflag ':'Flag ')+esc(r.symbol)+'" aria-pressed="'+!!r.flag+'">'+flagSvg(r.flag)+'</button></td>'+
      '<td><span class="sym">'+esc(r.symbol)+'</span><span class="desc">'+esc(r.desc)+'</span></td><td>'+esc(r.cls)+'</td><td>'+esc(r.region)+(r.auto&&r.cls==='Equity'?'<i class="guess" title="Guessed from currency or exchange">?</i>':'')+'</td>'+
      '<td class="num">'+qtyFmt(r.qty)+'</td><td class="num">'+px(r.px)+' <span class="muted">'+esc(r.ccy)+'</span>'+(r.live?' <span class="tag" title="Price from your feed">live</span>':'')+'</td><td class="num">'+money(r.val)+'</td><td class="num">'+pct(r.w)+'</td>'+
      '<td class="num '+cls(r.pnlPct)+'">'+(fin(r.pnlPct)?spct(r.pnlPct):'–')+'</td></tr>').join('')+'</tbody>'+
    (ui.q||ui.filt!=='all'?'':'<tfoot>'+m.cash.map(c=>'<tr><td></td><td class="sym">Cash '+esc(c.ccy)+'</td><td>Cash</td><td></td><td></td><td></td><td class="num">'+money(c.val)+'</td><td class="num">'+pct(m.nav?c.val/m.nav*100:0)+'</td><td></td></tr>').join('')+'<tr><td></td><td>Total</td><td></td><td></td><td></td><td></td><td class="num">'+money(m.nav)+'</td><td class="num">100%</td><td></td></tr></tfoot>')+'</table></div>';
}
function vHoldings(){
  if(!state.positions.length&&!state.cash.length) return onboarding();
  const nf=state.positions.filter(p=>p.flag).length;
  return '<div class="row" style="margin-bottom:14px"><input class="in" style="flex:1;min-width:180px;max-width:320px" type="search" placeholder="Search holdings" aria-label="Search holdings" value="'+esc(ui.q)+'" data-i="q">'+
    '<select class="in" aria-label="Filter" data-c="filt"><option value="all">All holdings</option><option value="flagged"'+(ui.filt==='flagged'?' selected':'')+'>Flagged ('+nf+')</option>'+CLASSES.map(c=>'<option'+(ui.filt===c?' selected':'')+'>'+c+'</option>').join('')+'</select>'+
    '<span class="sub">Select a row to edit its tags. Flag a holding to track its news.</span></div><div id="htable">'+holdingsTable()+'</div>';
}

/* Fundamentals metric catalogue, shared by the Markets Compare tab and Research's compare panel.
 * Each row: [key in the /fundamentals response, label, format kind, group]. */
const fmtBig=v=>fin(v)?BL.fa.big(v):'–';
const fmtNum2=v=>fin(v)?v.toFixed(2):'–';
const fmtNum0=v=>fin(v)?String(Math.round(v)):'–';
const fmtPct1=v=>fin(v)?pct(v*100,1):'–';
const fmtPct2=v=>fin(v)?pct(v*100,2):'–';
const fmtRaw=v=>(v==null||v==='')?'–':String(v);
const FUND_FMT={px:px,big:fmtBig,num2:fmtNum2,num0:fmtNum0,pct1:fmtPct1,pct2:fmtPct2,raw:fmtRaw};
const fundMetricFmt=kind=>FUND_FMT[kind]||fmtRaw;
const FUND_METRICS=[
  ['price','Price','px','Valuation'],['fiftyTwoWeekLow','52-week low','px','Valuation'],['fiftyTwoWeekHigh','52-week high','px','Valuation'],
  ['marketCap','Market cap','big','Valuation'],['enterpriseValue','Enterprise value','big','Valuation'],['trailingPE','P/E (trailing)','num2','Valuation'],
  ['forwardPE','P/E (forward)','num2','Valuation'],['pegRatio','PEG ratio','num2','Valuation'],['priceToSales','Price / sales','num2','Valuation'],
  ['priceToBook','Price / book','num2','Valuation'],['evToEbitda','EV / EBITDA','num2','Valuation'],['evToRevenue','EV / revenue','num2','Valuation'],
  ['grossMargin','Gross margin','pct1','Profitability'],['operatingMargin','Operating margin','pct1','Profitability'],['profitMargin','Net profit margin','pct1','Profitability'],
  ['roe','Return on equity','pct1','Profitability'],['roa','Return on assets','pct1','Profitability'],
  ['revenue','Revenue (TTM)','big','Growth'],['revenueGrowth','Revenue growth','pct1','Growth'],['earningsGrowth','Earnings growth','pct1','Growth'],
  ['debtToEquity','Debt / equity','num2','Financial health'],['currentRatio','Current ratio','num2','Financial health'],['quickRatio','Quick ratio','num2','Financial health'],
  ['totalCash','Total cash','big','Financial health'],['totalDebt','Total debt','big','Financial health'],['freeCashflow','Free cash flow','big','Financial health'],['operatingCashflow','Operating cash flow','big','Financial health'],
  ['dividendYield','Dividend yield','pct1','Dividends'],['payoutRatio','Payout ratio','pct1','Dividends'],['exDividendDate','Next ex-dividend date','raw','Dividends'],['nextEarnings','Next earnings date','raw','Dividends'],
  ['beta','Beta','num2','Trading & risk'],['shortPercentFloat','Short interest (of float)','pct1','Trading & risk'],
  ['expenseRatio','Fund expense ratio','pct2','Fund (ETFs)'],['yield','Fund SEC yield','pct1','Fund (ETFs)'],['ytdReturn','Fund YTD return','pct1','Fund (ETFs)'],
  ['targetMean','Analyst target price (mean)','px','Analyst opinions'],['recommendationKey','Analyst consensus','raw','Analyst opinions'],['analystCount','Analyst count','num0','Analyst opinions']
];
const CMP_DEFAULT_ON=new Set(['price','marketCap','trailingPE','forwardPE','dividendYield','revenueGrowth','profitMargin','roe','debtToEquity','beta']);

/* Markets */
function mkTabs(){
  const t=[['prices','Prices'],['indices','Indices'],['compare','Compare']];
  ((state.feed&&state.feed.custom)||[]).forEach((c,i)=>t.push(['src'+i,c.name||('Source '+(i+1))]));
  t.push(['sources','Sources and feed']); return t;
}
function feedStatus(){
  const f=state.feed; if(!f) return '<p class="sub">No feed imported yet.</p>';
  return '<p class="sub">Feed created '+esc(ago(f.generated_at||f.imported_at))+': '+Object.keys(f.quotes||{}).length+' prices, '+(f.indices||[]).length+' indices, '+(f.news||[]).length+' headlines, '+(f.custom||[]).length+' custom sources.</p>';
}
function pricesTab(){
  const f=state.feed; const m=M();
  const list=m.rows.filter(r=>!isDeriv(r)&&r.cls!=='Cash');
  const q=f&&f.quotes?f.quotes:{};
  const body=list.map(r=>{ const x=q[r.symbol]; const lp=quotePrice(r); const diff=lp!=null&&r.price?(lp/r.price-1)*100:NaN;
    return '<tr><td><span class="sym">'+esc(r.symbol)+'</span><span class="desc">'+esc(r.desc)+'</span></td><td class="num">'+px(r.price)+'</td><td class="num">'+(lp!=null?px(lp):(x?'<span class="muted" title="Currency differs from your statement">n/a</span>':'–'))+'</td><td class="num '+cls(x&&x.change_pct)+'">'+(x&&fin(x.change_pct)?spct(x.change_pct,2):'–')+'</td><td class="num '+cls(diff)+'">'+(fin(diff)?spct(diff):'–')+'</td></tr>'; }).join('');
  const wl=state.watch.map((w,i)=>{ const x=q[w.symbol]; const tp=num(w.target); const at=x&&fin(tp)&&x.price<=tp;
    return '<tr><td><span class="sym">'+esc(w.symbol)+'</span>'+(w.note?'<span class="desc">'+esc(w.note)+'</span>':'')+'</td><td class="num">'+(x?px(x.price):'–')+' <span class="muted">'+esc(x&&x.currency||'')+'</span></td><td class="num '+cls(x&&x.change_pct)+'">'+(x&&fin(x.change_pct)?spct(x.change_pct,2):'–')+'</td><td class="num">'+(fin(tp)?px(tp):'–')+(at?' <span class="tag flag">at or below</span>':'')+'</td><td class="num"><button class="btn ghost sm" data-a="wl-del" data-i="'+i+'">Remove</button></td></tr>'; }).join('');
  return (f&&f.quotes?'':'<div class="banner info">No live prices yet. Prices below come from your statement. <button class="link" data-a="mk" data-v="sources">Set up the feed</button></div>')+
    '<div class="sec-head"><h2>Holdings</h2>'+refreshButton()+'<label class="sub"><input type="checkbox" data-c="live" '+(state.set.live?'checked':'')+'> Use feed prices in my totals</label></div>'+
    (list.length?'<div class="scroll"><table class="t"><thead><tr><th>Holding</th><th class="num">Statement price</th><th class="num">Feed price</th><th class="num">Day</th><th class="num">Feed vs statement</th></tr></thead><tbody>'+body+'</tbody></table></div>':empty('No holdings yet.'))+
    '<section class="sec"><div class="sec-head"><h2>Watchlist</h2></div>'+
    '<div class="form" style="margin-bottom:14px"><label>Symbol<input class="in" id="wl-sym" placeholder="VWO"></label><label>Buy at or below<input class="in" id="wl-tp" inputmode="decimal" placeholder="optional"></label><label>Note<input class="in" id="wl-note" placeholder="optional"></label><button class="btn" data-a="wl-add">Add to watchlist</button></div>'+
    (state.watch.length?'<div class="scroll"><table class="t"><thead><tr><th>Symbol</th><th class="num">Feed price</th><th class="num">Day</th><th class="num">Target</th><th></th></tr></thead><tbody>'+wl+'</tbody></table></div>':'<p class="sub">Add ideas from the Rebalance tab or type a symbol here. Watchlist symbols are included when you export sources.json.</p>')+'</section>';
}
function indicesTab(){
  const ix=(state.feed&&state.feed.indices)||[];
  if(!ix.length) return empty('No index data yet. Import a feed that includes indices. Edit the list in Sources and feed.');
  return '<div class="scroll"><table class="t"><thead><tr><th>Index or market</th><th class="num">Level</th><th class="num">Day</th><th style="width:160px"></th></tr></thead><tbody>'+
    ix.map(i=>'<tr><td><span class="sym">'+esc(i.name)+'</span><span class="desc">'+esc(i.symbol)+'</span></td><td class="num">'+px(i.price)+'</td><td class="num '+cls(i.change_pct)+'">'+(fin(i.change_pct)?spct(i.change_pct,2):'–')+'</td><td>'+(fin(i.change_pct)?diverge(i.change_pct*5):'')+'</td></tr>').join('')+'</tbody></table></div>';
}
function customTab(i){
  const c=((state.feed&&state.feed.custom)||[])[i]; if(!c) return empty('That source is not in the current feed.');
  let body='';
  if(c.error) body='<div class="banner">This source failed: '+esc(c.error)+'. Check the address and CSS selector in Sources and feed.</div>';
  else if(c.rows) body='<div class="scroll"><table class="t">'+(c.headers&&c.headers.length?'<thead><tr>'+c.headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead>':'')+'<tbody>'+c.rows.map(r=>'<tr>'+r.map((x,j)=>'<td'+(j&&fin(num(x))?' class="num"':'')+'>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  else if(c.items) body=c.items.map(it=>'<div class="news" style="padding:10px 0"><div>'+(safeUrl(it.url)?'<a href="'+esc(safeUrl(it.url))+'" target="_blank" rel="noopener noreferrer">'+esc(it.label)+'</a>':esc(it.label))+'</div>'+(it.value&&it.value!==it.label?'<div class="sub">'+esc(it.value)+'</div>':'')+'</div>').join('')||empty('The page returned nothing for this selector.');
  return '<div class="sec-head"><h2>'+esc(c.name)+'</h2><span class="sub">Fetched '+esc(ago(c.fetched_at))+' from '+(safeUrl(c.url)?'<a href="'+esc(safeUrl(c.url))+'" target="_blank" rel="noopener noreferrer">'+esc((c.url||'').replace(/^https?:\/\//,'').slice(0,50))+'</a>':esc((c.url||'').slice(0,50)))+'</span></div>'+body;
}
function sourcesTab(){
  const s=state.src;
  return liveRefreshPanel()+'<section class="sec"><div class="sec-head"><h2>Offline feed (optional)</h2></div>'+feedStatus()+
    '<p style="max-width:70ch;margin-top:8px">Prices, indices and news can come from the live service above. Reading arbitrary websites is not possible from a web page, so the small script below does that on your computer and Ballast imports what it finds.</p>'+
    '<ol style="padding-left:20px"><li>Export sources.json below. It lists your symbols, flagged holdings and the sites you add.</li><li>Run the script, which you install once with <code>pip install requests beautifulsoup4 yfinance</code>:<pre class="code">python scraper.py sources.json -o market_feed.json</pre></li><li>Import market_feed.json here. Prices, news, indices and each custom site appear in their own tab.</li></ol>'+
    '<div class="row"><button class="btn" data-a="export-sources">Export sources.json</button><label class="btn ghost" style="cursor:pointer">Import feed file<input type="file" id="feedfile" accept=".json" hidden></label><button class="btn ghost" data-a="toggle-paste">Paste feed instead</button></div>'+
    '<div id="feedpaste" hidden style="margin-top:12px"><textarea class="in" id="feedtext" placeholder="Paste the contents of market_feed.json"></textarea><div style="margin-top:8px"><button class="btn sm" data-a="feed-paste-go">Import pasted feed</button></div></div></section>'+
  '<section class="sec"><div class="sec-head"><h2>Websites to read</h2><span class="sub">Each becomes its own tab. Only add pages you are allowed to read; the script skips pages that robots.txt blocks.</span></div>'+
    (s.custom.length?'<div class="scroll"><table class="t"><thead><tr><th>Name</th><th>Address</th><th>Reads</th><th>CSS selector</th><th></th></tr></thead><tbody>'+s.custom.map((c,i)=>'<tr><td>'+esc(c.name)+'</td><td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(c.url)+'</td><td>'+esc({list:'A list of links or lines',table:'A table',text:'One value'}[c.kind]||c.kind)+'</td><td><code>'+esc(c.selector)+'</code></td><td class="num"><button class="btn ghost sm" data-a="src-del" data-i="'+i+'">Remove</button></td></tr>').join('')+'</tbody></table></div>':'<p class="sub">No websites yet. A good start: a central bank rates page (a table), a fund factsheet (one value) or a news section (a list).</p>')+
    '<div class="form" style="margin-top:14px"><label>Name<input class="in" id="s-name" placeholder="Fed funds rate"></label><label>Page address<input class="in" id="s-url" placeholder="https://example.com/rates"></label>'+
    '<label>What it reads<select class="in" id="s-kind"><option value="list">A list of links or lines</option><option value="table">A table</option><option value="text">One value</option></select></label><label>CSS selector<input class="in" id="s-sel" placeholder="table.rates"></label><button class="btn" data-a="src-add">Add website</button><button class="btn ghost" data-a="src-test">Test it</button></div><p class="sub" id="s-test" style="margin-top:8px"></p></section>'+
  '<section class="sec"><div class="sec-head"><h2>Indices and news settings</h2></div><details><summary style="cursor:pointer">Edit the index list and extra news searches</summary><div style="margin-top:12px" class="form">'+
    '<label class="wide">Indices, one per line as Name, Yahoo symbol<textarea class="in" id="s-ix" style="min-height:130px">'+esc(s.indices.map(i=>i.name+', '+i.symbol).join('\n'))+'</textarea></label>'+
    '<label class="wide">Extra news searches, one per line (for example: Federal Reserve rate decision)<textarea class="in" id="s-q">'+esc(s.queries.join('\n'))+'</textarea></label>'+
    '<label>Days of news to fetch<input class="in" id="s-days" type="number" min="1" max="30" value="'+s.days+'"></label><button class="btn" data-a="src-save">Save</button></div></details></section>';
}
function cmpState(){ return ui.cmp=ui.cmp||{sel:null,met:null,busy:false,data:{},err:{},at:0}; }
function cmpHoldings(){ return M().rows.filter(r=>!isDeriv(r)&&r.cls!=='Cash'); }
async function pullComparison(){
  const c=cmpState(); if(c.busy) return;
  const list=cmpHoldings().filter(r=>c.sel&&c.sel[r.symbol]);
  if(!list.length||!(BL.cloud.apiConfigured()&&BL.cloud.hasIdToken())) return;
  c.busy=true; c.err={}; render(true);
  await Promise.all(list.map(async r=>{
    try{ c.data[r.symbol]=await BL.cloud.api('/fundamentals',{symbol:r.yahoo||yahooGuess(r)}); }
    catch(e){ c.err[r.symbol]=e.message; }
  }));
  c.busy=false; c.at=Date.now(); render(true);
}
function compareTab(){
  const c=cmpState(); const list=cmpHoldings();
  if(!c.sel){ c.sel={}; list.forEach(r=>c.sel[r.symbol]=true); }
  if(!c.met){ c.met={}; FUND_METRICS.forEach(m=>c.met[m[0]]=CMP_DEFAULT_ON.has(m[0])); }
  const api=BL.cloud.apiConfigured()&&BL.cloud.hasIdToken();
  const chosenH=list.filter(r=>c.sel[r.symbol]);
  const chosenM=FUND_METRICS.filter(m=>c.met[m[0]]);
  const groups=[]; FUND_METRICS.forEach(m=>{ if(!groups.includes(m[3])) groups.push(m[3]); });
  const holdBox=list.length?'<div class="chips" style="margin-bottom:10px">'+list.map(r=>'<label class="chip" style="cursor:pointer"><input type="checkbox" data-c="cmp-sel" data-k="'+esc(r.symbol)+'" '+(c.sel[r.symbol]?'checked':'')+' style="margin-right:5px">'+esc(r.symbol)+'</label>').join('')+'</div>':empty('No holdings yet.');
  const metBox=groups.map(g=>'<fieldset style="border:0;padding:0;margin:0 0 10px"><legend class="sub" style="padding:0;margin-bottom:4px">'+esc(g)+'</legend><div class="chips">'+FUND_METRICS.filter(m=>m[3]===g).map(m=>'<label class="chip" style="cursor:pointer"><input type="checkbox" data-c="cmp-met" data-k="'+m[0]+'" '+(c.met[m[0]]?'checked':'')+' style="margin-right:5px">'+esc(m[1])+'</label>').join('')+'</div></fieldset>').join('');
  let table='';
  if(c.at){
    const cols=chosenH.filter(r=>c.data[r.symbol]||c.err[r.symbol]);
    if(!cols.length) table=empty('Nothing came back. Press Pull comparison again.');
    else{
      const head='<tr><th>Figure</th>'+cols.map(r=>'<th class="num">'+esc(r.symbol)+'<span class="desc">'+esc((c.data[r.symbol]&&c.data[r.symbol].name)||r.desc||'')+'</span></th>').join('')+'</tr>';
      let body='',lastGrp=null;
      chosenM.forEach(m=>{
        if(m[3]!==lastGrp){ body+='<tr><td colspan="'+(cols.length+1)+'" style="font-weight:600;padding-top:12px">'+esc(m[3])+'</td></tr>'; lastGrp=m[3]; }
        body+='<tr><td>'+esc(m[1])+'</td>'+cols.map(r=>{ const f=c.data[r.symbol]; return f?'<td class="num">'+fundMetricFmt(m[2])(f[m[0]])+'</td>':'<td class="num"><span class="muted" title="'+esc(c.err[r.symbol]||'')+'">error</span></td>'; }).join('')+'</tr>';
      });
      table='<div class="scroll"><table class="t"><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div>'+
        '<p class="sub" style="margin-top:8px">Pulled '+esc(ago(c.at))+' from Yahoo Finance, which is unofficial and can be missing, delayed or wrong for any holding. Nothing here is advice.'+(Object.keys(c.err).length?' No data came back for '+esc(Object.keys(c.err).join(', '))+'.':'')+'</p>';
    }
  }
  return '<p class="sub" style="max-width:78ch">Pick the holdings and figures to line up side by side, then press the button. Nothing is pulled automatically, and every pull counts as a lookup against the market data service.</p>'+
    '<div class="sec-head"><h2>Holdings</h2><span class="sub">'+chosenH.length+' of '+list.length+' selected</span></div>'+holdBox+
    '<div class="sec-head"><h2>Figures</h2><span class="sub">'+chosenM.length+' of '+FUND_METRICS.length+' selected</span></div>'+metBox+
    '<div class="row" style="margin:10px 0 16px">'+(api?'<button class="btn" data-a="cmp-go"'+(c.busy||!chosenH.length||!chosenM.length?' disabled':'')+'>'+(c.busy?'Pulling…':'Pull comparison')+'</button>':'')+'</div>'+
    (api?'':'<div class="banner info">Comparing figures needs the market data service. <button class="link" data-a="id-signin">Allow market data</button></div>')+
    table;
}
function vMarkets(){
  const tabs=mkTabs(); if(!tabs.some(t=>t[0]===ui.mk)) ui.mk='prices';
  let body=ui.mk==='prices'?pricesTab():ui.mk==='indices'?indicesTab():ui.mk==='compare'?compareTab():ui.mk==='sources'?sourcesTab():customTab(+ui.mk.slice(3));
  return '<div class="tabs" role="tablist">'+tabs.map(t=>'<button role="tab" aria-selected="'+(ui.mk===t[0])+'" data-a="mk" data-v="'+t[0]+'">'+esc(t[1])+'</button>').join('')+'</div>'+body;
}

/* Rebalance */
function suggestions(){
  const m=M(); const out=[]; const tol=state.set.tol;
  if(!m.nav) return out;
  const cb=calcBuckets('class',ui.contrib); const eqAdd=(cb.rows.find(r=>r.key==='Equity')||{}).add||0; const rb=calcBuckets('region',eqAdd);
  if(rb.total>0) rb.rows.forEach(r=>{
    if(r.drift<=-tol) out.push({sev:'under',score:-r.drift,title:'Add to '+r.key,text:r.key+' is '+pct(r.now,0)+' of your equities against a '+pct(r.t,0)+' target. Closing the gap takes about '+money(r.gap)+' of new equity.',cands:CAND.region[r.key]||[]});
    else if(r.drift>=tol) out.push({sev:'over',score:r.drift,title:'Steer new money away from '+r.key,text:r.key+' is '+pct(r.now,0)+' of your equities against a '+pct(r.t,0)+' target. Direct new contributions elsewhere before selling, since selling can trigger tax.',cands:[]});
  });
  cb.rows.forEach(r=>{
    if(r.key==='Crypto & other'&&r.t===0&&r.now<tol) return;
    if(r.drift<=-tol) out.push({sev:'under',score:-r.drift,title:'Add '+r.key.toLowerCase(),text:r.key+' is '+pct(r.now,0)+' of your portfolio against a '+pct(r.t,0)+' target, a gap of about '+money(r.gap)+'.',cands:CAND.cls[r.key]||[]});
    else if(r.drift>=tol) out.push({sev:'over',score:r.drift,title:'Above target in '+r.key.toLowerCase(),text:r.key+' is '+pct(r.now,0)+' against a '+pct(r.t,0)+' target.',cands:[]});
  });
  m.rows.filter(r=>r.w>=state.set.conc&&r.cls==='Equity'&&!/fund/i.test(r.sector)).forEach(r=>out.push({sev:'over',score:r.w,title:r.symbol+' is a large single position',text:r.symbol+' is '+pct(r.w,0)+' of your portfolio, above your '+state.set.conc+'% limit. A broad fund holds thousands of companies and reduces the impact of any one of them.',cands:[]}));
  const cur=exposure(m,'currency').items.filter(i=>i.key!==state.base); if(cur.length&&cur[0].pct>=60) out.push({sev:'info',score:cur[0].pct/2,title:cur[0].key+' drives your currency exposure',text:pct(cur[0].pct,0)+' of your portfolio is in '+cur[0].key+' while you measure in '+state.base+'. That is fine if you spend in '+cur[0].key+' later, otherwise exchange-rate swings will move your results.',cands:[]});
  out.sort((a,b)=>b.score-a.score); return out.slice(0,8);
}
function bucketTable(kind,b,label){
  const tg=state.tg[kind==='class'?'cls':'region']; const showAdd=ui.contrib>0;
  return '<div class="scroll"><table class="t"><thead><tr><th>'+label+'</th><th class="num">Now</th><th class="num">Target</th><th style="width:130px">Gap</th><th class="num">Move to reach target</th>'+(showAdd?'<th class="num">Where new cash goes</th>':'')+'</tr></thead><tbody>'+
    b.rows.map(r=>'<tr><td>'+esc(r.key)+'</td><td class="num">'+pct(r.now)+'</td><td class="num"><input class="in pct" type="number" min="0" max="100" step="0.5" value="'+(+tg[r.key]||0)+'" aria-label="Target for '+esc(r.key)+'" data-c="tg" data-k="'+kind+'" data-key="'+esc(r.key)+'"></td><td>'+diverge(r.drift)+'</td><td class="num'+(Math.abs(r.drift)>=state.set.tol?'':' muted')+'">'+(Math.abs(r.gap)<1?'–':(r.gap>0?'Buy ':'Sell ')+money(Math.abs(r.gap)))+'</td>'+(showAdd?'<td class="num">'+(r.add>0.5?money(r.add):'–')+'</td>':'')+'</tr>').join('')+
    '</tbody><tfoot><tr><td>Total</td><td class="num">100%</td><td class="num">'+pct(b.sumT,1)+'</td><td></td><td></td>'+(showAdd?'<td class="num">'+money(sum(b.rows,r=>r.add))+'</td>':'')+'</tr></tfoot></table></div>'+
    (Math.abs(b.sumT-100)>0.05?'<p class="sub" style="margin-top:6px">Your targets add up to '+pct(b.sumT,1)+'. Ballast scales them to 100% for the maths.</p>':'');
}
function vRebalance(){
  const m=M(); if(!m.nav) return onboarding();
  const cb=calcBuckets('class',ui.contrib); const eqAdd=(cb.rows.find(r=>r.key==='Equity')||{}).add||0; const rb=calcBuckets('region',eqAdd);
  const sug=suggestions();
  const prof=(map,cur,kind)=>'<select class="in" data-c="profile" data-k="'+kind+'" aria-label="'+(kind==='cls'?'Asset mix profile':'Regional mix profile')+'">'+Object.keys(map).map(k=>'<option'+(cur===k?' selected':'')+'>'+k+'</option>').join('')+(cur==='Custom'?'<option selected>Custom</option>':'')+'</select>';
  return '<div class="row" style="margin-bottom:6px"><label class="sub">Asset mix '+prof(CLASS_PROFILES,state.tg.clsProfile,'cls')+'</label><label class="sub">Regional mix '+prof(REGION_PROFILES,state.tg.regionProfile,'region')+'</label>'+
    '<label class="sub">New cash to invest ('+esc(state.base)+') <input class="in pct" style="width:110px" type="number" min="0" step="100" value="'+(ui.contrib||'')+'" placeholder="0" data-c="contrib"></label></div>'+
  '<p class="sub" style="max-width:74ch">These are starting points, not advice. Edit any target to match your own goals, time horizon and risk tolerance. Adding new money to underweight areas avoids selling, which is usually kinder to taxes and fees.</p>'+
  '<section class="sec"><div class="sec-head"><h2>Suggested moves</h2></div>'+
  (sug.length?sug.map(s=>'<div class="sug"><h3><span class="drift '+(s.sev==='under'?'under':s.sev==='over'?'over':'')+'" style="margin:0">'+(s.sev==='under'?'Below target':s.sev==='over'?'Above target':'Note')+'</span>'+esc(s.title)+'</h3><p>'+esc(s.text)+'</p>'+
    (s.cands.length?'<div class="chips" aria-label="Ideas to research">'+s.cands.map(c=>'<button class="chip cand" data-a="wl-quick" data-sym="'+esc(c[0])+'" data-note="'+esc(c[1])+'" title="Add '+esc(c[0])+' to watchlist">'+esc(c[0])+'<small>'+esc(c[1])+'</small></button>').join('')+'</div>':'')+'</div>').join('')+
    '<p class="sub" style="margin-top:12px;max-width:74ch">Tickers are examples of broad funds to research, not recommendations. Check that your broker offers them, their fees, and the tax treatment where you live. For example, US-listed funds can carry US estate-tax exposure for non-US residents, which is why many people compare UCITS versions. Selecting one adds it to your watchlist.</p>':empty('Your portfolio is within '+state.set.tol+' points of every target. Nothing to suggest.'))+'</section>'+
  '<section class="sec"><div class="sec-head"><h2>Asset mix</h2></div>'+bucketTable('class',cb,'Asset class')+'</section>'+
  '<section class="sec"><div class="sec-head"><h2>Regional mix of equities</h2></div>'+(rb.total>0?bucketTable('region',rb,'Region'):empty('You hold no equities yet.'))+
    '<details style="margin-top:10px"><summary style="cursor:pointer" class="sub">How global and broad emerging-market funds are counted</summary><p class="sub" style="max-width:74ch;margin-top:6px">A global fund is split by approximate index weights: '+Object.keys(LOOK['Global fund']).map(k=>k+' '+LOOK['Global fund'][k]+'%').join(', ')+'. A broad emerging-market fund is counted as China '+LOOK['Emerging (broad)'].China+'% and other emerging markets '+LOOK['Emerging (broad)']['Emerging ex-China']+'%. These are rough and drift over time. Change a holding\'s region tag to override.</p></details></section>'+
  '<section class="sec"><div class="sec-head"><h2>Second opinion</h2></div>'+(aiOn()?
    '<p class="sub" style="max-width:74ch">Ask the AI assistant to read your allocation and comment on balance and concentration. Only percentages and tickers are sent, never account details or amounts.</p><div class="row" style="margin-top:8px"><button class="btn" data-a="ai-review"'+(ui.aiBusy?' disabled':'')+'>'+(ui.aiBusy?'Thinking':'Review my portfolio')+'</button>'+(ui.aiBusy?'<button class="btn ghost" data-a="ai-stop">Stop</button>':'')+'</div><div class="aiout" id="aiout">'+esc(ui.aiText)+'</div>':'<p class="sub">The AI review needs the market data service (see Data &amp; settings, Storage and security). It never receives account details or amounts.</p>')+'</section>';
}

/* News */
function vNews(){
  const m=M(); const flagged=new Set(m.rows.filter(r=>r.flag).map(r=>r.symbol));
  let items=allNews().map(it=>{ const hits=matchItem(it); const ai=state.ai[it.key]; const sv=ai&&ai.impact?({high:'high',medium:'med'}[ai.impact]||''):sevOf(it); return {it:it,hits:hits,sv:sv,fl:hits.some(h=>flagged.has(h))}; });
  const total=items.length;
  if(ui.newsF==='flagged') items=items.filter(x=>x.fl); else if(ui.newsF==='held') items=items.filter(x=>x.hits.length); else if(ui.newsF==='high') items=items.filter(x=>x.sv==='high');
  const F=[['flagged','Flagged holdings'],['held','Any holding'],['high','High impact'],['all','Everything']];
  return '<div class="row" style="justify-content:space-between;margin-bottom:12px"><div class="chips" role="group" aria-label="Filter news">'+F.map(f=>'<button class="chip" aria-pressed="'+(ui.newsF===f[0])+'" data-a="newsf" data-v="'+f[0]+'">'+f[1]+'</button>').join('')+'</div>'+
    '<div class="row">'+(aiOn()&&total?'<button class="btn ghost sm" data-a="ai-news"'+(ui.newsBusy?' disabled':'')+'>'+(ui.newsBusy?'Scoring':'Score with AI')+'</button>':'')+'<button class="btn ghost sm" data-a="toggle-headlines">Add headlines</button></div></div>'+
    '<div id="hl" hidden style="margin-bottom:16px"><textarea class="in" id="hl-text" placeholder="One headline per line. Optional: Headline | link | source"></textarea><div style="margin-top:8px"><button class="btn sm" data-a="hl-add">Add</button></div></div>'+
    (!flagged.size&&ui.newsF==='flagged'?'<div class="banner info">You have not flagged any holdings yet. Flag the positions you want to watch in Holdings and their news will collect here.</div>':'')+
    (items.length?items.map(x=>{ const it=x.it; const ai=state.ai[it.key]; return '<article class="news"><h3>'+(safeUrl(it.url)?'<a href="'+esc(safeUrl(it.url))+'" target="_blank" rel="noopener noreferrer">'+esc(it.title)+'</a>':esc(it.title))+'</h3><div class="mt">'+
      (x.sv?'<span class="tag '+x.sv+'">'+(x.sv==='high'?'High impact':'Worth a look')+'</span>':'')+x.hits.map(h=>'<span class="tag'+(flagged.has(h)?' flag':'')+'">'+esc(h)+'</span>').join('')+
      '<span>'+esc(it.source||'')+'</span>'+(it.published?'<span>'+esc(ago(it.published))+'</span>':'')+'</div>'+(ai&&ai.why?'<div class="why">'+esc(ai.why)+(ai.tone?' <span class="muted">Tone: '+esc(ai.tone)+'</span>':'')+'</div>':'')+'</article>'; }).join(''):
      empty(total?'Nothing matches this filter.':'No news yet. Import a feed from the scraper in Markets, or add headlines by hand.')+'');
}

/* Toolkit */
function stressCalc(){
  const m=M(); const s=ui.stress; let after=0; const byCls={}; CLASSES.forEach(c=>{ byCls[c]=0; });
  const shock=(cl,ccy,val)=>{ const a=cl==='Cash'?0:(s[cl]||0); const f=ccy!==state.base?s.fx:0; return val*(1+a/100)*(1+f/100); };
  m.rows.forEach(r=>{ const v=shock(r.cls,r.ccy,r.val); after+=v; byCls[r.cls]+=v-r.val; });
  m.cash.forEach(c=>{ const v=shock('Cash',c.ccy,c.val); after+=v; byCls.Cash+=v-c.val; });
  return {before:m.nav,after:after,byCls:byCls};
}
const TK=[['stress','Stress test',tkStress]];
function vToolkit(){
  const m=M(); if(!m.nav&&!state.snaps.length) return onboarding();
  if(!TK.some(t=>t[0]===ui.tk)) ui.tk='stress';
  const t=TK.find(x=>x[0]===ui.tk);
  return '<div class="tabs" role="tablist">'+TK.map(x=>'<button role="tab" aria-selected="'+(ui.tk===x[0])+'" data-a="tk" data-v="'+x[0]+'">'+esc(x[1])+'</button>').join('')+'</div>'+t[2]();
}
function tkStress(){
  const s=ui.stress; const r=stressCalc();
  const sl=(k,label,mn,mx)=>'<div class="sl"><label for="sl-'+slug(k)+'">'+label+'</label><input id="sl-'+slug(k)+'" type="range" min="'+mn+'" max="'+mx+'" step="1" value="'+s[k]+'" data-i="stress" data-k="'+esc(k)+'"><span class="n" id="sln-'+slug(k)+'">'+spct(s[k],0)+'</span></div>';
  const presets=[['Equity bear market'],['Rates shock'],['Weak foreign currencies']];
  return '<section class="sec"><div class="sec-head"><h2>Stress test</h2><div class="chips">'+presets.map((p,i)=>'<button class="chip" data-a="preset" data-i="'+i+'">'+p[0]+'</button>').join('')+'</div></div>'+
    '<div class="two"><div>'+sl('Equity','Equities',-60,30)+sl('Fixed income','Fixed income',-30,20)+sl('Real assets','Real assets',-40,30)+sl('Crypto & other','Crypto and other',-80,50)+sl('fx','Foreign currencies vs '+esc(state.base),-25,25)+'<p class="sub" style="margin-top:8px">Cash is only affected by currency moves.</p></div>'+
    '<div id="stress-out">'+stressOut(r)+'</div></div></section>';
}
function stressOut(r){
  const d=r.after-r.before;
  return '<div class="nav-val" style="font-size:26px">'+money(r.after)+'</div><div class="'+cls(d)+'" style="font-weight:600">'+smoney(d)+' ('+spct(r.before?d/r.before*100:0)+')</div><div class="sub" style="margin:2px 0 12px">Compared with '+money(r.before)+' today</div>'+
    hbars(CLASSES.filter(c=>Math.abs(r.byCls[c])>0.5).map(c=>({label:c,v:r.byCls[c],color:r.byCls[c]<0?'var(--loss)':'var(--gain)'})),v=>smoney(v));
}

/* Data & settings */
function genPanel(){
  const g=ui.gen; if(!g) return '';
  const fields=[['symbol','Symbol'],['desc','Description'],['qty','Quantity'],['price','Price'],['value','Market value'],['cost','Total cost'],['avg','Average cost per unit'],['ccy','Currency'],['cls','Asset type']];
  return '<div class="panel" style="margin-top:14px"><h3 style="font-size:15px;margin-bottom:4px">Match the columns in '+esc(g.name)+'</h3><p class="sub" style="margin-bottom:12px">Found '+g.data.length+' rows. Ballast guessed the columns below. Symbol and quantity are required.</p><div class="form">'+
    fields.map(f=>'<label>'+f[1]+'<select class="in" data-g="'+f[0]+'"><option value="-1">Not in file</option>'+g.headers.map((h,i)=>'<option value="'+i+'"'+(g.map[f[0]]===i?' selected':'')+'>'+esc(h||('Column '+(i+1)))+'</option>').join('')+'</select></label>').join('')+
    '<label>Currency if missing<input class="in" id="g-ccy" value="'+esc(state.base)+'" maxlength="3"></label><label>Statement date<input class="in" id="g-date" type="date" value="'+new Date().toISOString().slice(0,10)+'"></label></div>'+
    '<div class="scroll" style="margin-top:12px"><table class="t"><thead><tr>'+g.headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+g.data.slice(0,4).map(r=>'<tr>'+g.headers.map((h,i)=>'<td>'+esc(r[i]||'')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'+
    '<div class="row" style="margin-top:12px"><button class="btn" data-a="gen-go">Import '+g.data.length+' rows</button><button class="btn ghost" data-a="gen-cancel">Cancel</button></div></div>';
}
function vData(){
  const cur=new Set(); state.positions.forEach(p=>cur.add(p.ccy)); state.cash.forEach(c=>cur.add(c.ccy)); cur.delete(state.base);
  const st=state.set;
  return '<section class="sec"><div class="sec-head"><h2>Import</h2></div>'+
    '<label class="drop" id="drop" for="file"><b>Drop files here or choose them</b><span class="sub">IBKR activity statements as CSV (select many at once: every month or year since you started), NAV history files, CSV exports from other brokers, feed files or Ballast backups (JSON)</span><span class="btn sm" style="margin-top:6px">Choose files</span></label>'+
    '<input type="file" id="file" multiple accept=".csv,.txt,.json" hidden>'+
    '<p class="sub" style="margin-top:8px;max-width:74ch">IBKR: Performance &amp; Reports, Statements, Activity. Run one per year (or per month for finer detail) and download each as CSV. Import them all at once and Ballast stitches together your transactions and net asset value history. PDF statements are not read because their layout is unreliable.</p><p class="sub" style="margin-top:6px;max-width:74ch">Statements are read entirely in your browser. Your name, account number and address are not copied into what Ballast keeps.</p>'+
    '<details style="margin-top:8px"><summary style="cursor:pointer" class="sub">Paste text instead</summary><textarea class="in" id="paste" style="margin-top:8px" placeholder="Paste CSV text"></textarea><div style="margin-top:8px"><button class="btn sm" data-a="paste-go">Import pasted text</button></div></details>'+
    (ui.log.length?'<div style="margin-top:12px">'+ui.log.map(l=>'<div class="'+(l.ok?'':'loss')+'">'+esc(l.msg)+'</div>').join('')+'</div>':'')+genPanel()+'</section>'+
  '<section class="sec"><div class="sec-head"><h2>Add a position by hand</h2></div><div class="form">'+
    '<label>Symbol<input class="in" id="m-sym"></label><label>Description<input class="in" id="m-desc"></label><label>Quantity<input class="in" id="m-qty" inputmode="decimal"></label><label>Price<input class="in" id="m-px" inputmode="decimal"></label><label>Total cost<input class="in" id="m-cost" inputmode="decimal" placeholder="optional"></label><label>Currency<input class="in" id="m-ccy" value="'+esc(state.base)+'" maxlength="3"></label><button class="btn" data-a="pos-add">Add position</button></div></section>'+
  statementsSection()+
  '<section class="sec"><div class="sec-head"><h2>Settings</h2></div><div class="form">'+
    '<label>Base currency<input class="in" id="st-base" value="'+esc(state.base)+'" maxlength="3" data-c="base"></label>'+
    '<label>Concentration limit (% of portfolio)<input class="in" type="number" min="1" max="100" value="'+st.conc+'" data-c="set" data-k="conc"></label>'+
    '<label>Drawdown alert (% below cost)<input class="in" type="number" min="1" max="99" value="'+st.dd+'" data-c="set" data-k="dd"></label>'+
    '<label>Daily move alert (%)<input class="in" type="number" min="1" max="50" value="'+st.move+'" data-c="set" data-k="move"></label>'+
    '<label>Rebalance tolerance (points)<input class="in" type="number" min="1" max="30" value="'+st.tol+'" data-c="set" data-k="tol"></label>'+
    '<label>Theme<select class="in" data-c="theme"><option value="auto"'+(st.theme==='auto'?' selected':'')+'>Match device</option><option value="light"'+(st.theme==='light'?' selected':'')+'>Light</option><option value="dark"'+(st.theme==='dark'?' selected':'')+'>Dark</option></select></label></div>'+
    '<h3 style="font-size:14.5px;margin:20px 0 4px">Exchange rates</h3><p class="sub" style="margin-bottom:10px">Value of one unit of each currency in '+esc(state.base)+'. Ballast uses, in this order: a rate you type, the rate in your statement, then market rates. '+(BL.cloud.apiConfigured()&&BL.cloud.hasIdToken()?'<button class="link" data-a="fx-fetch">Fetch current market rates</button>':'')+'</p>'+
    (cur.size?'<div class="form">'+Array.from(cur).map(c=>'<label>1 '+esc(c)+' in '+esc(state.base)+rateNote(c)+'<input class="in" inputmode="decimal" value="'+(state.fx[c]||'')+'" placeholder="required" data-c="fx" data-k="'+esc(c)+'"></label>').join('')+'</div>':'<p class="sub">All your holdings are in '+esc(state.base)+'.</p>')+'</section>'+
  backupSection()+storageSection()+aboutSection();
}

/* ------------------------------------------------------------------ *
 * Render
 * ------------------------------------------------------------------ */
/* ---- sign-in gate, storage, encryption, live refresh ---- */
function showGate(kind,msg){
  const g=$('#gate'); if(!g) return; g.hidden=false;
  const box=t=>'<div class="gate-box"><h2>Ballast</h2>'+t+'</div>';
  if(kind==='busy') g.innerHTML=box('<p>'+esc(msg||'Working…')+'</p>');
  else if(kind==='signin') g.innerHTML=box('<p>Sign in with Google to load your data from your own Drive. Nothing is stored on the site itself.</p>'+(msg?'<p class="loss">'+esc(msg)+'</p>':'')+'<div class="row"><button class="btn" data-a="gate-signin">Sign in with Google</button><button class="btn ghost" data-a="gate-local">Use in this browser only</button></div>');
  else if(kind==='unlock') g.innerHTML=box('<p>Your data in Drive is encrypted. Enter your passphrase to open it. It is never sent anywhere or stored.</p><label class="sub" style="display:block;margin:8px 0">Passphrase<input class="in" id="gate-pass" type="password" autocomplete="current-password" style="width:100%;margin-top:4px"></label>'+(msg?'<p class="loss">'+esc(msg)+'</p>':'')+'<div class="row"><button class="btn" data-a="gate-unlock">Unlock</button><button class="btn ghost" data-a="sign-out">Sign out</button></div>');
  else if(kind==='error') g.innerHTML=box('<p class="loss">'+esc(msg||'Something went wrong.')+'</p><p class="sub">Nothing was changed in Drive. Saving is paused so a problem here cannot overwrite your data.</p><div class="row"><button class="btn" data-a="gate-retry">Try again</button><button class="btn ghost" data-a="gate-local">Use in this browser only</button></div>');
  else if(kind==='version') g.innerHTML=box('<p><b>Some Ballast files on your site are out of date.</b></p><p class="sub" style="margin-bottom:8px">This page is running a mix of old and new files, which can cause wrong numbers or missing screens.</p><table class="t"><thead><tr><th>File</th><th class="num">On your site</th><th class="num">Needed</th></tr></thead><tbody>'+msg.map(r=>'<tr><td>js/'+esc(r.file)+'</td><td class="num loss">'+(r.have==null?'not found or old':esc(r.have))+'</td><td class="num">'+esc(r.need)+'</td></tr>').join('')+'</tbody></table><p class="sub" style="margin:10px 0">Replace those files in your repo\'s js folder, wait for GitHub Pages to finish updating, then reload with Ctrl+Shift+R.</p><div class="row"><button class="btn ghost" data-a="ver-continue">Continue anyway</button></div>');
  const f=g.querySelector('input'); if(f) f.focus();
}
function hideGate(){ const g=$('#gate'); if(g){ g.hidden=true; g.innerHTML=''; } }
async function cloudGate(){
  showGate('busy','Signing you in…');
  try{ await BL.cloud.signIn({silent:true}); await afterSignIn(); }catch(e){ showGate('signin'); }
}
async function afterSignIn(){
  persist.mode='drive'; persist.blocked=true; showGate('busy','Opening your data…');
  let r; try{ r=await BL.cloud.load(); }catch(e){ showGate('error',e.message); return; }
  if(r.status==='encrypted'){ ui.envelope=r.envelope; showGate('unlock'); return; }
  applyLoaded(r);
}
function applyLoaded(r){
  persist.blocked=false;
  if(r.status==='plain'){ state=normalise(merge(blank(),r.data)); }
  else{
    state=blank(); const local=store.get(KEY);
    if(local){ try{ state=normalise(merge(blank(),JSON.parse(local))); persist.migrated=true; toast('Found data in this browser. Saving it to your Drive.'); save(); }catch(e){} }
  }
  ledgerMemo=null; perfMemo=null; memo=null; applyTheme(); hideGate(); render(); setBadge();
}
async function unlock(){
  const pass=($('#gate-pass')||{}).value||''; if(!pass) return;
  showGate('busy','Decrypting…');
  try{ const data=await BL.secure.decrypt(ui.envelope,pass); persist.pass=pass; ui.envelope=null; applyLoaded({status:'plain',data:data}); }
  catch(e){ showGate('unlock',e.message); }
}
function askRestorePass(){
  openDlg('Restore encrypted backup','<p class="sub" style="margin-bottom:8px">'+esc(ui.pendingEnc.name)+'</p><label class="sub">Passphrase<input class="in" id="rp" type="password" autocomplete="off" style="width:100%"></label><div class="row" style="margin-top:14px"><button class="btn" data-a="restore-enc-go">Restore</button><button class="btn ghost" data-a="restore-enc-cancel">Cancel</button></div>');
}
function passDialog(title,intro,action,label){
  openDlg(title,'<p class="sub" style="margin-bottom:10px;max-width:60ch">'+intro+'</p><div class="form"><label class="wide">Passphrase (at least 8 characters)<input class="in" id="pp1" type="password" autocomplete="new-password"></label><label class="wide">Repeat it<input class="in" id="pp2" type="password" autocomplete="new-password"></label></div><p class="sub" id="pp-err" style="margin-top:8px"></p><div class="row" style="margin-top:12px"><button class="btn" data-a="'+action+'">'+esc(label)+'</button><button class="btn ghost" data-a="close">Cancel</button></div>');
}
function readNewPass(){
  const a=($('#pp1')||{}).value||'', b=($('#pp2')||{}).value||''; const err=$('#pp-err');
  if(a.length<8){ err.textContent='Use at least 8 characters.'; return null; }
  if(a!==b){ err.textContent='The two entries do not match.'; return null; }
  return a;
}
async function encryptedBackup(){
  passDialog('Encrypted backup','Choose a passphrase for this backup file. You need it to restore. If you lose it the backup cannot be opened.','backup-enc-go','Save backup');
}
function statementsSection(){
  const cov=BL.core.coverage(state.snaps,new Date().toISOString().slice(0,10));
  const rows=state.snaps.slice().reverse().map(s=>{
    const ch=BL.core.checkSnap(s); const warn=ch.filter(c=>c.level==='warn');
    const per=s.from&&s.from!==s.to?BL.core.fmtDay(s.from)+' to '+BL.core.fmtDay(s.to):BL.core.fmtDay(s.to);
    return '<tr><td>'+esc(s.label)+'</td><td class="muted">'+esc(per)+'</td><td class="num">'+money(s.nav)+'</td><td class="num">'+(s.n==null?'–':s.n)+'</td><td class="num">'+(s.ledger||[]).length+'</td><td>'+(warn.length?'<span class="tag flag" title="'+esc(warn.map(w=>w.msg).join(' '))+'">Check</span> <span class="sub">'+esc(warn[0].msg.slice(0,70))+(warn[0].msg.length>70?'…':'')+'</span>':'<span class="gain">OK</span>')+'</td><td class="num"><button class="btn ghost sm" data-a="snap-del" data-k="'+esc(s.from+'|'+s.to)+'">Remove</button></td></tr>';
  }).join('');
  const nav=state.navExtra.length?'<p class="sub" style="margin-top:8px">'+state.navExtra.length+' extra net asset value points imported from files. <button class="link" data-a="nav-clear">Remove them</button></p>':'';
  const tr=tracked();
  const trackBox=tr&&!state.demo?'<div class="panel" style="margin-bottom:12px"><div class="kv"><span class="muted">Tracked until</span><span><b class="'+(tr.status==='current'?'gain':tr.status==='overdue'?'loss':'')+'"'+(tr.status==='due'?' style="color:var(--flag)"':'')+'>'+esc(BL.core.fmtDay(tr.through))+'</b> <span class="muted">('+esc(BL.core.agoText(tr.days))+')</span></span></div><div class="kv"><span class="muted">Statements start</span><span>'+esc(BL.core.fmtDay(tr.since))+'</span></div>'+(tr.latestTx?'<div class="kv"><span class="muted">Latest transaction</span><span>'+esc(BL.core.fmtDay(tr.latestTx))+'</span></div>':'')+'<div class="kv"><span class="muted">Next to import</span><span>'+(tr.status==='current'?'Nothing due yet. The next one starts ':'The statement starting ')+'<b>'+esc(BL.core.fmtDay(tr.next.from))+'</b> <span class="muted">('+esc(tr.next.desc)+')</span></span></div></div>':'';
  const cs=copyStats(); const keep=state.set.keepCopies!==false;
  const copiesBox=state.snaps.length&&!state.demo?'<div class="panel" style="margin-bottom:12px"><div class="row"><button class="btn'+(cs.withCopy?'':' ghost')+' sm" data-a="recalc"'+(cs.withCopy?'':' disabled')+'>Recalculate from saved statements</button><span class="sub">'+cs.withCopy+' of '+cs.total+' statements have a saved cleaned copy.'+(cs.stale.length?' '+cs.stale.length+' were read by an older version.':'')+'</span></div><p class="sub" style="margin-top:8px;max-width:80ch">Ballast keeps a cleaned copy of each statement so it can re-read it when it improves, without asking for the file again. Your name, account number, address and account type are removed, and only the sections Ballast uses are kept. <button class="link" data-a="copies-toggle">'+(keep?'Stop keeping copies':'Start keeping copies again')+'</button> · <button class="link" data-a="copies-delete">Delete saved copies</button></p></div>':'';
  return '<section class="sec"><div class="sec-head"><h2>Statements imported</h2>'+(cov.first?'<span class="sub">Covers '+esc(BL.core.fmtDay(cov.first))+' to '+esc(BL.core.fmtDay(cov.last))+(cov.gaps.length?', '+cov.gaps.length+' gap'+(cov.gaps.length>1?'s':''):'')+'. <button class="link" data-a="go" data-v="performance">See coverage</button></span>':'')+'</div>'+trackBox+copiesBox+
    (state.snaps.length?'<div class="scroll"><table class="t"><thead><tr><th>Statement</th><th>Period</th><th class="num">Net asset value</th><th class="num">Positions</th><th class="num">Transactions</th><th>Checks</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p class="sub">None yet.</p>')+nav+'</section>';
}
function aboutSection(){
  const rows=versionRows();
  return '<section class="sec"><div class="sec-head"><h2>About this copy</h2><span class="sub">Version '+RELEASE.n+', '+esc(RELEASE.date)+'</span></div><div class="scroll"><table class="t"><thead><tr><th>File</th><th class="num">Version found</th><th class="num">Needed</th><th></th></tr></thead><tbody>'+rows.map(r=>'<tr><td>js/'+esc(r.file)+'</td><td class="num">'+(r.have==null?'not found':esc(r.have))+'</td><td class="num">'+esc(r.need)+'</td><td>'+(r.ok?'<span class="gain">OK</span>':'<span class="loss">Out of date, replace it</span>')+'</td></tr>').join('')+'</tbody></table></div><p class="sub" style="margin-top:8px;max-width:78ch">If a row says out of date, replace that file in your repo\'s js folder, wait for GitHub Pages to update (its Actions tab shows a green tick), and reload with Ctrl+Shift+R. The other script files are not tracked here.</p></section>';
}
function backupSection(){
  return '<section class="sec"><div class="sec-head"><h2>Backup, export and reset</h2></div><div class="row"><button class="btn ghost" data-a="export-backup-enc">Save encrypted backup</button><button class="btn ghost" data-a="export-backup">Save plain backup</button><button class="btn ghost" data-a="export-csv">Holdings CSV</button><button class="btn ghost" data-a="export-ledger">Transactions CSV</button><button class="btn ghost" data-a="export-nav">NAV history CSV</button><button class="btn ghost" data-a="print">Print or save as PDF</button><button class="btn danger" data-a="wipe">Delete all data</button></div><p class="sub" style="margin-top:8px;max-width:74ch">A plain backup contains your full holdings and history, so keep it somewhere private or use the encrypted one. To restore, drop the file into the import area above.</p></section>';
}
function storageSection(){
  const cfgd=BL.cloud.configured(), api=BL.cloud.apiConfigured(), inDrive=persist.mode==='drive';
  const row=(k,v)=>'<div class="kv"><span class="muted">'+k+'</span><span>'+v+'</span></div>';
  return '<section class="sec"><div class="sec-head"><h2>Storage and security</h2></div><div class="panel">'+
    row('Where your data lives',inDrive?'Your Google Drive, in a folder called Ballast':'This browser only')+
    row('Encryption',inDrive?(persist.pass?'On. Only you can read the file, and only with your passphrase.':'Off. The file in Drive is readable by anyone who can open your Drive.'):'Not applicable')+
    row('Market data service',api?(BL.cloud.hasIdToken()?'Connected':'Set up, needs your permission'):'Not set up')+
    row('Drive sync',cfgd?(inDrive?'Signed in':'Available'):'Not set up in js/config.js')+
    '<div class="row" style="margin-top:14px">'+
    (cfgd&&!inDrive?'<button class="btn" data-a="drive-connect">Connect Google Drive</button>':'')+
    (inDrive&&!persist.pass?'<button class="btn" data-a="enc-setup">Encrypt my Drive data</button>':'')+
    (inDrive&&persist.pass?'<button class="btn ghost" data-a="enc-setup">Change passphrase</button><button class="btn ghost" data-a="enc-remove">Turn encryption off</button>':'')+
    (inDrive?'<button class="btn ghost" data-a="restore-prev">Restore previous version</button><button class="btn ghost" data-a="sign-out">Sign out</button>':'')+
    (api&&!BL.cloud.hasIdToken()?'<button class="btn ghost" data-a="id-signin">Allow market data</button>':'')+
    '</div></div>'+
    '<details style="margin-top:12px"><summary class="sub" style="cursor:pointer">What leaves your browser, and where it goes</summary><div class="sub" style="max-width:78ch;margin-top:8px">'+
    '<p><b>Your statements</b> are read in this browser and never uploaded. Name, account number and address are not kept. Ballast saves a cleaned copy of each (identity columns blanked, only the sections it uses) so it can recalculate later. You can turn that off or delete the copies in Data &amp; settings.</p>'+
    '<p style="margin-top:6px"><b>Google Drive</b> receives your data file (encrypted if you turn that on). Ballast can only see files it created.</p>'+
    '<p style="margin-top:6px"><b>The market data service</b> receives ticker symbols, the websites you asked it to read, and an identity-only sign-in token. It never receives balances, quantities or statements. Yahoo Finance and Google News see the tickers it looks up.</p>'+
    '<p style="margin-top:6px"><b>The AI buttons</b> send public figures for one ticker, or your allocation percentages (no amounts) when you press them.</p></div></details></section>';
}
function liveRefreshPanel(){
  const api=BL.cloud.apiConfigured();
  if(!api) return '<section class="sec"><div class="sec-head"><h2>Live refresh</h2></div><p class="sub" style="max-width:74ch">Live prices, indices, news and website reading need the market data service (a small Cloudflare Worker). It is not set up yet. See README step 3. Until then you can use the offline feed below.</p></section>';
  if(!BL.cloud.hasIdToken()) return '<section class="sec"><div class="sec-head"><h2>Live refresh</h2></div><p class="sub" style="max-width:74ch;margin-bottom:8px">Refreshing needs a sign-in that proves it is you. This one cannot open your Drive.</p><button class="btn" data-a="id-signin">Allow market data</button></section>';
  const n=state.src.custom.length;
  return '<section class="sec"><div class="sec-head"><h2>Live refresh</h2><span class="sub">On demand only. Nothing runs in the background.</span></div><div class="row"><button class="btn" data-a="refresh-feed"'+(ui.refreshing?' disabled':'')+'>'+(ui.refreshing?'Refreshing…':'Refresh prices, indices, news'+(n?' and '+n+' website'+(n>1?'s':''):''))+'</button><span class="sub">'+esc(ui.refreshMsg||'')+'</span></div><p class="sub" style="margin-top:8px;max-width:74ch">Sends your tickers, your flagged holdings\' names and the websites you added to the service. Balances and quantities are never sent.</p></section>';
}
function refreshButton(){ return BL.cloud.apiConfigured()&&BL.cloud.hasIdToken()?'<button class="btn ghost sm" data-a="refresh-feed"'+(ui.refreshing?' disabled':'')+'>'+(ui.refreshing?'Refreshing…':'Refresh now')+'</button>':''; }
async function refreshFeed(){
  if(ui.refreshing) return; ui.refreshing=true; ui.refreshMsg='Fetching…'; render(true);
  const say=m=>{ ui.refreshMsg=m; const el=$('#view .sec .sub:last-child'); };
  try{
    const src=JSON.parse(sourcesJSON()); const feed={generated_at:new Date().toISOString(),base:state.base,quotes:{},indices:[],news:[],custom:[]};
    const pairs=src.symbols.map(s=>[s.symbol,s.yahoo]).concat(src.watch.map(w=>[w.symbol,w.yahoo])); const uniq=Array.from(new Set(pairs.map(p=>p[1])));
    const by={}; for(let i=0;i<uniq.length;i+=40){ const r=await BL.cloud.api('/quotes',{symbols:uniq.slice(i,i+40)}); Object.assign(by,r.quotes||{}); }
    pairs.forEach(p=>{ if(by[p[1]]) feed.quotes[p[0]]=by[p[1]]; });
    const ccys=Array.from(new Set(src.symbols.map(s=>s.currency).concat([state.base],state.cash.map(c=>c.ccy)))).filter(Boolean);
    feed.fx_per_usd=(await BL.cloud.api('/fx',{currencies:ccys})).fx_per_usd;
    feed.indices=(await BL.cloud.api('/indices',{indices:state.src.indices})).indices||[];
    const flagged=src.symbols.filter(s=>s.flagged); const news=[];
    for(let i=0;i<Math.max(1,flagged.length);i+=8){ const t=flagged.slice(i,i+8).map(s=>({symbol:s.symbol,yahoo:s.yahoo,name:s.name})); if(!t.length&&!state.src.queries.length) break; const r=await BL.cloud.api('/news',{targets:t,queries:i===0?state.src.queries:[],days:state.src.days}); news.push.apply(news,r.news||[]); }
    feed.news=news;
    for(const c of state.src.custom.slice(0,10)){ try{ feed.custom.push(await BL.cloud.api('/scrape',c)); }catch(e){ feed.custom.push({name:c.name,url:c.url,kind:c.kind,fetched_at:new Date().toISOString(),error:e.message}); } }
    importFeed(feed); ui.refreshMsg='Updated '+new Date().toLocaleTimeString()+'.';
  }catch(e){ ui.refreshMsg='Refresh failed: '+e.message; }
  ui.refreshing=false; render(true);
}
function overviewLine(){
  const p=getPerf(); if(p.series.length<2) return ''; const parts=[];
  if(fin(p.gain)&&fin(p.contributions)&&p.contributions>0){
    // With live prices the headline is today's value, so the gain uses it too. Otherwise the gain uses the statement's own value.
    const m=M(); const live=m.rows.some(r=>r.live); const gain=live?m.total-p.contributions:p.gain; const diff=fin(p.nav)&&m.total?Math.abs(p.nav-m.total):0;
    parts.push('<span class="'+cls(gain)+'">'+smoney(gain)+' gain on '+money(p.contributions)+' put in</span>'+(live?'<span class="muted"> (using live prices)</span>':diff>=1?'<span class="muted"> (worked out from the statement value of '+money(p.nav)+')</span>':''));
  }
  if(fin(p.totalTwr)&&p.verifiedDays>0) parts.push('<span class="muted">'+(p.coarse?'approximate return ':'time-weighted return ')+spct(p.totalTwr*100)+(fin(p.annualised)?', about '+spct(p.annualised*100)+' a year':'')+(M().rows.some(r=>r.live)?', to your last statement':'')+'</span>');
  return parts.join(' · ');
}
const todayIso=()=>new Date().toISOString().slice(0,10);
function tracked(){ return state.snaps.length?BL.core.trackedThrough(state.snaps,todayIso()):null; }
function trackedMeta(){
  const t=tracked();
  if(state.demo) return '<span>Sample data</span>';
  if(!t) return state.asOfLabel?'<span>Statement '+esc(state.asOfLabel)+'</span>':'';
  const colour=t.status==='current'?'gain':t.status==='overdue'?'loss':''; const style=t.status==='due'?' style="color:var(--flag)"':'';
  return '<span class="'+colour+'"'+style+' title="The latest activity statement you imported ends on this date. Holdings and history are only as recent as this.">Statements tracked to '+esc(BL.core.fmtDay(t.through))+' ('+esc(BL.core.agoText(t.days))+')</span>';
}
function trackedSub(){
  const t=tracked(); if(state.demo) return 'Sample data';
  if(!t) return state.asOfLabel?'Statement '+esc(state.asOfLabel):'Manual entry';
  return 'Statements tracked to '+esc(BL.core.fmtDay(t.through))+', '+esc(BL.core.agoText(t.days));
}
function staleNote(){
  if(!state.snaps.length||state.demo) return '';
  const t=tracked(); if(!t||t.status==='current'||t.status==='unknown') return '';
  return '<div class="banner '+(t.status==='overdue'?'':'info')+'">Your data is tracked to <b>'+esc(BL.core.fmtDay(t.through))+'</b> ('+t.days+' days ago). To bring it up to date, import the activity statement starting <b>'+esc(BL.core.fmtDay(t.next.from))+'</b> ('+esc(t.next.desc)+'). <button class="link" data-a="go" data-v="data">Import</button></div>';
}
async function restorePrev(){
  try{
    const r=await BL.cloud.loadPrev(); if(r.status==='none'){ toast('There is no previous version yet.'); return; }
    let data=r.data; if(r.status==='encrypted'){ if(!persist.pass){ toast('The previous version is encrypted and no passphrase is active.'); return; } data=await BL.secure.decrypt(r.envelope,persist.pass); }
    ui.restoreData=data; const n=(data.snaps||[]).length, p=(data.positions||[]).length;
    openDlg('Restore previous version?','<p>The previous saved copy has '+p+' positions and '+n+' statements. Restoring replaces what you have now and saves it to Drive.</p><div class="row" style="margin-top:14px"><button class="btn" data-a="restore-prev-go">Restore</button><button class="btn ghost" data-a="close">Cancel</button></div>');
  }catch(e){ toast(e.message); }
}
const EXTRA_ACTIONS={
  tk:el=>{ ui.tk=el.dataset.v; render(); },
  'values':el=>setValueMode(el.dataset.v==='live'),
  'recalc':()=>{ const r=recalcFromSaved(); toast(r.done?'Recalculated '+r.done+' statement'+(r.done>1?'s':'')+(r.skipped?'. '+r.skipped+' had no saved copy':''):'There are no saved copies to recalculate from. Import the statements once more.'); autoRates(); render(true); },
  'copies-toggle':()=>{ state.set.keepCopies=state.set.keepCopies===false; dirty(); render(true); },
  'copies-delete':()=>openDlg('Delete saved statement copies?','<p>Ballast will keep the numbers it already extracted, but it will no longer be able to recalculate from the statements. You would need to import them again to get that back.</p><div class="row" style="margin-top:14px"><button class="btn danger" data-a="copies-delete-go">Delete the copies</button><button class="btn ghost" data-a="close">Cancel</button></div>'),
  'copies-delete-go':()=>{ state.snaps.forEach(s=>{ s.raw=''; }); closeDlg(); dirty(); render(true); toast('Saved copies deleted'); },
  'ver-continue':()=>{ ui.verIgnored=true; hideGate(); BL.app.boot(); },
  'fx-fetch':async()=>{ try{ const n=await fetchRates(true); toast(n?'Exchange rates updated':'No rates were returned'); }catch(e){ toast(e.message); } render(true); },
  'gate-signin':async()=>{ try{ showGate('busy','Waiting for Google…'); await BL.cloud.signIn(); await afterSignIn(); }catch(e){ showGate('signin',e.message); } },
  'gate-local':()=>{ persist.mode='local'; persist.blocked=false; state=load(); ledgerMemo=perfMemo=memo=null; hideGate(); applyTheme(); render(); setBadge(); },
  'gate-unlock':()=>unlock(),
  'gate-retry':()=>afterSignIn(),
  'drive-connect':async()=>{ try{ await BL.cloud.signIn(); await afterSignIn(); }catch(e){ toast(e.message); hideGate(); } },
  'sign-out':()=>{ BL.cloud.signOut(); persist.mode='local'; persist.pass=null; persist.blocked=true; state=blank(); ledgerMemo=perfMemo=memo=null; ui.view='overview'; render(); showGate('signin'); },
  'id-signin':async()=>{ try{ await BL.cloud.signInId(); toast('Market data allowed'); autoRates(); }catch(e){ toast(e.message); } render(true); },
  'enc-setup':()=>passDialog(persist.pass?'Change passphrase':'Encrypt your Drive data','Your data file in Drive will be encrypted with this passphrase. It is never stored or sent anywhere. If you lose it, the data cannot be recovered, so keep a plain or encrypted backup too.','enc-go','Encrypt'),
  'enc-go':async()=>{ const p=readNewPass(); if(!p) return; persist.pass=p; closeDlg(); await persistNow(); render(true); toast('Encryption is on'); },
  'enc-remove':()=>openDlg('Turn encryption off?','<p>The file in Drive will be saved as readable text. Anyone who can open your Drive could read it.</p><div class="row" style="margin-top:14px"><button class="btn danger" data-a="enc-remove-go">Turn it off</button><button class="btn ghost" data-a="close">Cancel</button></div>'),
  'enc-remove-go':async()=>{ persist.pass=null; closeDlg(); await persistNow(); render(true); },
  'restore-prev':()=>restorePrev(),
  'restore-prev-go':()=>{ state=normalise(merge(blank(),ui.restoreData)); ui.restoreData=null; ledgerMemo=perfMemo=memo=null; closeDlg(); dirty(); applyTheme(); render(); toast('Restored the previous version'); },
  'restore-enc-go':async()=>{ const p=($('#rp')||{}).value||''; const e=ui.pendingEnc; try{ const d=cleanJson(await BL.secure.decrypt(e.env,p)); if(!d||!Array.isArray(d.positions)) throw new Error('This file is not a Ballast backup.'); state=normalise(merge(blank(),d)); ui.pendingEnc=null; ledgerMemo=perfMemo=memo=null; closeDlg(); dirty(); applyTheme(); render(); toast('Backup restored'); }catch(err){ toast(err.message); } },
  'restore-enc-cancel':()=>{ ui.pendingEnc=null; closeDlg(); },
  'backup-enc-go':async()=>{ const p=readNewPass(); if(!p) return; try{ const env=await BL.secure.encrypt(state,p); closeDlg(); saveFile('ballast-backup-encrypted.json',JSON.stringify(env),'application/json'); }catch(e){ toast(e.message); } },
  'export-ledger':()=>saveFile('transactions.csv',ledgerCSV(),'text/csv;charset=utf-8'),
  'export-nav':()=>saveFile('nav-history.csv',navCSV(),'text/csv;charset=utf-8'),
  'nav-clear':()=>{ state.navExtra=[]; dirty(); render(true); },
  'refresh-feed':()=>refreshFeed(),
  print:()=>window.print(),
  'src-test':async()=>{ const u=$('#s-url').value.trim(),s=$('#s-sel').value.trim(),k=$('#s-kind').value; const out=$('#s-test'); if(!/^https:\/\//.test(u)||!s){ out.textContent='Enter an https address and a selector first.'; return; } out.textContent='Reading…';
    try{ const r=await BL.cloud.api('/scrape',{name:'test',url:u,kind:k,selector:s}); const n=r.rows?r.rows.length+' table rows':(r.items||[]).length+' items'; const first=r.rows?(r.rows[0]||[]).join(' | '):((r.items||[])[0]||{}).label; out.textContent='Found '+n+'. First: '+String(first||'').slice(0,120); }catch(e){ out.textContent=e.message; } }
};
const VIEW={overview:vOverview,holdings:vHoldings,markets:vMarkets,rebalance:vRebalance,news:vNews,toolkit:vToolkit,data:vData,performance:()=>'',activity:()=>'',research:()=>''};
function applyTheme(){ const t=state.set.theme; if(t==='auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme',t); }
function render(keepScroll){
  memo=null; matchers=null;
  const y=window.scrollY;
  const badge=state.positions.some(p=>p.flag)?getAlerts().filter(a=>a.kind==='news'&&a.sev!=='info').length:0;
  $('#nav').innerHTML=VIEWS.map(v=>'<button data-a="go" data-v="'+v[0]+'"'+(ui.view===v[0]?' aria-current="page"':'')+'>'+v[1]+(v[0]==='news'&&badge?'<span class="pill" title="High-impact or notable headlines on flagged holdings">'+badge+'</span>':'')+'</button>').join('');
  setBadge();
  $('#title').textContent=(VIEWS.find(v=>v[0]===ui.view)||[])[1]||'';
  $('#meta').innerHTML=trackedMeta()+'<span>Base currency '+esc(state.base)+'</span>'+(state.feed?'<span>Feed '+esc(ago(state.feed.generated_at||state.feed.imported_at))+'</span>':'');
  $('#view').innerHTML=VIEW[ui.view]();
  document.title='Ballast: '+$('#title').textContent;
  if(keepScroll) window.scrollTo(0,y);
}
function go(v){ ui.view=v; render(); window.scrollTo(0,0); }
let toastT=0;
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>{ t.hidden=true; },3800); }
function openDlg(title,html){ const d=$('#dlg'); d.innerHTML='<h2 id="dlg-title">'+esc(title)+'</h2>'+html; if(d.showModal) d.showModal(); else d.setAttribute('open',''); }
function closeDlg(){ const d=$('#dlg'); if(d.close) d.close(); else d.removeAttribute('open'); }

/* ------------------------------------------------------------------ *
 * Files
 * ------------------------------------------------------------------ */
async function saveFile(name,text,mime){
  if(!CFG.PREVIEW){
    try{ const blob=new Blob([text],{type:mime||'text/plain;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.rel='noopener'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),4000); toast('Saved '+name); return; }catch(e){}
  }
  openDlg('Copy '+name,'<p class="sub" style="margin-bottom:8px">Downloads are not available here. Copy this text into a file named <b>'+esc(name)+'</b>.</p><textarea class="in" id="copybox" style="min-height:220px" readonly>'+esc(text)+'</textarea><div class="row" style="margin-top:12px"><button class="btn" data-a="copy-box">Copy to clipboard</button><button class="btn ghost" data-a="close">Close</button></div>');
}
function sourcesJSON(){
  return JSON.stringify({base:state.base,
    symbols:state.positions.filter(p=>!isDeriv(p)).map(p=>({symbol:p.symbol,yahoo:p.yahoo||yahooGuess(p),name:p.desc,currency:p.ccy,flagged:!!p.flag})),
    watch:state.watch.map(w=>({symbol:w.symbol,yahoo:w.yahoo||w.symbol})),indices:state.src.indices,
    news:{days:state.src.days,extraQueries:state.src.queries},
    custom:state.src.custom.map(c=>({name:c.name,url:c.url,kind:c.kind,selector:c.selector}))},null,2);
}
function holdingsCSV(){
  const m=M(); const q=csvCell;
  return ['Symbol,Description,Class,Region,Sector,Currency,Quantity,Price,Value '+state.base+',Weight %,Unrealized %,Flagged'].concat(m.rows.map(r=>[q(r.symbol),q(r.desc),q(r.cls),q(r.region),q(r.sector),q(r.ccy),r.qty,r.px,r.val.toFixed(2),r.w.toFixed(2),fin(r.pnlPct)?r.pnlPct.toFixed(2):'',r.flag?'yes':'no'].join(','))).join('\n');
}
function ledgerCSV(){
  const q=csvCell; const num=v=>fin(v)?v:'';
  return ['Date,Time,Type,Symbol,Description,Currency,Quantity,Price,Amount,Fee,Fee currency,Realized P/L'].concat(getLedger().map(e=>[e.date,e.time||'',e.type,q(e.sym),q(BL.core.describeEntry(e)),e.ccy,num(e.qty),num(e.price),num(e.amt),num(e.fee),e.feeCcy||'',num(e.pnl)].join(','))).join('\n');
}
function navCSV(){
  const p=getPerf(); return ['Date,Net asset value '+state.base+',Net contributions,Gain,Growth index (100 at start),Source'].concat(p.series.map(s=>[s.date,s.nav.toFixed(2),s.contrib.toFixed(2),s.gain.toFixed(2),s.idx.toFixed(3),s.kind].join(','))).join('\n');
}
function looksLikeNavSeries(t){
  const rows=parseCSV(t.slice(0,6000)); const hi=rows.findIndex(r=>r.filter(c=>c.trim()).length>=2); if(hi<0) return false;
  const h=rows[hi].map(x=>x.trim().toLowerCase()); if(h.some(x=>/symbol|ticker|quantity|shares|instrument/.test(x))) return false;
  return h.some(x=>/date|month|period/.test(x))&&h.some(x=>/nav|net asset|equity|ending value|total|balance/.test(x));
}
function routeText(name,text,ibkr){
  const t=text.trim();
  if(t[0]==='{'||t[0]==='['){
    let o; try{ o=JSON.parse(t); }catch(e){ return {ok:false,msg:name+' is not valid JSON.'}; }
    if(BL.secure.isEnvelope(o)){ ui.pendingEnc={name:name,env:o}; return {ok:true,msg:name+' is an encrypted backup. Enter its passphrase to restore it.'}; }
    o=cleanJson(o);
    if(o&&o.v&&Array.isArray(o.positions)){ state=normalise(merge(blank(),o)); dirty(); applyTheme(); return {ok:true,msg:'Restored backup '+name+'.',view:'overview'}; }
    try{ importFeed(o); return {ok:true,msg:'Imported feed '+name+'.',view:'markets'}; }catch(e){ return {ok:false,msg:name+': '+e.message}; }
  }
  if(isIBKR(t)){ try{ const r=parseIBKR(t); if(state.set.keepCopies!==false){ try{ r.raw=BL.core.sanitizeIBKR(t); }catch(e){} } ibkr.push(r); return {ok:true,msg:'Read '+name+': '+(r.label||'statement')+', '+r.positions.length+' positions, '+r.ledger.length+' transactions'+(fin(r.nav)?', net asset value '+nf0.format(r.nav)+' '+(r.base||''):'')+'.',view:'overview'}; }catch(e){ return {ok:false,msg:name+': '+e.message}; } }
  if(looksLikeNavSeries(t)){
    try{
      const r=BL.core.parseNavSeries(t); const byDate=new Map(state.navExtra.map(x=>[x.date,x])); r.points.forEach(p=>byDate.set(p.date,{date:p.date,nav:p.nav}));
      state.navExtra=Array.from(byDate.values()).sort((a,b)=>a.date<b.date?-1:1); dirty();
      return {ok:true,msg:'Read '+r.points.length+' net asset value points from '+name+' ('+BL.core.fmtDay(r.points[0].date)+' to '+BL.core.fmtDay(r.points[r.points.length-1].date)+'). '+r.note+' They are treated as '+state.base+'.',view:'performance'};
    }catch(e){ /* fall through to the holdings importer */ }
  }
  try{ ui.gen=parseGeneric(name,t); return {ok:true,msg:name+' is not an IBKR statement. Match its columns below.'}; }catch(e){ return {ok:false,msg:e.message}; }
}
async function handleFiles(files){
  const ibkr=[]; ui.log=[]; let view=null;
  for(const f of Array.from(files)){
    if(f.size>25*1024*1024){ ui.log.push({ok:false,msg:f.name+' is larger than 25 MB and was skipped.'}); continue; }
    let text=''; try{ text=await f.text(); }catch(e){ ui.log.push({ok:false,msg:'Could not read '+f.name}); continue; }
    const r=routeText(f.name,text,ibkr); ui.log.push(r); if(r.ok&&r.view) view=r.view;
  }
  if(ibkr.length){ ingest(ibkr); autoRates(); ui.view=ibkr.length>1?'performance':'overview'; toast('Imported '+ibkr.length+' statement'+(ibkr.length>1?'s':'')); }
  else if(view){ ui.view=view; if(view==='markets') ui.mk='prices'; const ok=ui.log.find(l=>l.ok&&l.view===view); toast(ok?ok.msg:'Imported'); }
  render(); window.scrollTo(0,0);
  if(ui.pendingEnc) askRestorePass();
}
function handlePaste(text){
  const ibkr=[]; ui.log=[]; const r=routeText('pasted text',text,ibkr); ui.log.push(r);
  if(ibkr.length){ ingest(ibkr); autoRates(); ui.view='overview'; toast('Statement imported'); } else if(r.ok&&r.view) ui.view=r.view;
  render();
}

/* ------------------------------------------------------------------ *
 * Demo data (invented numbers, for exploring the tool only)
 * ------------------------------------------------------------------ */
function loadDemo(){
  const P=(symbol,desc,ccy,qty,price,cost,extra)=>Object.assign({symbol:symbol,desc:desc,ccy:ccy,qty:qty,price:price,cost:cost,mult:1,asset:'Stocks'},extra||{});
  const raw=[P('VOO','Vanguard S&P 500 ETF','USD',60,590,27500),P('NWR','Northwind Robotics (demo company)','USD',120,85,10400),P('SNTL','Sentinel Semiconductors (demo company)','USD',40,210,6900),
    P('VGK','Vanguard FTSE Europe ETF','USD',150,70,9200),P('EWJ','iShares MSCI Japan ETF','USD',200,75,13100),P('VWO','Vanguard FTSE Emerging Markets ETF','USD',180,48,8100),
    P('MCHI','iShares MSCI China ETF','USD',100,50,6100),P('GLD','SPDR Gold Shares','USD',25,250,4900),P('AGG','iShares Core US Aggregate Bond ETF','USD',90,99,9300),
    P('OAKB','Oakbridge Bank (demo company)','GBP',500,4.2,1900,{exch:'LSE'})];
  state=blank(); state.base='USD'; state.fx={GBP:1.3};
  state.positions=raw.map(r=>buildPosition(r,{},null));
  const pf=s=>state.positions.find(p=>p.symbol===s);
  pf('NWR').flag=true; pf('NWR').region='United States'; pf('NWR').auto=false; pf('NWR').aliases='Northwind';
  pf('SNTL').sector='Technology'; pf('SNTL').auto=false;
  pf('OAKB').sector='Financials'; pf('OAKB').region='Europe & UK'; pf('OAKB').auto=false;
  state.cash=[{ccy:'USD',amount:3200},{ccy:'GBP',amount:800}];
  memo=null; const tot=M().nav;
  // Invented history: 44 monthly statements from Jan 2023. Monthly returns come from a seeded generator, and the monthly deposit is
  // solved so the last statement lands on today's demo portfolio value.
  const rnd=BL.goals.mulberry32(92), N=44, rets=[];
  for(let i=0;i<N;i++){ const u1=Math.max(rnd(),1e-9),u2=rnd(); rets.push(0.0075+0.035*Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2)); }
  const run=(D0,d)=>{ let v=0; for(let i=0;i<N;i++){ v=(v+(i===0?D0:d))*(1+rets[i]); } return v; };
  const D0=10000, dep=Math.max(200,Math.round((tot-run(D0,0))/(run(0,1))));
  const pad=n=>String(n).padStart(2,'0'), r2=v=>Math.round(v*100)/100; const syms=['VOO','VGK','EWJ','VWO','AGG','MCHI','GLD']; const px0={VOO:590,VGK:70,EWJ:75,VWO:48,AGG:99,MCHI:50,GLD:250};
  let nav=0; const snaps=[];
  for(let i=0;i<N;i++){
    const y=2023+Math.floor(i/12), mo=i%12+1, last=new Date(Date.UTC(y,mo,0)).getUTCDate(); const from=y+'-'+pad(mo)+'-01', to=y+'-'+pad(mo)+'-'+pad(last); const d=i===0?D0:dep; const start=nav; nav=(nav+d)*(1+rets[i]);
    const L=[]; const E=(type,day,o)=>L.push(Object.assign({type:type,date:y+'-'+pad(mo)+'-'+pad(day),time:'',sym:'',asset:'',ccy:'USD',qty:NaN,price:NaN,amt:0,fee:0,feeCcy:'USD',pnl:NaN,desc:'',code:''},o));
    E('dep',3,{amt:d,desc:'Deposit (Electronic Fund Transfer)'});
    const s1=syms[i%syms.length], s2=syms[(i+3)%syms.length]; [[s1,0.6],[s2,0.3]].forEach((x,k)=>{ const p=r2(px0[x[0]]*(0.72+0.28*i/N)); const q=Math.max(1,Math.floor(d*x[1]/p)); E('buy',6+k*7,{time:'09:'+pad(31+k)+':10',sym:x[0],asset:'Stocks',qty:q,price:p,amt:-r2(q*p),fee:-1}); });
    let sold=0; if(i%9===8){ const p=r2(px0.VOO*(0.72+0.28*i/N)); E('sell',20,{time:'10:05:00',sym:'VOO',asset:'Stocks',qty:-2,price:p,amt:r2(2*p),fee:-1,pnl:r2(2*p*0.08),code:'C'}); }
    if(i===9){ E('fx',2,{sym:'GBP.USD',asset:'Forex',qty:1000,price:1.27,amt:-1270,fee:-2,feeCcy:'USD'}); }
    let div=0,tax=0; if(mo%3===0){ [['VOO',0.0032],['VGK',0.0024],['AGG',0.0028]].forEach(x=>{ const a=r2(nav*x[1]); div+=a; E('div',18,{sym:x[0],amt:a,desc:x[0]+' Cash Dividend (Ordinary Dividend)'}); const t=-r2(a*0.3); tax+=t; E('tax',18,{sym:x[0],amt:t,desc:x[0]+' Cash Dividend - US Tax'}); }); }
    const intr=r2(nav*0.0009); E('int',5,{amt:intr,desc:'USD Credit Interest for '+BL.core.MON3[(mo+10)%12]+'-'+(mo===1?y-1:y)}); E('fee',1,{amt:-4.5,desc:'Market Data - NYSE (Network A/CTA)'});
    const comm=sum(L.filter(e=>e.type==='buy'||e.type==='sell'||e.type==='fx'),e=>e.fee); const oth=-4.5;
    const mtm=r2(nav-start-d-div-tax-intr-comm-oth);
    snaps.push({key:to,from:from,to:to,label:BL.core.periodLabel(from,to),base:'USD',nav:r2(nav),navStart:r2(start),twrStmt:r2(rets[i]*100),n:10,sections:['Open Positions','Trades','Deposits & Withdrawals','Dividends','Cash Report','Change in NAV','Net Asset Value'],ledger:L,
      change:{'Mark-to-Market':mtm,'Deposits & Withdrawals':d,'Dividends':r2(div),'Withholding Tax':r2(tax),'Interest':intr,'Commissions':r2(comm),'Other Fees':oth}});
  }
  state.snaps=snaps; state.asOf='2026-08-31'; state.asOfLabel='Aug 2026'; state.stmtNav=r2(tot); state.demo=true;
  const now=Date.now(); const iso=h=>new Date(now-h*36e5).toISOString();
  const q={}; state.positions.forEach((p,i)=>{ q[p.symbol]={price:+(p.price*(1+((i%5)-2)*0.004)).toFixed(2),prev_close:p.price,change_pct:+(((i%5)-2)*0.4).toFixed(2),currency:p.ccy}; });
  q.NWR.change_pct=-6.4; q.NWR.price=+(85*0.936).toFixed(2);
  state.feed={generated_at:iso(3),demo:true,quotes:q,news:[
    {title:'Demo headline: regulator opens probe into Northwind Robotics over safety reports',url:'',source:'Demo feed',published:iso(5),symbols:['NWR']},
    {title:'Demo headline: Northwind Robotics to report earnings next week',url:'',source:'Demo feed',published:iso(20),symbols:['NWR']},
    {title:'Demo headline: European equities edge higher as inflation cools',url:'',source:'Demo feed',published:iso(9),symbols:[]},
    {title:'Demo headline: Sentinel Semiconductors announces buyback programme',url:'',source:'Demo feed',published:iso(30),symbols:['SNTL']}],indices:[],custom:[]};
  state.set.live=false; ui.view='overview'; dirty(); render(); window.scrollTo(0,0);
}

/* ------------------------------------------------------------------ *
 * AI features (optional, run through your own market data service)
 * ------------------------------------------------------------------ */
const aiOn=()=>!!(BL.cloud&&BL.cloud.apiConfigured()&&BL.cloud.hasIdToken());
async function aiReview(){
  if(!aiOn()||ui.aiBusy) return;
  const m=M(); if(!m.nav) return;
  const cb=calcBuckets('class',0), rb=calcBuckets('region',0);
  const data={baseCurrency:state.base,statement:state.asOfLabel,
    topHoldings:m.rows.slice().sort((a,b)=>b.val-a.val).slice(0,15).map(r=>({symbol:r.symbol,name:r.desc,class:r.cls,region:r.region,regionGuessed:!!r.auto,sector:r.sector,weightPct:+r.w.toFixed(1),unrealizedPct:fin(r.pnlPct)?+r.pnlPct.toFixed(1):null,flagged:!!r.flag})),
    assetMixVsTarget:cb.rows.map(r=>({bucket:r.key,nowPct:+r.now.toFixed(1),targetPct:+r.t.toFixed(1)})),
    equityRegionMixVsTarget:rb.rows.map(r=>({bucket:r.key,nowPct:+r.now.toFixed(1),targetPct:+r.t.toFixed(1)})),
    currencyMixPct:exposure(m,'currency').items.map(i=>({ccy:i.key,pct:+i.pct.toFixed(1)}))};
  ui.aiBusy=true; ui.aiText=''; render(true);
  try{ const r=await BL.cloud.api('/ai',{task:'review',payload:data}); ui.aiText=r.text||'No answer came back.'; }
  catch(e){ ui.aiText='The review could not be produced: '+e.message; }
  ui.aiBusy=false; if(ui.view==='rebalance') render(true);
}
async function aiNews(){
  if(!aiOn()||ui.newsBusy) return;
  const items=allNews().slice(0,25); if(!items.length) return;
  const held=state.positions.filter(p=>p.flag).map(p=>({symbol:p.symbol,name:p.desc}));
  const watch=held.length?held:state.positions.slice(0,20).map(p=>({symbol:p.symbol,name:p.desc}));
  ui.newsBusy=true; render(true);
  try{
    const r=await BL.cloud.api('/ai',{task:'news',payload:{holdings:watch,headlines:items.map((n,i)=>({i:i,title:n.title,source:n.source||''}))}});
    (Array.isArray(r.result)?r.result:[]).forEach(a=>{ const it=a&&items[a.i]; if(it) state.ai[it.key]={symbols:Array.isArray(a.symbols)?a.symbols.filter(s=>typeof s==='string').slice(0,6):[],impact:['high','medium','low','none'].includes(a.impact)?a.impact:'none',tone:['negative','neutral','positive'].includes(a.tone)?a.tone:'neutral',why:String(a.why||'').slice(0,160)}; });
    dirty(); toast('Headlines scored');
  }catch(e){ toast('Scoring stopped: '+e.message); }
  ui.newsBusy=false; render(true);
}

/* ------------------------------------------------------------------ *
 * Actions
 * ------------------------------------------------------------------ */
function findPos(id){ return state.positions.find(p=>p.id===id); }
function editDialog(id){
  const p=findPos(id); if(!p) return;
  const opt=(list,cur)=>list.map(x=>'<option'+(x===cur?' selected':'')+'>'+esc(x)+'</option>').join('');
  openDlg(p.symbol,'<p class="sub" style="margin:-8px 0 14px">'+esc(p.desc)+'</p><div class="form">'+
    '<label>Asset class<select class="in" id="e-cls">'+opt(CLASSES,p.cls)+'</select></label>'+
    '<label>Region<select class="in" id="e-region">'+opt(REGION_TAGS,p.region)+'</select></label>'+
    '<label>Sector<input class="in" id="e-sector" list="sectors" value="'+esc(p.sector)+'"></label><datalist id="sectors">'+SECTORS.map(s=>'<option value="'+esc(s)+'">').join('')+'</datalist>'+
    '<label>Description<input class="in" id="e-desc" value="'+esc(p.desc)+'"></label>'+
    '<label>Yahoo symbol for the scraper<input class="in" id="e-yahoo" placeholder="'+esc(yahooGuess(p))+'" value="'+esc(p.yahoo)+'"></label>'+
    '<label>News keywords, comma separated<input class="in" id="e-alias" value="'+esc(p.aliases)+'" placeholder="Company name, product names"></label>'+
    '<label class="wide">Notes<textarea class="in" id="e-notes" style="min-height:64px">'+esc(p.notes)+'</textarea></label>'+
    '<label class="wide" style="flex-direction:row;align-items:center;gap:8px;color:var(--ink)"><input type="checkbox" id="e-flag" '+(p.flag?'checked':'')+'> Flag this holding and track its news</label></div>'+
    '<div class="row" style="margin-top:16px;justify-content:space-between"><div class="row"><button class="btn" data-a="edit-save" data-id="'+esc(id)+'">Save</button><button class="btn ghost" data-a="close">Cancel</button></div><button class="btn danger" data-a="pos-del" data-id="'+esc(id)+'">Remove</button></div>');
}
const ACT={
  go:el=>go(el.dataset.v),
  close:()=>closeDlg(),
  demo:()=>loadDemo(),
  'clear-demo':()=>{ state=blank(); dirty(); render(); toast('Sample data cleared'); },
  dim:el=>{ ui.dim=el.dataset.v; render(true); },
  'cmp-go':()=>pullComparison(),
  sort:el=>{ const k=el.dataset.k; if(ui.sortK===k) ui.sortD*=-1; else { ui.sortK=k; ui.sortD=(k==='symbol'||k==='cls'||k==='region')?1:-1; } $('#htable').innerHTML=holdingsTable(); },
  flag:el=>{ const p=findPos(el.dataset.id); if(!p) return; p.flag=!p.flag; dirty(); render(true); toast(p.symbol+(p.flag?' flagged':' unflagged')); },
  edit:el=>editDialog(el.dataset.id),
  'edit-save':el=>{ const p=findPos(el.dataset.id); if(!p) return;
    p.cls=$('#e-cls').value; p.region=$('#e-region').value; p.auto=false; p.sector=$('#e-sector').value.trim()||'Unclassified'; p.desc=$('#e-desc').value.trim()||p.symbol;
    p.yahoo=$('#e-yahoo').value.trim(); p.aliases=$('#e-alias').value.trim(); p.notes=$('#e-notes').value.trim(); p.flag=$('#e-flag').checked;
    closeDlg(); dirty(); render(true); },
  'pos-del':el=>{ state.positions=state.positions.filter(p=>p.id!==el.dataset.id); closeDlg(); dirty(); render(true); },
  mk:el=>{ ui.mk=el.dataset.v; ui.view='markets'; render(); },
  newsf:el=>{ ui.newsF=el.dataset.v; render(true); },
  'toggle-headlines':()=>{ const h=$('#hl'); h.hidden=!h.hidden; if(!h.hidden) $('#hl-text').focus(); },
  'hl-add':()=>{ const lines=$('#hl-text').value.split('\n').map(s=>s.trim()).filter(Boolean); if(!lines.length) return;
    lines.forEach(l=>{ const p=l.split('|').map(s=>s.trim()); state.newsManual.unshift({title:p[0],url:/^https?:\/\//.test(p[1]||'')?p[1]:'',source:p[2]||'Added by hand',published:new Date().toISOString(),symbols:[]}); });
    dirty(); render(true); toast(lines.length+' headline'+(lines.length>1?'s':'')+' added'); },
  'toggle-paste':()=>{ const b=$('#feedpaste'); b.hidden=!b.hidden; },
  'feed-paste-go':()=>{ try{ importFeed(JSON.parse($('#feedtext').value)); ui.mk='prices'; render(); toast('Feed imported'); }catch(e){ toast('Could not read that feed: '+e.message); } },
  'export-sources':()=>saveFile('sources.json',sourcesJSON()),
  'export-backup':()=>saveFile('ballast-backup.json',JSON.stringify(state)),
  'export-backup-enc':()=>encryptedBackup(),
  'export-csv':()=>saveFile('holdings.csv',holdingsCSV()),
  'copy-box':()=>{ const b=$('#copybox'); b.select(); try{ document.execCommand('copy'); toast('Copied'); }catch(e){ toast('Select the text and copy it'); } },
  'src-add':()=>{ const n=$('#s-name').value.trim(),u=$('#s-url').value.trim(),s=$('#s-sel').value.trim(),k=$('#s-kind').value;
    if(!/^https:\/\//.test(u)){ toast('Enter a full address starting with https://'); return; } if(!s){ toast('Add a CSS selector so the script knows what to read'); return; }
    state.src.custom.push({name:n||u.replace(/^https?:\/\//,'').split('/')[0],url:u,kind:k,selector:s}); dirty(); render(true); },
  'src-del':el=>{ state.src.custom.splice(+el.dataset.i,1); dirty(); render(true); },
  'src-save':()=>{ state.src.indices=$('#s-ix').value.split('\n').map(l=>l.split(',').map(s=>s.trim())).filter(p=>p[0]&&p[1]).map(p=>({name:p[0],symbol:p[1]}));
    state.src.queries=$('#s-q').value.split('\n').map(s=>s.trim()).filter(Boolean); state.src.days=Math.max(1,Math.min(30,+$('#s-days').value||7)); dirty(); toast('Saved. Export sources.json again to use it.'); },
  'wl-add':()=>{ const s=$('#wl-sym').value.trim().toUpperCase(); if(!s){ toast('Enter a symbol'); return; } state.watch.push({symbol:s,target:$('#wl-tp').value.trim(),note:$('#wl-note').value.trim()}); dirty(); render(true); },
  'wl-quick':el=>{ const s=el.dataset.sym; if(state.watch.some(w=>w.symbol===s)){ toast(s+' is already on your watchlist'); return; } state.watch.push({symbol:s,target:'',note:el.dataset.note}); dirty(); toast(s+' added to your watchlist'); },
  'wl-del':el=>{ state.watch.splice(+el.dataset.i,1); dirty(); render(true); },
  preset:el=>{ const P={0:{'Equity':-30,'Fixed income':2,'Real assets':5,'Crypto & other':-45,fx:0},1:{'Equity':-12,'Fixed income':-10,'Real assets':-8,'Crypto & other':-20,fx:0},2:{'Equity':0,'Fixed income':0,'Real assets':0,'Crypto & other':0,fx:-10}}; ui.stress=Object.assign({},P[el.dataset.i]); render(true); },
  'paste-go':()=>{ const t=$('#paste').value; if(t.trim()) handlePaste(t); },
  'gen-cancel':()=>{ ui.gen=null; render(true); },
  'gen-go':()=>{ const g=ui.gen; const map={}; $$('[data-g]').forEach(s=>{ map[s.dataset.g]=+s.value; });
    if(map.symbol<0||map.qty<0){ toast('Choose the symbol and quantity columns'); return; }
    const defCcy=($('#g-ccy').value||state.base).toUpperCase(); const d=$('#g-date').value||new Date().toISOString().slice(0,10);
    const list=generatePositions(g,map,defCcy); if(!list.length){ toast('No usable rows found'); return; }
    const old={}; state.positions.forEach(p=>{ old[p.id]=p; });
    state.positions=list.map(r=>buildPosition(r,{},old[r.symbol+'|'+r.ccy])); state.cash=[]; state.asOf=d; state.asOfLabel=fdate(d); state.stmtNav=null; state.accr=0; state.demo=false;
    ui.gen=null; ui.log=[{ok:true,msg:'Imported '+list.length+' positions from '+g.name+'. Add any cash balance in Settings if needed.'}]; dirty(); go('overview'); toast('Imported '+list.length+' positions'); },
  'pos-add':()=>{ const sym=$('#m-sym').value.trim(),qty=num($('#m-qty').value),price=num($('#m-px').value); if(!sym||!fin(qty)||!fin(price)){ toast('Symbol, quantity and price are required'); return; }
    const ccy=($('#m-ccy').value||state.base).toUpperCase(); const cost=num($('#m-cost').value);
    const p=buildPosition({symbol:sym,desc:$('#m-desc').value.trim(),ccy:ccy,qty:qty,price:price,cost:fin(cost)?cost:null,mult:1,asset:'Stocks'},{},null);
    state.positions=state.positions.filter(x=>x.id!==p.id); state.positions.push(p); state.demo=false; dirty(); toast(sym+' added'); render(true); },
  'snap-del':el=>{ state.snaps=state.snaps.filter(s=>(s.from+'|'+s.to)!==el.dataset.k); dirty(); render(true); },
  wipe:()=>openDlg('Delete all data?','<p>This removes your holdings, statement history, watchlist, sources and settings'+(persist.mode==='drive'?' from this browser and from your Drive copy':' from this browser')+'. Save a backup first if you may want them back.</p><div class="row" style="margin-top:16px"><button class="btn danger" data-a="wipe-go">Delete everything</button><button class="btn ghost" data-a="close">Cancel</button></div>'),
  'wipe-go':()=>{ state=blank(); dirty(); closeDlg(); applyTheme(); ui.view='overview'; render(); toast('All data deleted'); },
  'ai-review':()=>aiReview(),
  ...EXTRA_ACTIONS,
  'ai-stop':()=>{ if(ui.ctl) ui.ctl.abort(); },
  'ai-news':()=>aiNews()
};
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-a]'); if(!el) return;
  if(el.tagName==='A') return;
  const f=ACT[el.dataset.a]; if(f){ e.preventDefault(); f(el,e); }
});
document.addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.matches&&e.target.matches('tr[data-a]')){ e.preventDefault(); e.target.click(); } });
document.addEventListener('change',e=>{
  const el=e.target;
  if(el.id==='file'){ handleFiles(el.files); el.value=''; return; }
  if(el.id==='feedfile'){ handleFiles(el.files); el.value=''; return; }
  if(el.dataset.g!==undefined){ ui.gen.map[el.dataset.g]=+el.value; return; }
  const c=el.dataset.c; if(!c) return;
  if(c==='filt'){ ui.filt=el.value; $('#htable').innerHTML=holdingsTable(); }
  else if(c==='live'){ setValueMode(el.checked); }
  else if(c==='contrib'){ ui.contrib=Math.max(0,num(el.value)||0); render(true); }
  else if(c==='profile'){ const k=el.dataset.k; if(k==='cls'){ state.tg.clsProfile=el.value; state.tg.cls=Object.assign({},CLASS_PROFILES[el.value]); } else { state.tg.regionProfile=el.value; state.tg.region=Object.assign({},REGION_PROFILES[el.value]); } dirty(); render(true); }
  else if(c==='tg'){ const kind=el.dataset.k; const t=state.tg[kind==='class'?'cls':'region']; t[el.dataset.key]=Math.max(0,num(el.value)||0); if(kind==='class') state.tg.clsProfile='Custom'; else state.tg.regionProfile='Custom'; dirty(); render(true); }
  else if(c==='set'){ const v=num(el.value); if(fin(v)&&v>0){ state.set[el.dataset.k]=v; dirty(); render(true); } }
  else if(c==='theme'){ state.set.theme=el.value; applyTheme(); dirty(); }
  else if(c==='fx'){ const v=num(el.value); const k=el.dataset.k; if(v>0){ state.fx[k]=v; delete state.fxImplied[k]; delete state.fxSrc[k]; } else { delete state.fx[k]; delete state.fxImplied[k]; delete state.fxSrc[k]; } dirty(); render(true); }
  else if(c==='cmp-sel'){ const s=cmpState(); s.sel[el.dataset.k]=el.checked; render(true); }
  else if(c==='cmp-met'){ const s=cmpState(); s.met[el.dataset.k]=el.checked; render(true); }
  else if(c==='base'){ const b=el.value.trim().toUpperCase(); if(/^[A-Z]{3}$/.test(b)&&b!==state.base){ state.base=b; state.fx={}; state.fxImplied={}; state.fxSrc={}; state.stmtNav=null; state.accr=0; dirty(); render(true); toast('Base currency changed. Set your exchange rates below.'); } }
});
document.addEventListener('input',e=>{
  const el=e.target; if(!el.dataset.i) return;
  if(el.dataset.i==='q'){ ui.q=el.value; $('#htable').innerHTML=holdingsTable(); }
  else if(el.dataset.i==='stress'){ ui.stress[el.dataset.k]=+el.value; const lab=$('#sln-'+slug(el.dataset.k)); if(lab) lab.textContent=spct(+el.value,0); $('#stress-out').innerHTML=stressOut(stressCalc()); }
});
['dragenter','dragover'].forEach(t=>document.addEventListener(t,e=>{ e.preventDefault(); const d=e.target.closest&&e.target.closest('.drop'); if(d) d.classList.add('over'); }));
['dragleave','drop'].forEach(t=>document.addEventListener(t,e=>{ e.preventDefault(); const d=$('.drop'); if(d) d.classList.remove('over'); if(t==='drop'&&e.dataTransfer&&e.dataTransfer.files.length&&e.target.closest&&e.target.closest('.drop')) handleFiles(e.dataTransfer.files); }));

/* ------------------------------------------------------------------ *
 * Start
 * ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ *
 * Boot and public surface for the extra views (views.js)
 * ------------------------------------------------------------------ */
BL.app={S:()=>state,ui:ui,M:M,getLedger:getLedger,getPerf:getPerf,fxRate:fxRate,exposure:exposure,calcBuckets:calcBuckets,esc:esc,money:money,smoney:smoney,pct:pct,spct:spct,cls:cls,px:px,qtyFmt:qtyFmt,nf0:nf0,fdate:fdate,ago:ago,empty:empty,hbars:hbars,strip:strip,diverge:diverge,lineChart:lineChart,catColor:catColor,
  toast:toast,openDlg:openDlg,closeDlg:closeDlg,go:go,render:render,dirty:dirty,saveFile:saveFile,ACT:ACT,VIEW:VIEW,TK:TK,isDeriv:isDeriv,findPos:findPos,aiOn:aiOn,allNews:allNews,matchItem:matchItem,sevOf:sevOf,persist:persist,$:$,$$:$$,slug:slug,MINUS:MINUS,yahooGuess:yahooGuess,
  onboarding:onboarding,warningsNote:staleNote,versionProblems:versionProblems,versionRows:versionRows,RELEASE:RELEASE,FUND_METRICS:FUND_METRICS,fundMetricFmt:fundMetricFmt};
BL.app.boot=async function(){
  try{ if(window.top!==window.self){ document.body.textContent='For your security Ballast will not run inside another page.'; return; } }catch(e){ document.body.textContent='For your security Ballast will not run inside another page.'; return; }
  const stale=versionProblems(); if(stale.length&&!ui.verIgnored){ showGate('version',stale); setBadge(); return; }
  applyTheme(); render(); setBadge();
  if(BL.cloud.configured()&&!CFG.PREVIEW) await cloudGate();
};
window.__ballastTest=CFG.TEST?{state:()=>state,ui:ui,ACT:ACT,render:render,loadDemo:loadDemo,handlePaste:handlePaste,parseIBKR:parseIBKR}:undefined;
})();
