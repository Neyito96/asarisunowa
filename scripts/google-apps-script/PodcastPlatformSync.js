// 推薦2棚専用。既定READ_ONLY。EP収蔵・補填には使用しない。
const RECOMMENDATION_SCHEMAS = {
  posusume: {name: "朝リスPodcast", width: 17, maker: 3,
    columns: {spotify:6, apple:7, listen:8, standfm:9, amazon:10, youtube:11,
      website:12, artwork:13, rss:14, pocketcasts:15, pody:16, genre:17}},
  risuoshi: {name: "おすすめPodcast", width:18, maker:7,
    columns: {artwork:6, rss:8, youtube:9, spotify:10, amazon:11, apple:12,
      pocketcasts:13, listen:14, standfm:15, pody:16, website:17, genre:18}}
};
const RECOMMENDATION_LEGACY_HANDLERS = ["RISU_applyAllPlatforms", "RISU_applyAppleEnrichment",
  "syncAllPodcastPlatforms", "syncListenerPodcastPlatforms", "syncRecommendedPodcastPlatforms"];
let recommendationBudget_ = null;

function syncListenerPodcastPlatforms() { return runRecommendationSync_(["posusume"]); }
function syncRecommendedPodcastPlatforms() { return runRecommendationSync_(["risuoshi"]); }
function syncAllPodcastPlatforms() { return runRecommendationPodcastDailySync(); }
function runRecommendationPodcastDailySync() { return runRecommendationSync_(["posusume", "risuoshi"]); }

