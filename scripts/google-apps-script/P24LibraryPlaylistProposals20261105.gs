// Phase24: 蔵起点プレイリスト候補生成 (READ_ONLY)
// 実行: P24_LIBRARY_PLAYLIST_PROPOSE("polirebi") / P24_LIBRARY_PLAYLIST_PROPOSE_ALL()
// Spotify API/OAuth、プレイリスト・シート書込、トリガー操作は行わない。
const P24_LIBRARY_LEDGER_ID_ = "1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4";
const P24_LIBRARY_RULES_ = [
  {key:"issho-shinbun",type:"series",show:"ニュースの現場から",include:["めくろう"],titleOnly:true},
  {key:"kino-douga",type:"series",show:"MEDIA TALK",include:["動画みた？"],titleOnly:true},
  {key:"no-mirai",type:"series",include:["ノーミライ #","農M、猟L"],titleOnly:true},
  {key:"polirebi",type:"series",show:"ニュースの現場から",include:["ポリレビ"],titleOnly:true},
  {key:"ota-masahiko",type:"speaker",include:["太田匡彦","太田 匡彦"],review:true},
  {key:"toyohide",type:"speaker",include:["豊秀一","豊 秀一"],review:true},
  {key:"sato-yo",type:"speaker",include:["佐藤陽","佐藤 陽"],review:true},
  {key:"south-america",type:"theme",include:["南米","中南米","メキシコ","ブラジル","ベネズエラ","キューバ"],review:true}
];
function P24_LIBRARY_PLAYLIST_PROPOSE(key) {
  const rule = P24_LIBRARY_RULES_.find(function(r){return r.key===key;});
  if (!rule) throw new Error("未知のルール: "+key);
  const ss=SpreadsheetApp.openById(P24_LIBRARY_LEDGER_ID_);
  const sheet=ss.getSheetByName("エピソード台帳");
  if (!sheet) throw new Error("台帳が見つからない");
  const values=sheet.getRange(1,1,sheet.getLastRow(),24).getDisplayValues(); // A:Xのみ
  if (!values.length) throw new Error("空の台帳");
  const headers=values[0].map(function(s){return String(s).trim();});
  function findColumn(terms) {
    return headers.findIndex(function(h){return terms.some(function(t){return h.indexOf(t)>=0;});});
  }
  const titleCol=findColumn(["エピソードタイトル","タイトル","見出し"]);
  const dateCol=findColumn(["公開日時","配信日時","公開日","配信日"]);
  const castCol=findColumn(["出演者","出演","ゲスト"]);
  // 見出しが確認できない場合は推測した列にフォールバックしない。
  if (titleCol<0 || dateCol<0) throw new Error("列見出しを確認できません。title="+titleCol+", date="+dateCol);
  const out=[], holds=[], used=new Set();
  values.slice(1).forEach(function(row,i){
    const id=String(row[0]||"").trim(), show=String(row[1]||"").trim();
    if (!/^EP-\d{5}$/.test(id)) return;
    const title=String(row[titleCol]||""), date=String(row[dateCol]||"");
    const description=String(row[22]||""); // W列清掃本文
    const cast=castCol>=0?String(row[castCol]||""):"";
    const haystack=rule.titleOnly?title:(title+"\n"+cast+"\n"+description);
    if (rule.show && show!==rule.show) return;
    const hits=rule.include.filter(function(term){return haystack.indexOf(term)>=0;});
    if (!hits.length) return;
    const raw=String(row[11]||"").trim(); // L列 Spotify individual episode URL
    const match=raw.match(/^https:\/\/open\.spotify\.com\/episode\/([A-Za-z0-9]{22})(?:[?#].*)?$/);
    const candidate={id:id,show:show,title:title,date:date,spotifyUrl:match?"https://open.spotify.com/episode/"+match[1]:null,
      matchedTerms:hits,source:"ledger",sheetRow:i+2,reviewRequired:!!rule.review};
    if (used.has(id)) {holds.push({id:id,reason:"DUPLICATE_EP_ID"});return;}
    used.add(id);
    if (!match) {holds.push({id:id,reason:raw?"INVALID_SPOTIFY_EPISODE_URL":"SPOTIFY_URL_MISSING"});return;}
    if (!title || !date) {holds.push({id:id,reason:"MISSING_TITLE_OR_DATE"});return;}
    out.push(candidate);
  });
  out.sort(function(a,b){return a.date.localeCompare(b.date)||a.id.localeCompare(b.id);});
  const result={dryRun:true,rule:key,source:"production-ledger-read-only",scanned:values.length-1,
    candidates:out,holds:holds,counts:{ready:out.length,hold:holds.length},warning:
    "候補はSpotify API検証・既存プレイリストの所属確認・実再生チェック未実施。書き込み不可。テーマと出演者は人手確認必須。"};
  Logger.log(JSON.stringify({rule:key,scanned:result.scanned,ready:out.length,hold:holds.length,sample:out.slice(0,10)}));
  return result;
}
function P24_LIBRARY_PLAYLIST_PROPOSE_ALL() {
  return P24_LIBRARY_RULES_.map(function(rule){
    const r=P24_LIBRARY_PLAYLIST_PROPOSE(rule.key);
    return {rule:rule.key,ready:r.counts.ready,hold:r.counts.hold,reviewRequired:!!rule.review};
  });
}
function P24_LIBRARY_PLAYLIST_SELF_TEST() {
  const sample="https://open.spotify.com/episode/0123456789ABCDEFGHIJKL";
  if (!/^https:\/\/open\.spotify\.com\/episode\/[A-Za-z0-9]{22}$/.test(sample)) throw new Error("URL検証失敗");
  if (P24_LIBRARY_RULES_.length!==8) throw new Error("ルール件数");
  return {ok:true,checks:2};
}
