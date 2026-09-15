// 1ページ単位の候補抽出を外部通信なしで確認する純粋テスト。

function testAutoPlaylistPageMatchingPure() {
  const titleRule = {
    ruleType: AUTO_PLAYLIST_RULE_TYPE_TITLE_TEXT_,
    keyword: "めくろう"
  };
  const titleEpisodes = [
    { id: "e3", name: "別タイトル", description: "めくろうを概要欄だけに含む" },
    { id: "e2", name: "一緒に新聞をめくろう！", description: "" },
    { id: "old", name: "一緒に新聞をめくろう！", description: "" },
    { id: "older", name: "一緒に新聞をめくろう！", description: "" }
  ];
  const titleResult = matchAutoPlaylistEpisodePage_(titleEpisodes, titleRule, "old");
  if (!titleResult.reachedBoundary) throw new Error("前回境界を検出できません");
  if (titleResult.inspectedCount !== 2) throw new Error("境界より古いepisodeまで検査しています");
  if (titleResult.candidateIds.join(",") !== "e2") throw new Error("title-text候補抽出が不正です");

  const themeRule = {
    ruleType: AUTO_PLAYLIST_RULE_TYPE_THEME_,
    keywords: ["中東"],
    fields: ["name", "description", "html_description"],
    reviewRequired: true
  };
  const themeResult = matchAutoPlaylistEpisodePage_([
    { id: "t1", name: "国際ニュース", description: "中東情勢を解説", html_description: "" },
    { id: "t2", name: "中東を考える", description: "", html_description: "" },
    { id: "t3", name: "国内ニュース", description: "", html_description: "" }
  ], themeRule, "");
  if (themeResult.candidateIds.join(",") !== "t1,t2") {
    throw new Error("theme候補抽出が不正です");
  }

  const merged = mergeAutoPlaylistCandidateIds_(["a", "b"], ["b", "c"], 10);
  if (merged.join(",") !== "a,b,c") throw new Error("候補IDの重複排除が不正です");

  let overflowStopped = false;
  try {
    mergeAutoPlaylistCandidateIds_(["a", "b"], ["c"], 2);
  } catch (error) {
    overflowStopped = true;
  }
  if (!overflowStopped) throw new Error("候補ID上限超過で安全停止しません");

  Logger.log("Auto playlist page matching pure tests: PASS");
  return true;
}