// 読取専用の棚卸し。別所有者・別プロジェクトのトリガーは列挙できない。
function auditRecommendationPodcastTriggers() {
  return {timeZone: Session.getScriptTimeZone(),
    handlers: ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction()),
    limitation: "CURRENT_USER_CURRENT_PROJECT_ONLY"};
}
function assertRecommendationTriggers_() {
  const handlers = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  if (handlers.some(h => RECOMMENDATION_LEGACY_HANDLERS.indexOf(h) >= 0) ||
      handlers.filter(h => h === "runRecommendationPodcastDailySync").length > 1)
    throw new Error("STOP_TRIGGER_CONFLICT");
}
function installRecommendationPodcastDailySync() {
  // 指令がHOLDの間はプロパティだけでインストールを解禁しない。
  throw new Error("HOLD: 司令塔承認・全所有者の旧writer監査後に別途導入");
}
function validateRecommendationSheet_(sheet, schema, props) {
  if (!sheet || sheet.getName() !== schema.name || sheet.getLastColumn() !== schema.width)
    throw new Error("STOP_SHEET_SCHEMA");
  // 本番実読みで承認した全ヘッダーの配列を登録。推測や自動修復は禁止。
  const expected = JSON.parse(props.getProperty("RECOMMENDATION_HEADERS_" + schema.name) || "null");
  const actual = sheet.getRange(1, 1, 1, schema.width).getDisplayValues()[0];
  if (!Array.isArray(expected) || expected.length !== schema.width ||
      JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error("STOP_HEADER_MISMATCH");
}
function runRecommendationSync_(shelves) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return {status:"BUSY"};
  const props = PropertiesService.getScriptProperties();
  const output = {mode:"READ_ONLY", shelves:{}, errors:[]};
  recommendationBudget_ = {deadline:Date.now() + 180000, http:0, maxHttp:40, cache:{}};
  try {
    assertRecommendationTriggers_();
    // 書込許可に加え、別所有者/別プロジェクトを含む監査完了が必須。
    const write = props.getProperty("RECOMMENDATION_WRITE_APPROVED") === "true" &&
      props.getProperty("RECOMMENDATION_WRITER_AUDIT_APPROVED") === "true";
    output.mode = write ? "WRITE" : "READ_ONLY";
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    shelves.forEach(function(key) {
      try {
        const schema = RECOMMENDATION_SCHEMAS[key];
        const sheet = ss.getSheetByName(schema.name);
        validateRecommendationSheet_(sheet, schema, props);
        const stats = {checked:0, updatedCells:0, deferred:0};
        output.shelves[key] = stats;
        const stateKey = "RECOMMENDATION_STATE_" + key;
        const state = JSON.parse(props.getProperty(stateKey) || "{}");
        const last = sheet.getLastRow();
        let cursor = Math.max(2, Math.min(Number(state.cursor) || 2, Math.max(2,last)));
        // 棚ごとの予算を分離し、一方の失敗/大規模棚で他方を飢餓状態にしない。
        const shelfDeadline = Math.min(recommendationBudget_.deadline, Date.now() + 80000);
        const startHttp = recommendationBudget_.http;
        recommendationBudget_.shelfDeadline = shelfDeadline;
        recommendationBudget_.shelfMaxHttp = startHttp + 18;
        for (; cursor <= last; cursor++) {
          if (Date.now() >= shelfDeadline || recommendationBudget_.http - startHttp >= 18) break;
          const row = sheet.getRange(cursor,1,1,schema.width).getDisplayValues()[0];
          const signature = recommendationRowSignature_(row);
          const retryKey = stateKey + "_ROW_" + cursor;
          const retry = JSON.parse(props.getProperty(retryKey) || "null");
          if (retry && retry.row === cursor && retry.signature === signature && Date.now() < retry.nextRetryAt) {
            stats.deferred++; continue;
          }
          if (!String(row[1] || "").trim()) continue;
          stats.checked++;
          try {
            const resolved = resolveListenerPodcastPlatforms_(row[1], row[schema.maker-1], row[0], row[schema.columns.rss-1]);
            Object.keys(schema.columns).sort((a,b) => (a === "rss") - (b === "rss")).forEach(function(service) {
              const column = schema.columns[service];
              if (String(row[column-1] || "").trim()) {
                resolved.reasons[service] = "EXISTING_PRESERVED"; return;
              }
              if (!resolved[service]) return;
              if (write && Date.now() < shelfDeadline) {
                if (writeRecommendationCell_(sheet, cursor, column, resolved[service], row, schema)) {
                  stats.updatedCells++; resolved.reasons[service] = "WRITTEN_VERIFIED";
                } else resolved.reasons[service] = "REVIEW_CELL_CHANGED_FORMULA_OR_PROTECTED";
              }
            });
            const attempt = retry && retry.row === cursor && retry.signature === signature ? retry.attempt + 1 : 1;
            const nextRetryAt = Date.now() + Math.min(7*86400000, 3600000*Math.pow(2,Math.min(attempt,7)));
            console.log("RECOMMENDATION_ROW " + JSON.stringify({shelf:key,row:cursor,mode:output.mode,
              reasons:resolved.reasons,rawGenre:resolved.rawGenre,attempt,nextRetryAt}));
            // 1行ごとにcheckpoint。全行の履歴は実行ログ、永続状態は有界サイズ。
            if (write) props.setProperty(retryKey, JSON.stringify({row:cursor,signature:recommendationRowSignature_(sheet.getRange(cursor,1,1,schema.width).getDisplayValues()[0]),attempt,nextRetryAt,reasons:resolved.reasons}));
          } catch (error) {
            console.log("RECOMMENDATION_ROW " + JSON.stringify({shelf:key,row:cursor,reason:recommendationError_(error),nextRetryAt:Date.now()+3600000}));
            if (write) props.setProperty(retryKey, JSON.stringify({row:cursor,signature,attempt:(retry ? retry.attempt : 0)+1,nextRetryAt:Date.now()+3600000,reason:recommendationError_(error)}));
          }
          state.cursor = cursor + 1 > last ? 2 : cursor + 1;
          if (write) props.setProperty(stateKey, JSON.stringify(state));
        }
        stats.cursor = cursor > last ? 2 : cursor;
        if (write) props.setProperty(stateKey, JSON.stringify({cursor:stats.cursor}));
      } catch (error) { output.errors.push({shelf:key,reason:recommendationError_(error)}); }
    });
    console.log("RECOMMENDATION_SYNC " + JSON.stringify(output));
    return output;
  } finally { recommendationBudget_ = null; lock.releaseLock(); }
}
function recommendationRowSignature_(row) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(row),Utilities.Charset.UTF_8));
}
function recommendationError_(error) {
  const code = String(error && error.message || "");
  return /^(STOP_|HTTP_|BUDGET|UNSAFE_URL|OVERSIZE|REDIRECT)/.test(code) ? code.split(":")[0] : "FETCH_OR_ROW_FAILED";
}
function writeRecommendationCell_(sheet, row, column, value, original, schema) {
  // ヘッダー、番組識別セル、値、数式、保護範囲を直前に再確認。
  validateRecommendationSheet_(sheet,schema,PropertiesService.getScriptProperties());
  const fresh = sheet.getRange(row,1,1,schema.width).getDisplayValues()[0];
  if ([0,1,schema.maker-1,schema.columns.rss-1].some(i => fresh[i] !== original[i])) return false;
  const cell = sheet.getRange(row,column);
  if (cell.getValue() !== "" || cell.getFormula()) return false;
  const rangeType = SpreadsheetApp.ProtectionType.RANGE;
  if (sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).length ||
      sheet.getProtections(rangeType).some(p => {
        const r=p.getRange(); return row>=r.getRow() && row<=r.getLastRow() && column>=r.getColumn() && column<=r.getLastColumn();
      })) return false;
  cell.setValue(value);
  SpreadsheetApp.flush();
  if (String(cell.getValue()) !== String(value)) throw new Error("STOP_WRITE_VERIFY");
  return true;
}
function queuePodcastCellUpdate_(updates,row,column,current,candidate) {
  if (!String(current || "").trim() && String(candidate || "").trim()) updates.push({row,column,value:candidate});
}
function queuePodcastGenreUpdate_(updates,row,column,current,candidate) {
  // 出典フラグのない既存値も含め全て保護。「その他」も手動確定とみなす。
  queuePodcastCellUpdate_(updates,row,column,current,candidate);
}

