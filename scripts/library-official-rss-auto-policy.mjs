// Phase 13: official RSS proof -> existing V3 publication admission gate.
// No network, spreadsheet writes, triggers or publication side effects.
import {admitNewEpisodes,decisionVersion,v3RegisteredRowHash} from './library-new-admissions.mjs';

const normalize = value => String(value ?? '').trim().toLowerCase();
const uuidPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const timestamp = value => {
  const t = Date.parse(String(value ?? ''));
  if (!Number.isFinite(t)) throw Error('Invalid timestamp');
  return t;
};
const rowPublishedAt = value => {
  const raw = String(value ?? '').trim().replace(' ', 'T');
  return timestamp(/(?:Z|[+-]\d\d:\d\d)$/.test(raw) ? raw : raw + '+09:00');
};
const audioUrl = value => {
  try {
    const u = new URL(String(value ?? ''));
    return u.protocol === 'https:' && u.hostname.length > 0;
  } catch { return false; }
};

/**
 * evidence: persisted, authenticated official RSS observations.
 * Each record must contain id, feedUrl, guid, clipUuid, title, publishedAt,
 * audioUrl, fetchedAt. Evidence is NOT derived from public-site absence.
 * policy: {id, newAfter, allowedFeeds, observedAt}.
 */
export function autoAdmitOfficialRss(source, base, evidence, policy) {
  if (!policy?.id || !Array.isArray(policy.allowedFeeds) || !policy.allowedFeeds.length ||
      !Array.isArray(evidence) || !policy.newAfter || !policy.observedAt) {
    throw Error('Incomplete official RSS policy/evidence');
  }
  const cutoff = timestamp(policy.newAfter), observed = timestamp(policy.observedAt);
  const allowed = new Set(policy.allowedFeeds.map(String));
  const states = new Map();
  for (const record of source.v3FieldStates || []) {
    if (states.has(record[0])) throw Error('Duplicate V3 state');
    states.set(record[0], JSON.parse(record[1]));
  }
  const rows = new Map();
  for (const row of source.rows) {
    if (rows.has(row[0])) throw Error('Duplicate ledger ID');
    rows.set(row[0], row);
  }
  const baseline = new Set(base.decisions.map(d => d.id));
  const seen = new Set(), entries = [], exceptions = [];
  for (const proof of evidence) {
    const id = String(proof?.id ?? '');
    if (!id || seen.has(id)) throw Error('Duplicate/invalid RSS evidence ID');
    seen.add(id);
    // Historical IDs must never be reclassified as new.
    if (baseline.has(id)) continue;
    const row = rows.get(id), identity = states.get(id)?.identity;
    try {
      if (!allowed.has(proof.feedUrl)) throw Error('Feed not allowlisted');
      if (!row || !identity || identity[0] !== 'VERIFIED' || identity[5] !== 'RSS_registered')
        throw Error('Missing verified V3 registration');
      if (!proof.title || !proof.guid || !uuidPattern.test(String(proof.clipUuid)) ||
          !audioUrl(proof.audioUrl)) throw Error('Incomplete official RSS identity/audio');
      if (normalize(proof.guid) !== normalize(row[6]) || String(proof.title).trim() !== String(row[2]).trim() ||
          normalize(identity[1]) !== normalize(row[6])) throw Error('RSS/ledger identity mismatch');
      if (timestamp(proof.publishedAt) < cutoff || rowPublishedAt(row[3]) < cutoff ||
          timestamp(proof.fetchedAt) < timestamp(proof.publishedAt) ||
          timestamp(proof.fetchedAt) > observed) throw Error('Outside publication boundary');
      if (!row.some(cell => String(cell ?? '').includes(String(proof.audioUrl))))
        throw Error('Official audio URL absent from ledger');
      if (!row.some(cell => normalize(cell).includes(normalize(proof.clipUuid))))
        throw Error('Official clip UUID absent from ledger');
      const hash = v3RegisteredRowHash(row);
      if (String(identity[2]).replace(/=+$/, '') !== hash) throw Error('V3 row hash mismatch');
      if (timestamp(identity[6]) > observed) throw Error('Registration later than observation');
      entries.push({
        id, show: row[1], guid: row[6], rowHash: hash, registeredAt: identity[6],
        review: '確認済み', publication: '対象', decidedAt: policy.observedAt,
        verificationMethod: 'AUTOMATIC_OFFICIAL_RSS_RULE',
        policyId: policy.id, humanReview: false,
        rssEvidence: {feedUrl: proof.feedUrl, clipUuid: proof.clipUuid,
          fetchedAt: proof.fetchedAt, publishedAt: proof.publishedAt}
      });
    } catch (error) {
      exceptions.push({id, reason: String(error.message)});
    }
  }
  // The existing admission gate independently checks baseline, exclusions,
  // GUID/clip collisions and the V3 registration evidence.
  const admissions = {
    schema: 1, baseDecisionVersion: decisionVersion(base.decisions),
    newAfter: policy.newAfter, entries
  };
  const result = admitNewEpisodes(source, base, admissions);
  return {...result, exceptions, policyId: policy.id, verificationMethod: 'AUTOMATIC_OFFICIAL_RSS_RULE'};
}
