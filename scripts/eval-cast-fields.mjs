#!/usr/bin/env node
// 出演者候補の項目単位評価(READ_ONLY・外部通信なし)。入力は原本由来CSV(非コミット)。出力は件数のみ(氏名は出さない)。
// 台帳側は注記(★/※/文)・所属語・重複が混入しているため正規化して比較する。役割(音源編集)の台帳記載方針差は「方針差」として別集計。
// 使い方: node scripts/eval-cast-fields.mjs LEDGER.csv [OUT.json]
import fs from 'node:fs';
import {parseCsv,expandCompact} from './build-universe-preview.mjs';
import {extractCast} from '../public/library/gap-audit.mjs';
const [,, csv, outPath]=process.argv;
const nm=v=>String(v||'').split(/[（(]/)[0].replace(/\s+/g,'').replace(/^(?:音源編集|MC|ママ|常連客)[・]?/,'').replace(/さん$|氏$/,'');
const ORG=/(?:部|本部|局|支局|総局|センター|編集長|委員|科学記者|報道|社|大阪本社)$/;
const noise=s=>/^[★※]|。|掲載|ください|お願い|お寄せ|募集/.test(s)||ORG.test(s);
const ledgerSet=r=>[...new Set([45,46,47,48,49].flatMap(c=>String(r[c]||'').split(/[\/、,]/)).map(nm).filter(x=>x&&!noise(x)))];
const rows=parseCsv(fs.readFileSync(csv,'utf8')).slice(1).map(expandCompact);
const T={rowsWithLedgerCast:0,exactSet:0,cast1Match:0,tp:0,fp:0,fn:0,fpAllStaffRole:0,fpOther:0,rowsReview:0,rowsClean:0,cleanExact:0,cleanFp:0,cleanTp:0,noBlockButLedgerHasCast:0};
const fails={};
for(const r of rows){const led=ledgerSet(r);if(!led.length)continue;T.rowsWithLedgerCast++;
  const x=extractCast(r[21]);const d=x.people.map(p=>({n:nm(p.name),role:p.role}));
  if(!x.found){T.noBlockButLedgerHasCast++;fails.NO_CAST_BLOCK=(fails.NO_CAST_BLOCK||0)+1;continue;}
  const ds=new Set(d.map(p=>p.n)),ls=new Set(led);
  const tp=[...ds].filter(n=>ls.has(n)).length,fpL=d.filter(p=>!ls.has(p.n)),fn=[...ls].filter(n=>!ds.has(n)).length;
  T.tp+=tp;T.fn+=fn;T.fp+=fpL.length;T.fpAllStaffRole+=fpL.filter(p=>p.role==='音源編集').length;T.fpOther+=fpL.filter(p=>p.role!=='音源編集').length;
  if(d[0]?.n===led[0])T.cast1Match++;if(!fpL.length&&!fn)T.exactSet++;
  const clean=x.confidence==='clean';if(clean){T.rowsClean++;T.cleanTp+=tp;T.cleanFp+=fpL.length;if(!fpL.length&&!fn)T.cleanExact++;}else T.rowsReview++;
  if(fn)fails.MISSED_LEDGER_NAME=(fails.MISSED_LEDGER_NAME||0)+1;if(fpL.some(p=>p.role!=='音源編集'))fails.EXTRA_NAME_NOT_IN_LEDGER=(fails.EXTRA_NAME_NOT_IN_LEDGER||0)+1;if(fpL.some(p=>p.role==='音源編集'))fails.STAFF_ROLE_POLICY_DIFF=(fails.STAFF_ROLE_POLICY_DIFF||0)+1;}
const pct=(a,b)=>b?+(100*a/b).toFixed(1):null;
const out={...T,fieldPrecision:pct(T.tp,T.tp+T.fp),fieldRecall:pct(T.tp,T.tp+T.fn),exactSetRate:pct(T.exactSet,T.rowsWithLedgerCast),cast1Rate:pct(T.cast1Match,T.rowsWithLedgerCast),
  cleanTierFieldPrecision:pct(T.cleanTp,T.cleanTp+T.cleanFp),cleanTierExactRate:pct(T.cleanExact,T.rowsClean),fails,
  note:'台帳側を正規化(注記/所属語/重複除去)して比較。台帳自体が真値とは限らない(音源編集の記載方針が一定でない)。自動書込みはしない(suggest-only)。'};
console.log(JSON.stringify(out,null,1));if(outPath)fs.writeFileSync(outPath,JSON.stringify(out,null,1));