// GAS V8にブラウザーのURLグローバルを要求しない。
function recommendationUrl_(value) {
  const m = String(value || "").trim().match(/^https:\/\/([a-z0-9.-]+)(\/[^\s#]*)?(?:#[^\s]*)?$/i);
  if (!m || m[1].indexOf("..")>=0) return null;
  return {host:m[1].toLowerCase(),path:m[2] || "/"};
}
function isSafePublicPodcastRss_(value) {
  const u = recommendationUrl_(value);
  return !!u && ["anchor.fm","feeds.megaphone.fm","rss.listen.style","feeds.buzzsprout.com",
    "feeds.simplecast.com","feeds.transistor.fm","feeds.acast.com","www.omnycontent.com"].indexOf(u.host)>=0 &&
    !/[?&](token|auth|key|signature|sig|access_token)=/i.test(u.path);
}
function recommendationFetch_(url, options) {
  const u = recommendationUrl_(url);
  if (!u || !(["itunes.apple.com","api.spotify.com","accounts.spotify.com","open.spotify.com"].indexOf(u.host)>=0 || isSafePublicPodcastRss_(url)))
    throw new Error("UNSAFE_URL");
  const b = recommendationBudget_;
  if (b && (Date.now()>=Math.min(b.deadline,b.shelfDeadline || b.deadline) || b.http>=Math.min(b.maxHttp,b.shelfMaxHttp || b.maxHttp))) throw new Error("BUDGET");
  if (b && b.cache[url]) return b.cache[url];
  if (b) b.http++;
  const response = UrlFetchApp.fetch(url,Object.assign({},options || {},{muteHttpExceptions:true,followRedirects:false}));
  const code=response.getResponseCode();
  if (code>=300 && code<400) throw new Error("REDIRECT_REVIEW");
  if (code<200 || code>=300) throw new Error("HTTP_"+code);
  if (response.getContent().length>2000000) throw new Error("OVERSIZE");
  const text=response.getContentText();
  if (b) b.cache[url]=text;
  return text;
}
function recommendationIdentity_(title,maker,actualTitle,actualMaker) {
  return !!normalizeTitle(title || "") && !!normalizeTitle(maker || "") &&
    normalizeTitle(title)===normalizeTitle(actualTitle || "") && normalizeTitle(maker)===normalizeTitle(actualMaker || "");
}
function findExactApplePodcast_(title,maker,rss,sourceUrl) {
  const data=JSON.parse(recommendationFetch_("https://itunes.apple.com/search?media=podcast&entity=podcast&limit=50&country=JP&term="+encodeURIComponent(title)));
  const sourceId=String(sourceUrl || "").match(/^https:\/\/podcasts\.apple\.com\/[^?#]*\/id(\d+)(?:[?#]|$)/);
  const matches=(data.results || []).filter(item => {
    if (!recommendationIdentity_(title,maker,item.collectionName || item.trackName,item.artistName || item.collectionArtistName)) return false;
    if (!isSafePublicPodcastRss_(item.feedUrl)) return false;
    if (rss) return String(item.feedUrl)===String(rss);
    return !!sourceId && String(item.collectionId)===sourceId[1];
  });
  return matches.length===1 ? matches[0] : null;
}
function readPodcastFeedMetadata_(feedUrl) {
  const root=XmlService.parse(recommendationFetch_(feedUrl)).getRootElement();
  const channel=root.getChild("channel");
  if (!channel) return null;
  const ns=XmlService.getNamespace("itunes","http://www.itunes.com/dtds/podcast-1.0.dtd");
  const image=channel.getChild("image",ns);
  const categories=channel.getChildren("category",ns).map(n => n.getAttribute("text")).filter(Boolean).map(a=>a.getValue());
  const links=[String(channel.getChildText("link") || "")];
  const atom=XmlService.getNamespace("atom","http://www.w3.org/2005/Atom");
  channel.getChildren("link",atom).forEach(n=>{const a=n.getAttribute("href");if(a)links.push(a.getValue());});
  return {title:channel.getChildText("title"),maker:channel.getChildText("author",ns),links,
    artwork:image && image.getAttribute("href") ? image.getAttribute("href").getValue() : "",
    rawGenre:categories,genre:normalizePodcastGenre_(categories,categories[0] || "")};
}
function readPodcastFeedLinks_(feedUrl) { const meta=readPodcastFeedMetadata_(feedUrl);return meta ? meta.links : []; }
function resolveListenerPodcastPlatforms_(title,maker,sourceUrl,explicitRss) {
  const result={reasons:{},rawGenre:[]};
  ["spotify","apple","listen","standfm","amazon","youtube","website","artwork","rss","pocketcasts","pody","genre"].forEach(k=>{result[k]="";result.reasons[k]="REVIEW_NO_VERIFIED_SOURCE";});
  let rss=String(explicitRss || "").trim();
  let meta=null;
  if (rss) {
    try {
      meta=readPodcastFeedMetadata_(rss);
      if (!meta || !recommendationIdentity_(title,maker,meta.title,meta.maker)) { meta=null; result.reasons.rss="REVIEW_RSS_IDENTITY"; }
      else {result.rss=rss;result.artwork=meta.artwork;result.genre=meta.genre;result.rawGenre=meta.rawGenre;}
    } catch(error) {result.reasons.rss=recommendationError_(error);}
  }
  try {
    const apple=result.reasons.rss === "REVIEW_RSS_IDENTITY" ? null : findExactApplePodcast_(title,maker,rss,sourceUrl);
    if (apple) {
      result.apple=String(apple.collectionViewUrl || apple.trackViewUrl || "");
      // 既存RSSは決して置換しない。RSSなしは既存Apple IDとの照合が必要。
      if (!rss) {rss=apple.feedUrl;result.rss=rss;}
      result.artwork=result.artwork || apple.artworkUrl600 || apple.artworkUrl100 || "";
      result.rawGenre=apple.genres || [apple.primaryGenreName || ""];
      result.genre=normalizePodcastGenre_(result.rawGenre,apple.primaryGenreName || "");
      if (!meta) {
        const candidate=readPodcastFeedMetadata_(rss);
        if (candidate && recommendationIdentity_(title,maker,candidate.title,candidate.maker)) meta=candidate;
      }
    }
  } catch(error) {result.reasons.apple=recommendationError_(error);}
  // RSSのリンクだけでは採用しない。RSSタイトル/配信者とSpotify APIを突合。
  const spotifyIds=meta ? meta.links.map(spotifyRecommendationId_).filter(Boolean) : [];
  const sourceId=spotifyRecommendationId_(sourceUrl);
  if (sourceId) spotifyIds.push(sourceId);
  try {
    const spotify=findVerifiedRecommendationSpotify_(title,maker,spotifyIds);
    result.spotify=spotify.url;result.reasons.spotify=spotify.reason;
  } catch(error) {result.reasons.spotify=recommendationError_(error);}
  // 他サービスは外部リンクの同一性検証が未実装なので自動採用しない。
  result.reasons.pocketcasts="FOLLOW_LINK_NOT_SHOW_URL";
  result.reasons.pody="REVIEW_NO_VERIFIED_PODY_ADAPTER";
  Object.keys(result.reasons).forEach(k=>{if(result[k])result.reasons[k]="VERIFIED";});
  return result;
}
function spotifyRecommendationId_(url) {
  const match=String(url || "").match(/^https:\/\/open\.spotify\.com\/show\/([A-Za-z0-9]{22})(?:[?#/]|$)/);
  return match ? match[1] : "";
}
function canonicalPodcastUrl_(value) { return String(value || "").split(/[?#]/)[0]; }
function pocketCastsFollowUrl_(rss) { return isSafePublicPodcastRss_(rss) ? "https://pocketcasts.com/follow/"+encodeURIComponent(rss) : ""; }
function applyKnownPodcastUrl_(resolved,value) {
  // 明示入力の番組URLのみを分類する。任意ホストの部分一致は禁止。
  if (spotifyRecommendationId_(value)) resolved.spotify=resolved.spotify || canonicalPodcastUrl_(value);
}
