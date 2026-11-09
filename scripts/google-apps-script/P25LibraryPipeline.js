// Phase25 COPY/mock pipeline. No global side effects and no trigger installation.
// All I/O is injected; production entrypoints deliberately remain unchanged.
function p25Text_(value) { return String(value == null ? "" : value).trim(); }
// Episodes the administrator keeps on hold: never added automatically and never selectable. (EP-00028)
const P25_ADMIN_HOLD_EP_IDS_ = ["EP-00028"];
function p25Normalize_(value) { return p25Text_(value).normalize("NFKC"); }
function p25EpisodeId_(url) {
  const m = p25Text_(url).match(/^https:\/\/open\.spotify\.com\/episode\/([A-Za-z0-9]{22})(?:[?#].*)?$/);
  return m ? m[1] : "";
}
function p25Request_(input) {
  const match = p25Text_(input.url).match(/^https:\/\/open\.spotify\.com\/playlist\/([A-Za-z0-9]{22})(?:[?#].*)?$/);
  if (!match || ["series", "speaker", "theme"].indexOf(input.updateType) < 0) throw new Error("INVALID_REQUEST");
  const terms = Array.from(new Set(p25Normalize_(input.keywords).split(/[\n,、]+/).map(p25Text_).filter(Boolean))).sort();
  if (!terms.length) throw new Error("EMPTY_KEYWORDS");
  // Never persist inviteUrl, maker, securityAnswer, or ruleNote in pipeline state.
  const rule = { playlistId: match[1], type: input.updateType, terms: terms, show: p25Text_(input.show) };
  rule.revision = JSON.stringify([rule.type, rule.terms, rule.show]);
  return rule;
}
// Ledger date -> "YYYY-MM-DD" (the date as written in the ledger). "" when it cannot be read,
// which makes auto-add fail closed for that episode.
function p25Day_(value) {
  const text = p25Normalize_(value);
  // Timestamps that carry an explicit zone (Z or +hh:mm) are converted to the Japan calendar day.
  // Zone-less ledger dates are taken as written (JST).
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?\s*(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    const ms = Date.parse(text.replace(" ", "T").replace(/\s+/g, ""));
    return isNaN(ms) ? "" : new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 10);
  }
  const m = text.match(/(\d{4})\s*[-\/.年]\s*(\d{1,2})\s*[-\/.月]\s*(\d{1,2})/);
  if (!m) return "";
  const pad = function(n) { return ("0" + n).slice(-2); };
  return m[1] + "-" + pad(m[2]) + "-" + pad(m[3]);
}
// Rule-level auto-add policy. Valid only when an administrator confirmed `since` for exactly this
// rule revision. Anything else disables auto-add (per-episode approval keeps working).
function p25AddDays_(day, n) {
  return new Date(Date.parse(day + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
}
function p25AutoAddPolicy_(state, rule) {
  const policy = state && state.autoAdd;
  if (!policy || policy.revision !== rule.revision || !/^\d{4}-\d{2}-\d{2}$/.test(String(policy.since || ""))) return null;
  const shows = (Array.isArray(policy.shows) ? policy.shows : []).map(p25Text_).filter(Boolean);
  if (rule.show && shows.indexOf(rule.show) < 0) shows.push(rule.show);
  return { since: policy.since, shows: shows };
}
// Same rule as the public library (public/library/library-core.mjs `blocked`): anything other than
// blank / 未指定 / なし / false / 0 / no in the ledger's 人間除外 cell means "excluded by a human".
function p25Blocked_(value) {
  const v = p25Normalize_(value).toLowerCase();
  return v !== "" && ["未指定", "なし", "false", "0", "no"].indexOf(v) < 0;
}
// options.requireExclusionColumn: production must read column AM (人間除外) and fail closed when the
// header is not there. options.exclusions: rows of the 削除・除外履歴 sheet (header first; col A = GUID, col B = EP-ID).
function p25Index_(values, options) {
  options = options || {};
  const expected = {0:"台帳ID",1:"番組名",2:"タイトル",3:"配信日時",6:"外部ID",11:"Spotify個別URL",22:"概要清掃済み",23:"出演者"};
  if (!values.length || Object.keys(expected).some(function(i) { return p25Text_(values[0][i]).indexOf(expected[i]) < 0; })) throw new Error("LEDGER_SCHEMA_MISMATCH");
  if (options.requireExclusionColumn && p25Text_(values[0][38]).indexOf("人間除外") < 0) throw new Error("LEDGER_SCHEMA_MISMATCH");
  const excludedGuids = new Set(), excludedIds = new Set();
  (Array.isArray(options.exclusions) ? options.exclusions : []).slice(1).forEach(function(r) {
    if (p25Text_(r[0])) excludedGuids.add(p25Text_(r[0]).toLowerCase());
    if (p25Text_(r[1])) excludedIds.add(p25Text_(r[1]));
  });
  const counts = { ep: new Map(), guid: new Map(), spotify: new Map() };
  const rows = values.slice(1).filter(function(row) { return row.some(Boolean); }).map(function(row) {
    const e = {epId:p25Text_(row[0]),show:p25Text_(row[1]),title:p25Text_(row[2]),date:p25Text_(row[3]),guid:p25Text_(row[6]),spotifyId:p25EpisodeId_(row[11]),description:p25Text_(row[22]),cast:p25Text_(row[23])};
    e.humanExcluded = p25Blocked_(row[38]) || excludedIds.has(e.epId) || excludedGuids.has(e.guid.toLowerCase());
    [[counts.ep,e.epId],[counts.guid,e.guid],[counts.spotify,e.spotifyId]].forEach(function(pair) { if (pair[1]) pair[0].set(pair[1],(pair[0].get(pair[1])||0)+1); });
    return e;
  });
  rows.forEach(function(e) {
    e.reason = P25_ADMIN_HOLD_EP_IDS_.indexOf(e.epId) >= 0 ? "ADMIN_HOLD" : !/^EP-\d{5}$/.test(e.epId) ? "INVALID_EP_ID" : !e.guid ? "GUID_MISSING" : !e.spotifyId ? "SPOTIFY_URL_MISSING_OR_INVALID" : !e.title || !e.date ? "METADATA_MISSING" : counts.ep.get(e.epId)>1 || counts.guid.get(e.guid)>1 || counts.spotify.get(e.spotifyId)>1 ? "IDENTITY_CONFLICT" : "";
    // Exact evidence binding invalidates approval after any matching input changes.
    e.evidence = JSON.stringify([e.epId,e.guid,e.spotifyId,e.show,e.title,e.date,e.description,e.cast]);
  });
  return {rows:rows,guids:new Set(rows.map(function(e){return e.guid;}).filter(Boolean))};
}
function p25Plan_(index, rule, state, membership) {
  const existing = new Set(membership), excluded = new Set(state.excluded || []);
  const result = {candidates:[], additions:[], holds:[], existing:[], skipped:[], humanExcluded:[]};
  const policy = p25AutoAddPolicy_(state, rule);
  index.rows.forEach(function(e) {
    if (rule.show && rule.show !== e.show) return;
    const text = p25Normalize_(rule.type === "series" ? e.title : rule.type === "speaker" ? e.cast : e.title+"\n"+e.description);
    const hits = rule.terms.filter(function(term) { return text.indexOf(term)>=0; });
    if (!hits.length) return;
    // Ledger-side human exclusion (AM column / 削除・除外履歴) always wins, before anything else.
    if (e.humanExcluded) { result.humanExcluded.push(e.epId); return; }
    if (excluded.has(e.epId) || excluded.has(e.guid) || excluded.has(e.spotifyId)) return;
    const candidate = {epId:e.epId,guid:e.guid,spotifyId:e.spotifyId,evidence:e.evidence,matchedTerms:hits};
    result.candidates.push(candidate);
    if (e.reason) { result.holds.push({epId:e.epId,reason:e.reason}); return; }
    if (existing.has(e.spotifyId)) { result.existing.push(e.spotifyId); return; }
    const approval = (state.approvals || {})[e.epId];
    if (approval && approval.revision === rule.revision && approval.evidence === e.evidence) {
      candidate.day = p25Day_(e.date); result.additions.push(candidate); return;
    }
    if (!policy) {
      result.holds.push({epId:e.epId,reason:"REVIEW_REQUIRED"}); return;
    }
    // Auto-add: new arrivals only. Everything else is skipped without blocking the playlist,
    // so old episodes, other shows and the day of approval can never be resurrected.
    const day = p25Day_(e.date);
    if (!day) { result.skipped.push({epId:e.epId,reason:"DATE_UNPARSEABLE"}); return; }
    // Typos such as a wrong year must not look like "new": at most one day ahead of today (JST).
    if (state.today && day > p25AddDays_(state.today, 1)) { result.skipped.push({epId:e.epId,reason:"DATE_FUTURE"}); return; }
    if (policy.shows.indexOf(e.show) < 0) { result.skipped.push({epId:e.epId,reason:"OTHER_SHOW"}); return; }
    if (day <= policy.since) { result.skipped.push({epId:e.epId,reason:"NOT_NEW"}); return; }
    candidate.day = day; candidate.auto = true;
    result.additions.push(candidate);
  });
  // Oldest first so the playlist keeps release order.
  result.additions.sort(function(a,b){ return (a.day||"").localeCompare(b.day||"") || a.epId.localeCompare(b.epId); });
  return result;
}
function p25SourceAudit_(index, sources) {
  if (!sources || sources.complete !== true) return {status:"SOURCE_UNKNOWN",missing:[]};
  return {status:"CHECKED",missing:(sources.items || []).filter(function(e){return e.guid && !index.guids.has(e.guid);}).map(function(e){return {guid:e.guid,show:e.show,reason:"SOURCE_MISSING"};})};
}
function p25Error_(error, now) {
  const status = Number(error && error.status || 0);
  return {reason:status===429?"SPOTIFY_RATE_LIMIT":status===404?"SPOTIFY_NOT_FOUND_OR_ACCESS":status===401?"SPOTIFY_AUTH_REQUIRED":status===403?"SPOTIFY_FORBIDDEN":"IO_FAILED",resumeAt:status===429?now+Math.max(60,Number(error.retryAfterSeconds)||60)*1000:0};
}
// io contract: locked execution, durable load/save, ledger/request/source reads,
// full paginated membership, add, and readPublished. Never log raw I/O errors.
function p25Run_(io, options) {
  options = options || {};
  return io.withLock(function() {
    const now = io.now(), shared = io.load("shared") || {cursor:0,resumeAt:0};
    if (shared.resumeAt > now) return {status:"WAIT",resumeAt:shared.resumeAt};
    // exactly once for all requests; with readExclusions the AM column and exclusion sheet are mandatory
    const index = p25Index_(io.readLedger(), io.readExclusions ? { requireExclusionColumn: true, exclusions: io.readExclusions() } : {});
    const source = p25SourceAudit_(index,io.readSources());
    const rules = new Map(), conflicts = new Set(), invalid = [];
    io.readRequests().forEach(function(request) {
      try {
        const rule = p25Request_(request), old = rules.get(rule.playlistId);
        if (old && old.revision !== rule.revision) conflicts.add(rule.playlistId);
        rules.set(rule.playlistId,rule);
      } catch (_) { invalid.push({reason:"INVALID_REQUEST"}); }
    });
    const ordered = Array.from(rules.values()).sort(function(a,b){return a.playlistId.localeCompare(b.playlistId);});
    const results = [], limit = Math.min(ordered.length,options.maxPlaylists || 10);
    for (let step=0; step<limit; step++) {
      if (io.now()-now >= (options.timeBudgetMs || 240000)) break;
      const position = (shared.cursor+step)%ordered.length, rule = ordered[position], key = "playlist:"+rule.playlistId;
      const owner = io.readOwner ? io.readOwner(rule.playlistId) : null;
      if (owner && owner.owner !== "P25") {
        results.push({playlistId:rule.playlistId,skipped:"NOT_P25_OWNED",owner:owner.owner});
        shared.nextCursor=(position+1)%ordered.length;
        continue;
      }
      const state = io.load(key) || {receipt:"ACCEPTED",spotify:"PENDING",publication:"PENDING",approvals:{},excluded:[],observed:[],pending:[]};
      if (owner) {
        // The membership baseline is kept across generations: an episode P25 saw earlier and a human
        // removed while the playlist was PAUSED/LEGACY is a manual deletion and must not return.
        // (Legacy writers only add; the first adoption has no state, so its baseline starts empty.)
        state.generation = owner.generation;
        state.autoAdd = owner.autoAdd || null;
      }
      state.traceId = "p25:"+rule.playlistId;
      state.today = new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);
      state.rule = rule;
      state.source = source;
      let result = {playlistId:rule.playlistId,traceId:state.traceId};
      const stopped = io.isStopped ? io.isStopped(rule.playlistId) === true : false;
      if (conflicts.has(rule.playlistId) || state.paused || state.humanDeleted || stopped) {
        state.spotify = "HOLD"; state.reason = conflicts.has(rule.playlistId)?"CONFLICTING_REQUESTS":"HUMAN_STOP";
      } else {
        try {
          const members = io.readMembership(rule.playlistId);
          if (!Array.isArray(members)) throw new Error("INCOMPLETE_MEMBERSHIP");
          const memberSet = new Set(members);
          // Only complete successful reads can establish manual-removal tombstones.
          state.excluded = Array.from(new Set((state.excluded||[]).concat((state.observed||[]).filter(function(id){return !memberSet.has(id);})))) ;
          state.observed = members;
          // A timed-out POST may have succeeded. Never automatically resend uncertain IDs.
          const uncertain = (state.pending||[]).filter(function(id){return !memberSet.has(id);});
          state.pending = uncertain;
          const plan = p25Plan_(index,rule,state,members);
          state.plan = plan;
          state.publication = "PENDING";
          if (uncertain.length) {
            state.spotify="HOLD"; state.reason="WRITE_OUTCOME_UNKNOWN";
          } else if (plan.additions.length) {
            if (options.write !== true || io.canWrite(rule.playlistId) !== true) {
              state.spotify="READY"; state.reason="WRITE_DISABLED";
            } else {
              const batch=plan.additions.slice(0,Math.min(50,options.maxAdditions||10));
              state.pending=batch.map(function(e){return e.spotifyId;});
              state.spotify="WRITING";
              io.save(key,state); // durable intent BEFORE POST
              io.add(rule.playlistId,state.pending);
              const verified=io.readMembership(rule.playlistId), verifiedSet=new Set(verified);
              if (!Array.isArray(verified)) throw new Error("INCOMPLETE_MEMBERSHIP");
              state.pending=state.pending.filter(function(id){return !verifiedSet.has(id);});
              state.observed=verified;
              state.spotify=state.pending.length?"HOLD":plan.additions.length>batch.length?"READY":plan.holds.length?"HOLD":"VERIFIED";
              state.reason=state.pending.length?"WRITE_NOT_VERIFIED":plan.holds.length?"CANDIDATES_ON_HOLD":"";
              result.addedVerified=batch.filter(function(e){return verifiedSet.has(e.spotifyId);}).length;
            }
          } else {
            state.spotify=plan.holds.length?"HOLD":"VERIFIED";
            state.reason=plan.holds.length?"CANDIDATES_ON_HOLD":"";
          }
          if (state.spotify === "VERIFIED") {
            // readPublished must inspect rendered deployed content, not app/data.ts.
            const publication=io.readPublished(rule.playlistId);
            state.publication=publication && publication.visible===true && publication.verified===true?"PUBLISHED":"PENDING";
            state.publicationEvidence=publication && publication.verified===true?publication:null;
            state.lastSuccessfulScanAt=io.now();
          }
        } catch (error) {
          if (error && error.notSent === true && state.spotify === "WRITING") {
            // The gate refused before any request left: nothing is uncertain, nothing to resend blindly.
            state.pending = [];
          }
          const failure=p25Error_(error,io.now());
          if (error && error.notSent === true) failure.reason = /P25_GATE_BUSY/.test(String(error.message)) ? "GATE_BUSY" : /P25_WRITE_STOPPED/.test(String(error.message)) ? "WRITE_STOPPED" : /P25_SETTLING/.test(String(error.message)) ? "SETTLING" : /P25_OPERATOR_MISMATCH/.test(String(error.message)) ? "OPERATOR_MISMATCH" : "OWNER_CHANGED";
          state.spotify="HOLD";state.reason=failure.reason;
          if (failure.resumeAt) shared.resumeAt=failure.resumeAt;
        }
      }
      io.save(key,state);
      results.push(Object.assign(result,{skippedCount:state.plan?state.plan.skipped.length:0,receipt:state.receipt,spotify:state.spotify,publication:state.publication,reason:state.reason}));
      shared.nextCursor=(position+1)%ordered.length;
      if (shared.resumeAt>io.now()) break;
    }
    shared.cursor=shared.nextCursor||0;delete shared.nextCursor;
    io.save("shared",shared);
    return {status:"COMPLETE",ledgerRows:index.rows.length,source:source,results:results,invalidRequests:invalid};
  });
}

// A successful workflow or a URL in script/JSON is insufficient: require a real anchor.
function p25VerifyPublishedHtml_(status,html,playlistId,url,checkedAt) {
  const target="https://open.spotify.com/playlist/"+playlistId;
  const rendered=String(html).replace(/<!--[\s\S]*?-->/g," ").replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi," ");
  const links=rendered.match(/<a\b[^>]*\bhref\s*=\s*["'][^"']*["'][^>]*>/gi)||[];
  const visible=status===200&&links.some(function(link){
    const m=link.match(/\bhref\s*=\s*["']([^"']*)["']/i);
    return m&&m[1].split(/[?#]/)[0]===target;
  });
  return {visible:visible,verified:visible,url:url,checkedAt:checkedAt,playlistId:playlistId};
}

// Pure ledger search (no playlist, no Spotify): which ledger episodes match a show / cast / theme query,
// and whether each one is clean enough to be offered to a playlist.
function p25Search_(index, query) {
  const type = p25Text_(query && query.type);
  const terms = Array.from(new Set(p25Normalize_(query && query.keywords).split(/[\n,、]+/).map(p25Text_).filter(Boolean))).sort();
  if (["series", "speaker", "theme"].indexOf(type) < 0 || !terms.length) throw new Error("INVALID_SEARCH");
  const rule = { type: type, terms: terms, show: p25Text_(query.show), revision: "search" };
  const plan = p25Plan_(index, rule, { excluded: [], approvals: {} }, []);
  const holdReason = {};
  plan.holds.forEach(function(h) { holdReason[h.epId] = h.reason; });
  const byEp = {};
  index.rows.forEach(function(e) { byEp[e.epId] = e; });
  return {
    terms: terms,
    humanExcluded: plan.humanExcluded,
    episodes: plan.candidates.map(function(c) {
      const e = byEp[c.epId];
      return { epId: e.epId, guid: e.guid, spotifyId: e.spotifyId, show: e.show, title: e.title, day: p25Day_(e.date),
               matchedTerms: c.matchedTerms, status: holdReason[c.epId] && holdReason[c.epId] !== "REVIEW_REQUIRED" ? holdReason[c.epId] : "READY" };
    })
  };
}
