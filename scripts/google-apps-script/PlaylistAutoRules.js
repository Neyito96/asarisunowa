// プレイリスト自動更新ルール定義・判定
const ASAHI_PRIMARY_SHOW_IDS = [
  "7euH6hzudIdp61JRSi9E8w", "0341I5UOUrJgm7KEvNGInZ", "0yhef9ORZkUZs9ZeotdCSY",
  "392h0MYfvMTndEVzf2cOvC", "5Dt1uyQaJpM6hPV8aEMP3R", "1KExdSsjQnatS4TdseGoC0", "2uG9W6CnsaNi87AfSuGe8r"
];
const AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_ = "title-text";
const AUTO_PLAYLIST_RULE_TYPE_SPEAKER_ = "speaker";
const AUTO_PLAYLIST_RULE_TYPE_THEME_ = "theme";

const AUTO_PLAYLIST_RULES = [
  { key:"issho-shinbun", enabled:true, ruleType:AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_, name:"一緒に新聞をめくろう！", showIds:ASAHI_PRIMARY_SHOW_IDS, playlistId:"4tY0lHoV8IemMBp4iTnKnl", keyword:"めくろう" },
  { key:"kino-douga", enabled:true, ruleType:AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_, name:"木下君、あの動画みた？ #きのどう", showIds:ASAHI_PRIMARY_SHOW_IDS, playlistId:"6nDhZQG75F1wU62sdcYJMq", keyword:"動画みた？" },
  {
    key:"toyohide", enabled:true, ruleType:AUTO_PLAYLIST_RULE_TYPE_SPEAKER_, name:"豊秀一",
    showIds:ASAHI_PRIMARY_SHOW_IDS, playlistId:"4Ri6rxTGFimTm0KkZtKfBZ",
    keywords:["豊秀一", "豊 秀一"], fields:["name","description","html_description"],
    // まだ本番matchesAutoPlaylistRule_には接続しない。dry-runで検証後に切り替える。
    proposedMatchStrategy:"speaker-safe-v2",
    fetchAllPages:true, continueOnShowFetchError:true, addIndividually:true, updateLatestDateOnAdd:true
  },
  {
    key:"ota-masahiko", enabled:true, ruleType:AUTO_PLAYLIST_RULE_TYPE_SPEAKER_, name:"太田匡彦",
    showIds:ASAHI_PRIMARY_SHOW_IDS, playlistId:"7jLXrZ0JUNOnsSeFEFbw9S",
    keywords:["太田匡彦", "太田 匡彦"], fields:["name","description","html_description"],
    matchStrategy:"ota-safe-confirmed",
    proposedMatchStrategy:"speaker-safe-v2",
    // 旧V2で実績のある朝ポキ1億DLイベント告知除外を共通V2でも再現する。
    useAsahiOneHundredMillionDownloadAnnouncement:true,
    fetchAllPages:true, continueOnShowFetchError:true, addIndividually:true, updateLatestDateOnAdd:true
  }
];

function getEnabledAutoPlaylistRules_(){ return AUTO_PLAYLIST_RULES.filter(function(rule){ return rule && rule.enabled !== false; }); }
function getAutoPlaylistRuleByKey_(key){ const wantedKey=String(key||"").trim(); return AUTO_PLAYLIST_RULES.find(function(rule){ return String(rule&&rule.key?rule.key:"")===wantedKey; })||null; }
function getAutoPlaylistRuleType_(rule){
  const explicitType=String(rule&&rule.ruleType?rule.ruleType:"").trim(); if(explicitType)return explicitType;
  const fields=Array.isArray(rule&&rule.fields)?rule.fields:[];
  if(String(rule&&rule.matchStrategy?rule.matchStrategy:"")||fields.indexOf("description")>=0||fields.indexOf("html_description")>=0)return AUTO_PLAYLIST_RULE_TYPE_SPEAKER_;
  return AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_;
}
function getAutoPlaylistShowIds_(rule){
  if(Array.isArray(rule.showIds)&&rule.showIds.length)return rule.showIds.map(function(showId){return String(showId||"").trim();}).filter(Boolean);
  const showId=String(rule.showId||"").trim(); return showId?[showId]:[];
}
function getAutoPlaylistEpisodeText_(episode,rule){
  const ruleType=getAutoPlaylistRuleType_(rule);
  const fields=ruleType===AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_?["name"]:Array.isArray(rule.fields)&&rule.fields.length?rule.fields:["name","description","html_description"];
  return fields.map(function(field){return String(episode&&episode[field]!=null?episode[field]:"");}).join("\n");
}
function matchesAutoPlaylistRule_(episode,rule){
  const strategy=String(rule&&rule.matchStrategy?rule.matchStrategy:"");
  if(strategy==="ota-safe-confirmed"){
    const classification=classifyOtaMasahikoExistingPlaylistAuditEpisodeV2_(episode);
    return classification&&classification.classification==="confirmed";
  }
  // speaker-safe-v2 は回帰テスト完了後に matchStrategy を切り替えるだけで利用可能。
  if(strategy==="speaker-safe-v2"){
    const classification=classifySpeakerSafeV2_(episode,rule);
    return classification&&classification.classification==="confirmed";
  }
  const text=getAutoPlaylistEpisodeText_(episode,rule);
  const includeKeywords=Array.isArray(rule.keywords)&&rule.keywords.length?rule.keywords:rule.keyword?[rule.keyword]:[];
  const excludeKeywords=Array.isArray(rule.excludeKeywords)?rule.excludeKeywords:[];
  if(excludeKeywords.some(function(keyword){return text.indexOf(String(keyword))>=0;}))return false;
  if(!includeKeywords.length)return true;
  const mode=String(rule.matchMode||"any").toLowerCase();
  return mode==="all"?includeKeywords.every(function(keyword){return text.indexOf(String(keyword))>=0;}):includeKeywords.some(function(keyword){return text.indexOf(String(keyword))>=0;});
}
