// Read-only Saito Kenichiro speaker preflight for Spotify Access V3.
// This file intentionally does NOT register a write adapter.
// It proves the speaker classifier boundary against a real playlist identity
// while keeping human-decision/write behavior fail-closed.
const SP3_SAITO_SPEAKER_V3_ = {
  speakerId:'SAITO_KENICHIRO',
  name:'斎藤健一郎',
  playlistId:'7FBbaBPpGDSJUIXN4L2iYi',
  targetEpisodeId:'3Qhcx3wDl9anbIiGQsaCDk',
  aliases:['斎藤健一郎','斎藤 健一郎']
};

function sp3SaitoSpeakerPreviewRule_() {
  return {
    key:'sp3-speaker-saito-preview',
    enabled:false,
    productionWriteAllowed:false,
    reviewRequired:false,
    ruleType:'speaker',
    name:SP3_SAITO_SPEAKER_V3_.name,
    speakerId:SP3_SAITO_SPEAKER_V3_.speakerId,
    playlistId:SP3_SAITO_SPEAKER_V3_.playlistId,
    showIds:(typeof ASAHI_PRIMARY_SHOW_IDS!=='undefined' ? ASAHI_PRIMARY_SHOW_IDS.slice() : []),
    keywords:SP3_SAITO_SPEAKER_V3_.aliases.slice(),
    speakerAliases:SP3_SAITO_SPEAKER_V3_.aliases.slice(),
    fields:['name','description','html_description']
  };
}

function previewSaitoSpeakerEpisodeV3_(episode) {
  if (typeof classifySpeakerSafeV2_!=='function') {
    throw new Error('SP3_FATAL:SPEAKER_CLASSIFIER_MISSING');
  }
  const rule=sp3SaitoSpeakerPreviewRule_();
  const result=classifySpeakerSafeV2_(episode,rule);
  return {
    dryRun:true,
    spotifyWrite:false,
    playlistId:rule.playlistId,
    targetEpisodeId:SP3_SAITO_SPEAKER_V3_.targetEpisodeId,
    classification:result.classification,
    reasons:result.reasons||[],
    matchedField:result.matchedField||'',
    matchedSection:result.matchedSection||'',
    excerpt:result.excerpt||''
  };
}

// Deliberately fail closed if someone tries to promote the preview directly into a write adapter.
function sp3SaitoSpeakerWriteAdapterV3_() {
  throw new Error('SP3_FATAL:SPEAKER_HUMAN_DECISION_PATH_UNVERIFIED');
}
