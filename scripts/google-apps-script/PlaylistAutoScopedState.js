// 自動更新の進捗を「ルール × Show」単位で分離して扱う純粋ヘルパー。
// PropertiesServiceへの読み書きはここでは行わない。

const AUTO_PLAYLIST_SCOPED_STATE_VERSION_ = 2;
const AUTO_PLAYLIST_SCOPED_STATE_PREFIX_ = "AUTO_PLAYLIST_V2_";

function normalizeAutoPlaylistStateKeyPart_(value) {
  return String(value || "").trim().replace(/[^A-Za-z0-9_-]/g, "_");
}

function buildAutoPlaylistScopedStateKey_(ruleKey, showId) {
  const safeRuleKey = normalizeAutoPlaylistStateKeyPart_(ruleKey);
  const safeShowId = normalizeAutoPlaylistStateKeyPart_(showId);
  if (!safeRuleKey) throw new Error("scoped stateにはrule.keyが必要です");
  if (!safeShowId) throw new Error("scoped stateにはshowIdが必要です");
  return AUTO_PLAYLIST_SCOPED_STATE_PREFIX_ + safeRuleKey + "__" + safeShowId;
}

function createAutoPlaylistScopedShowState_(rule, showId, mode, previousBoundaryId) {
  const ruleKey = String(rule && rule.key ? rule.key : "").trim();
  const normalizedShowId = String(showId || "").trim();
  if (!ruleKey) throw new Error("scoped state作成にはrule.keyが必要です");
  if (!normalizedShowId) throw new Error("scoped state作成にはshowIdが必要です");

  return {
    version: AUTO_PLAYLIST_SCOPED_STATE_VERSION_,
    ruleKey: ruleKey,
    showId: normalizedShowId,
    mode: String(mode || "bootstrap"),
    previousBoundaryId: String(previousBoundaryId || "").trim(),
    pendingBoundaryId: "",
    nextUrl: "",
    pagesFetched: 0,
    inspectedCount: 0,
    candidateIds: [],
    candidateCount: 0,
    reachedBoundary: false,
    retryNotBeforeMs: 0,
    complete: false
  };
}

function applyAutoPlaylistPageToScopedState_(state, episodes, rule, nextUrl) {
  const current = Object.assign({}, state || {});
  if (current.complete) throw new Error("完了済みscoped stateにはページを適用できません");
  if (String(current.ruleKey || "") !== String(rule && rule.key ? rule.key : "")) {
    throw new Error("scoped stateのruleKeyとルールが一致しません");
  }

  const source = Array.isArray(episodes) ? episodes : [];
  if (!current.nextUrl && !current.pendingBoundaryId && source.length) {
    current.pendingBoundaryId = String(source[0] && source[0].id ? source[0].id : "").trim();
  }

  const pageResult = matchAutoPlaylistEpisodePage_(
    source,
    rule,
    current.previousBoundaryId
  );
  const progress = buildAutoPlaylistPageMatchProgress_(current, pageResult);

  current.pagesFetched = Number(current.pagesFetched || 0) + 1;
  current.inspectedCount = progress.inspectedCount;
  current.candidateIds = progress.candidateIds;
  current.candidateCount = progress.candidateCount;
  current.reachedBoundary = progress.reachedBoundary;

  const hasNext = Boolean(String(nextUrl || "").trim());
  if (current.previousBoundaryId && !pageResult.reachedBoundary && !hasNext) {
    throw new Error(
      "前回境界を最後まで発見できなかったため安全停止しました: rule=" +
      current.ruleKey + " | show=" + current.showId +
      " | boundary=" + current.previousBoundaryId
    );
  }

  if (pageResult.reachedBoundary || !hasNext) {
    current.nextUrl = "";
    current.complete = true;
  } else {
    current.nextUrl = String(nextUrl);
  }

  return current;
}

function finalizeAutoPlaylistScopedBoundary_(state) {
  const current = Object.assign({}, state || {});
  if (!current.complete) throw new Error("未完了scoped stateの境界は確定できません");
  const boundary = String(current.pendingBoundaryId || "").trim();
  if (!boundary) throw new Error("確定できるpendingBoundaryIdがありません");
  return boundary;
}
