#!/usr/bin/env node
// 旧GAS方式(固定ルールの照合関数 matchesAutoPlaylistRule_ ほか)と新エンジンの READ_ONLY 差分比較。Spotify/GAS/本番に接続しない。
// 旧コードは scripts/google-apps-script を vm に読み込んで「関数をそのまま」実行する(再実装による食い違いを避ける)。
// 入力: プレビュー詳細JSON群ディレクトリ(RSS由来の台帳行: title/description)。SpotifyのAPI応答そのものではない=照合ロジックの比較。
// 使い方: node scripts/compare-playlist-legacy.mjs DETAILS_DIR [OUT.json] [CONFIG_CSV_OUT]
import vm from 'node:vm';import fs from 'node:fs';import path from 'node:path';
import {parseConfig,CONFIG_HEADERS} from '../public/library/playlist-config.mjs';
import {matchEpisode} from '../public/library/playlist-engine.mjs';
const D=new URL('./google-apps-script/',import.meta.url).pathname;
const [,, detailsDir,outPath,csvOut]=process.argv;
const ctx=vm.createContext({console,Logger:{log(){}}});
for(const n of fs.readdirSync(D).filter(f=>/^(PlaylistAuto.*|AutoUpdateAutomationV1)\.js$/.test(f)&&!/Tests\.js$/.test(f)))vm.runInContext(fs.readFileSync(D+n,'utf8')+'\n',ctx,{filename:n});
const legacy=vm.runInContext('AUTO_PLAYLIST_RULES.map(r=>JSON.parse(JSON.stringify(r)))',ctx);
const primary=vm.runInContext('ASAHI_PRIMARY_SHOW_IDS.slice()',ctx);
const special=fs.readFileSync(D+'PlaylistSpecial.js','utf8');
const legacyTriggerFns=[...special.matchAll(/function (\w+)\(\)\s*\{\s*syncAutoPlaylistByPlaylistId_\("(\w+)"\)/g)].map(m=>({fn:m[1],playlistId:m[2]}));
// 旧→設定表行(移行表の自動生成)。旧は「承認/段階」をコード定数で持つ: lifecycleStatus incremental+productionWriteAllowed → approved/incremental。
const showsCell=r=>JSON.stringify([...r.showIds||[r.showId]].sort())===JSON.stringify([...primary].sort())?'PRIMARY':(r.showIds||[r.showId]).join(',');
const toRow=r=>[r.key,r.enabled!==false?'TRUE':'FALSE',r.playlistId,r.name,vm.runInContext(`getAutoPlaylistRuleType_(${JSON.stringify(r)})`,ctx),showsCell(r),(r.keywords||[r.keyword]).filter(Boolean).join(','),(r.excludeKeywords||[]).join(','),
  (r.fields||['name']).includes('description')?'name+description':'name',r.matchMode||'any',r.matchStrategy||'',r.lifecycleStatus==='audit'?'review':(r.productionWriteAllowed===false?'review':'approved'),r.lifecycleStatus==='audit'?'bootstrap':'incremental','DRY_RUN','legacy',10,r.reviewRequired?'TRUE':'FALSE'];
const rows=legacy.map(toRow);
const strategies={'no-mirai-title-prefix':e=>ctx.extractNoMiraiEpisodeNumber_(e.name)!==null,'ota-safe-confirmed':e=>ctx.classifyOtaMasahikoExistingPlaylistAuditEpisodeV2_(e)?.classification==='confirmed','sato-yo-safe-confirmed':e=>ctx.isSpeakerGuardrailConfirmed_(ctx.classifySatoYoAutoPlaylistEpisode_(e))};
const {rules,errors}=parseConfig(rows,{strategies,primaryShowIds:primary});
const det=[];for(const f of fs.readdirSync(detailsDir))det.push(...JSON.parse(fs.readFileSync(path.join(detailsDir,f))));
const eps=det.map(e=>({id:e.id,uri:'spotify:episode:'+e.id,name:e.title||'',description:e.description||'',html_description:e.description||''}));
const per=[];
for(const lr of legacy){
  const nr=rules.find(r=>r.key===lr.key&&r.playlistId===lr.playlistId);
  const lm=new Set(eps.filter(e=>ctx.matchesAutoPlaylistRule_(e,lr)).map(e=>e.id)),nm=new Set(nr?eps.filter(e=>matchEpisode(e,nr,strategies)).map(e=>e.id):[]);
  const onlyLegacy=[...lm].filter(x=>!nm.has(x)),onlyNew=[...nm].filter(x=>!lm.has(x));
  per.push({key:lr.key,legacyEnabled:lr.enabled!==false,legacyMatches:lm.size,newMatches:nm.size,onlyLegacy:onlyLegacy.length,onlyNew:onlyNew.length,identical:!onlyLegacy.length&&!onlyNew.length,
    showScopeSame:JSON.stringify([...(lr.showIds||[lr.showId])].sort())===JSON.stringify([...(nr?.showIds||[])].sort()),configBlocked:nr?.blocked||['NO_NEW_RULE'],strategy:lr.matchStrategy||null});
}
const out={kind:'READ_ONLY_LOGIC_COMPARISON',note:'RSS由来の台帳行(title/description)を入力に、旧GASの照合関数と新エンジンの判定を比較。SpotifyのAPI応答・実プレイリスト内容は未使用=実環境の一致ではない。',
  episodes:eps.length,legacyRules:legacy.length,configRowsGenerated:rows.length,configErrors:errors,allIdentical:per.every(p=>p.identical&&p.showScopeSame),perRule:per,
  legacyTriggerFunctions:legacyTriggerFns.map(t=>({...t,ruleKey:legacy.find(r=>r.playlistId===t.playlistId)?.key||null,coveredByDailyManaged:vm.runInContext(`AUTO_UPDATE_V1_MANAGED_FIXED_RULE_KEYS_`,ctx)?.includes?.(legacy.find(r=>r.playlistId===t.playlistId)?.key)||false}))};
console.log(JSON.stringify(out,null,1));if(outPath)fs.writeFileSync(outPath,JSON.stringify(out,null,1));
if(csvOut)fs.writeFileSync(csvOut,[CONFIG_HEADERS,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')+'\n');
