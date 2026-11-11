// Phase25 V2 intake planner. PURE: no Sheet, Spotify, or network writes.
// The caller must supply the V2 header row and existing rows; do not use fixed column letters.
(function(root) {
  "use strict";
  const S = v => String(v == null ? "" : v).trim();
  const norm = v => S(v).normalize("NFKC").replace(/\s+/g," ").toLowerCase();
  const key = v => norm(v).replace(/[\s　・、。:：!?！？「」『』（）()【】\[\]]/g,"");
  const titleKey = v => key(S(v).replace(/^(?:[（(]再[）)]|[（(]再配信[）)]|【再配信】)\s*/,""));
  const field = (headers, aliases) => {
    const indices = aliases.map(a => headers.findIndex(h => norm(h) === norm(a))).filter(i => i >= 0);
    return indices.length ? indices[0] : -1;
  };
  function schema(headers) {
    const h = (headers || []).map(S);
    const c = {
      ep: field(h, ["EP-ID","台帳ID"]),
      show: field(h, ["番組名"]),
      title: field(h, ["タイトル","エピソードタイトル"]),
      guid: field(h, ["公式GUID","GUID","外部ID"]),
      url: field(h, ["公式個別URL","公式URL"]),
      spotify: field(h, ["Spotify個別URL"]),
      decision: field(h, ["掲載判定"]),
      representative: field(h, ["代表EP-ID"])
    };
    for (const name of ["ep","show","title","guid","url","decision","representative"]) {
      if (c[name] < 0) throw new Error("V2_SCHEMA_MISSING_" + name.toUpperCase());
    }
    return c;
  }
  function identity(row,c) {
    return {ep:S(row[c.ep]),show:S(row[c.show]),title:S(row[c.title]),
      guid:S(row[c.guid]),url:S(row[c.url]),spotify:c.spotify<0?"":S(row[c.spotify]),
      decision:S(row[c.decision]),representative:S(row[c.representative])};
  }
  function plan(headers, oldRows, incoming, options) {
    options=options||{};
    const c=schema(headers);
    const old=(oldRows||[]).filter(r=>Array.isArray(r)&&r.some(Boolean)).map(r=>identity(r,c));
    const byId=new Map(), byGuid=new Map(), byUrl=new Map(), byTitle=new Map();
    function add(m,k,r) { if(k) {const a=m.get(k)||[];a.push(r);m.set(k,a);} }
    for (const r of old) {
      add(byId,r.ep,r);add(byGuid,r.guid,r);add(byUrl,r.url,r);
      add(byTitle,key(r.show)+"|"+titleKey(r.title),r);
    }
    const results=[], seenGuids=new Set(), seenUrls=new Set(), seenIds=new Set();
    for (const r0 of incoming||[]) {
      const r=identity(r0,c);
      let status="HOLD",reason="REVIEW_REQUIRED",representative="";
      if (!r.show || !r.title || (!r.guid && !r.url)) reason="IDENTITY_INCOMPLETE";
      else if (/^(AJW|アルキキ|朝ポキTV)$/i.test(r.show)) {status="EXCLUDE";reason="EXCLUDED_SHOW";}
      else if (r.ep && byId.has(r.ep)) reason="EP_ID_ALREADY_EXISTS";
      else if (r.ep && seenIds.has(r.ep)) reason="BATCH_EP_ID_COLLISION";
      else if (r.guid && seenGuids.has(r.guid) || r.url && seenUrls.has(r.url)) reason="BATCH_IDENTITY_COLLISION";
      else {
        const exact=[...(byGuid.get(r.guid)||[]),...(byUrl.get(r.url)||[])];
        const candidates=exact.length?exact:(byTitle.get(key(r.show)+"|"+titleKey(r.title))||[]);
        if(candidates.length) {
          const representatives=[...new Set(candidates.map(x=>x.representative||x.ep))];
          if(representatives.length===1 && representatives[0]) {
            representative=representatives[0];reason=exact.length?"DUPLICATE_IDENTITY":"POSSIBLE_REBROADCAST";
          } else reason="AMBIGUOUS_REPRESENTATIVE";
        } else {status="CANDIDATE";reason="NEW_EPISODE_UNREVIEWED";}
      }
      results.push({ep:r.ep,show:r.show,title:r.title,status,reason,representative});
      if(r.ep)seenIds.add(r.ep);if(r.guid)seenGuids.add(r.guid);if(r.url)seenUrls.add(r.url);
    }
    // Candidate is NOT approval to write or publish. All writes need a separate
    // reviewed manifest, and must recheck the latest V2 state under a lock.
    return {mode:"READ_ONLY",oldCount:old.length,incomingCount:results.length,
      counts:results.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}),results};
  }
  const api={schema,plan};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  root.P25V2Intake=api;
})(typeof globalThis!=="undefined"?globalThis:this);
