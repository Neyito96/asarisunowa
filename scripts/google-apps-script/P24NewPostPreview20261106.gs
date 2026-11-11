// Phase24: 新着投稿に備える蔵起点の増分検査 (READ_ONLY).
// 既存の毎朝GASトリガー/Spotifyプレイリストは変更しない。
// First pilot: P24_PREVIEW_NEW_POLIREBI() — manual invocation only.
const P24_NEW_POST_RULES_ = [
  {key:"polirebi",playlistId:"6hNrobOVHmYaQT5C7hPkNa",reviewRequired:false}
];
function P24_BUILD_NEW_POST_PLAN_(proposals, items, options) {
  const opts=options||{};
  if (!proposals || !Array.isArray(proposals.candidates) || !Array.isArray(items))
    throw new Error("新着検査の入力が不正");
  if (typeof P24_POLIREBI_COMPARE_!=="function")
    throw new Error("既存の比較器が未配備");
  const comparison=P24_POLIREBI_COMPARE_(proposals,items);
  const cutoff=String(opts.sinceDate||"").trim();
  if (cutoff && !/^\d{4}-\d{2}-\d{2}$/.test(cutoff))
    throw new Error("sinceDateはYYYY-MM-DD形式");
  function dateKey(raw) {
    const m=String(raw||"").match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    return m?m[1]+"-"+m[2].padStart(2,"0")+"-"+m[3].padStart(2,"0"):"";
  }
  const recent=comparison.missing.filter(function(ep){return !cutoff||dateKey(ep.date)>=cutoff;});
  const older=comparison.missing.filter(function(ep){return cutoff&&dateKey(ep.date)<cutoff;});
  const sourceNewest=proposals.candidates.map(function(ep){return dateKey(ep.date);}).filter(Boolean).sort().pop()||"";
  const blocked=comparison.counts.uncertain>0 || comparison.counts.held>0;
  return {
    dryRun:true,mode:"P24_NEW_POST_PREVIEW",source:"production-ledger",
    counts:{libraryCandidates:comparison.counts.ledgerCandidates,
      playlistItems:comparison.counts.playlistItems,
      alreadyInPlaylist:comparison.counts.present,
      newCandidates:recent.length,olderBacklog:older.length,
      held:comparison.counts.held,uncertain:comparison.counts.uncertain,
      playlistOnly:comparison.counts.playlistOnly},
    libraryNewestDate:sourceNewest,
    recentCandidates:recent,olderCandidates:older,
    playlistOnly:comparison.playlistOnly,
    reviewRequired:blocked || older.length>0,
    safeForAutomaticWrite:false,
    notes:[
      "差分0は『新着が無い』の証明ではない。蔵への新着収蔵遅延、タイトル表記揺れ、RSS欠落を別途監視する。",
      "新着候補は必ず公式同定・人間除外・以前の手動削除を確認する。",
      "Spotify追加・台帳更新・トリガー変更は一切しない。"
    ]
  };
}
function P24_PREVIEW_NEW_POLIREBI() {
  const rule=P24_NEW_POST_RULES_[0];
  const proposals=P24_LIBRARY_PLAYLIST_PROPOSE(rule.key);
  const token=getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotify OAuthを確認できません。更新は行わない。");
  const items=P24_FETCH_SPOTIFY_PLAYLIST_ITEMS_READ_ONLY_(rule.playlistId,token);
  // 直近2週間分の候補を監視対象にするが、古い差分を黙って切り捨てない。
  const today=Utilities.formatDate(new Date(),Session.getScriptTimeZone()||"Asia/Tokyo","yyyy-MM-dd");
  const cutoff=Utilities.formatDate(new Date(Date.now()-14*86400000),
    Session.getScriptTimeZone()||"Asia/Tokyo","yyyy-MM-dd");
  const result=P24_BUILD_NEW_POST_PLAN_(proposals,items,{sinceDate:cutoff});
  Logger.log(JSON.stringify({date:today,cutoff:cutoff,counts:result.counts,
    newestInLibrary:result.libraryNewestDate,recent:result.recentCandidates,
    backlog:result.olderCandidates,playlistOnly:result.playlistOnly,
    reviewRequired:result.reviewRequired}));
  return result;
}
function P24_NEW_POST_SELF_TEST() {
  const one="ABCDEFGHIJKLMNOPQRSTUV",two="abcdefghijklmnopqrstuv",three="1234567890123456789012";
  const p={candidates:[
    {id:"EP-00001",title:"旧",date:"2026/10/01 04:00",spotifyUrl:"https://open.spotify.com/episode/"+one},
    {id:"EP-00002",title:"新",date:"2026/11/05 04:00",spotifyUrl:"https://open.spotify.com/episode/"+two}]};
  const items=[{item:{type:"episode",id:one,uri:"spotify:episode:"+one}},
    {item:{type:"episode",id:three,uri:"spotify:episode:"+three,name:"#15"}}];
  const x=P24_BUILD_NEW_POST_PLAN_(p,items,{sinceDate:"2026-11-01"});
  if (x.counts.newCandidates!==1||x.counts.alreadyInPlaylist!==1||
      x.counts.playlistOnly!==1||x.safeForAutomaticWrite!==false||
      x.libraryNewestDate!=="2026-11-05") throw new Error("NEW_POST_PREVIEW_TEST_FAIL");
  const noChange=P24_BUILD_NEW_POST_PLAN_(p,items.concat([{item:{type:"episode",id:two,uri:"spotify:episode:"+two}}]),{sinceDate:"2026-11-01"});
  if (noChange.counts.newCandidates!==0) throw new Error("NO_CHANGE_TEST_FAIL");
  return {ok:true,tests:["new-post-delta","no-change","playlist-only-preserved","no-write"]};
}
