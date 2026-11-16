// V2 ingestion preflight. READ ONLY: no Sheets, Spotify or GAS writes.
// Usage: node scripts/ledger-v2/preflight-ingest.mjs --existing v2.json --incoming new.json
// Both inputs: {"values":[["EP-ID","番組名","公式GUID","公式個別URL",...], [...]]}
// No positional column assumptions: resolve by header. Fail closed on ambiguity.
import fs from 'node:fs';

const args = process.argv.slice(2);
const valueOf = key => { const i = args.indexOf('--'+key); return i >= 0 ? args[i+1] : undefined; };
const REQUIRED = {
  id: ['EP-ID'],
  show: ['番組名','番組'],
  guid: ['公式GUID','GUID'],
  url: ['公式個別URL','公式エピソードURL','公式URL'],
  title: ['タイトル','エピソードタイトル','回タイトル'],
};
const norm = x => String(x ?? '').trim();
const urlKey = x => {
  try { const u = new URL(norm(x)); if(!/^https?:$/.test(u.protocol)) return ''; u.hash=''; for(const k of [...u.searchParams.keys()]) if(/^utm_|^iref$|^si$/.test(k)) u.searchParams.delete(k); return u.toString().replace(/\/$/,''); }
  catch { return ''; }
};
function parse(file, kind) {
  const input = JSON.parse(fs.readFileSync(file,'utf8'));
  if (!Array.isArray(input.values) || !Array.isArray(input.values[0])) throw Error(kind+': expected values matrix');
  const [header,...rows] = input.values;
  const cols = {};
  for(const [key,names] of Object.entries(REQUIRED)) {
    const matches = header.map((h,i) => names.includes(norm(h)) ? i : -1).filter(i=>i>=0);
    if(matches.length!==1) throw Error(kind+': missing/ambiguous header '+key+' ('+matches.length+')');
    cols[key] = matches[0];
  }
  return rows.filter(r=>r.some(x=>norm(x))).map((r,i)=>({
    id:norm(r[cols.id]), show:norm(r[cols.show]), guid:norm(r[cols.guid]),
    url:urlKey(r[cols.url]), title:norm(r[cols.title]), sourceRow:i+2
  }));
}
export function audit(existing, incoming) {
  const byId=new Map(), byGuid=new Map(), byUrl=new Map(), byTitle=new Map();
  const RERUN=/[（(【\[]\s*再(放送|配信)?\s*[）)】\]]|再配信|再放送/;
  const keyTitle=r=>r.show.toLowerCase()+'\u0000'+r.title.normalize('NFKC').replace(RERUN,'').replace(/\s+/g,'').toLowerCase();
  for(const r of existing) {
    if(!r.id || !r.show) throw Error('EXISTING_MISSING_ID_OR_SHOW at row '+r.sourceRow);
    if(byId.has(r.id)) throw Error('EXISTING_DUPLICATE_EP_ID '+r.id);
    byId.set(r.id,r);
    if(r.guid) { const k=r.guid.toLowerCase(); if(!byGuid.has(k)) byGuid.set(k,r); }
    if(r.url&&!byUrl.has(r.url)) byUrl.set(r.url,r);
    if(r.title&&!byTitle.has(keyTitle(r))) byTitle.set(keyTitle(r),r);
  }
  const outcomes=[], seenIds=new Set(), seenGuid=new Set(), seenUrl=new Set();
  for(const r of incoming) {
    const reasons=[];
    if(!r.id||!r.show||!r.title||(!r.guid&&!r.url)) reasons.push('MISSING_REQUIRED_IDENTIFIER');
    if(r.id && (byId.has(r.id)||seenIds.has(r.id))) reasons.push('EP_ID_EXISTS_OR_REPEATED');
    const g=r.guid?r.guid.toLowerCase():'';
    if(g&&(byGuid.has(g)||seenGuid.has(g))) reasons.push('GUID_EXISTS_OR_REPEATED');
    if(r.url&&(byUrl.has(r.url)||seenUrl.has(r.url))) reasons.push('OFFICIAL_URL_EXISTS_OR_REPEATED');
    if(r.title&&byTitle.has(keyTitle(r))) reasons.push('SAME_SHOW_TITLE_REVIEW');
    if(r.title&&RERUN.test(r.title.normalize('NFKC'))) reasons.push('RERUN_MARK_REVIEW');
    // A clean ID alone does not authorize publishing or Spotify additions.
    const decision=reasons.some(x=>!/_REVIEW$/.test(x))?'BLOCK':reasons.length?'HOLD':'CANDIDATE_UNREVIEWED';
    outcomes.push({epId:r.id,sourceRow:r.sourceRow,decision,reasons});
    if(r.id)seenIds.add(r.id);
    if(g)seenGuid.add(g);
    if(r.url)seenUrl.add(r.url);
  }
  const counts=Object.fromEntries(['BLOCK','HOLD','CANDIDATE_UNREVIEWED'].map(k=>[k,outcomes.filter(o=>o.decision===k).length]));
  return {mode:'READ_ONLY_NO_WRITES',existing:existing.length,incoming:incoming.length,counts,outcomes};
}
if (process.argv[1] && import.meta.url === new URL('file://'+process.argv[1]).href) {
  const old=valueOf('existing'), now=valueOf('incoming');
  if(!old||!now) { console.error('Usage: --existing v2.json --incoming new.json');process.exitCode=2; }
  else {
    try { const report=audit(parse(old,'existing'),parse(now,'incoming'));console.log(JSON.stringify(report,null,2)); if(report.counts.BLOCK||report.counts.HOLD) process.exitCode=3; }
    catch(e){console.error('PREFLIGHT_STOP:',e.message);process.exitCode=2;}
  }
}
