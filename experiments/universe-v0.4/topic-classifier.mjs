// V0.3 topic classifier draft. Read-only; deterministic and auditable.
// Classify from title first, then a short excerpt of keywords to reduce boilerplate contamination.
export const RULES_VERSION = "v0.3-draft-1";
const rules = [
  ["AI・技術", /(?:生成AI|人工知能|ChatGPT|OpenAI|半導体|サイバー|デジタル|SNS|インターネット|ロボット)/iu],
  ["政治", /(?:選挙|首相|国会|政党|大臣|内閣|政治資金|議員|政権|官邸)/u],
  ["国際・戦争", /(?:ウクライナ|ロシア|イスラエル|ガザ|パレスチナ|戦争|外交|国連|軍事|中国|トランプ|米軍)/u],
  ["経済", /(?:経済|物価|賃金|株価|投資|金融|円安|為替|企業|税制|NISA)/iu],
  ["社会・福祉", /(?:介護|福祉|障害|医療|病院|教育|学校|子ども|ジェンダー|人権|貧困|労働)/u],
  ["文化・暮らし", /(?:映画|音楽|文学|美術|芸術|食|暮らし|スポーツ|旅行|家族)/u]
];
export function classifyEpisode(row) {
  const title = String(row.title || "");
  const descriptionLead = String(row.keywords || "").slice(0, 180);
  const matches = rules.map(([topic,pattern]) => ({
    topic, titleMatch: pattern.test(title), descriptionMatch: pattern.test(descriptionLead)
  })).filter(m => m.titleMatch || m.descriptionMatch);
  const primary = matches.find(m=>m.titleMatch) || matches[0];
  return {
    id: row.id, topic: primary?.topic || "未分類",
    tags: matches.map(m=>m.topic), evidence: primary ? (primary.titleMatch ? "title" : "description-lead") : "none",
    rulesVersion: RULES_VERSION
  };
}
