"use client";
// ポすすめカードに足す欄（#312）: 「🎙 紹介された回」「💬 ポすすめ返し」「✨ ポす神回」「この番組のポす神回・ポすすめ返しを教える」
// 既存カードの番組名・配信者・アートワーク・紹介配信日・配信先リンク・並び替えには触れない。データが無いカードでは何も出さない（ボタンは投稿受付が有効なときだけ）。
import { useState } from "react";
import {
  formatPosukamiDate,
  isPosukamiNew,
  looksLikeEpisodeUrl,
  posukamiHref,
  posukamiResultMessage,
  posukamiSubmitUrl,
  type PosukamiCard,
  type PosukamiEpisode,
} from "./posukami";

type Props = {
  podcast: { id: string; title: string };
  card?: PosukamiCard;
  submitEnabled: boolean;
  endpoint: string;
  loadJsonp: (url: string) => Promise<unknown>;
};

// 回のタイトルそのものをリンクにする（蔵に収蔵済み → 蔵の個別ページ、未収蔵 → 検証済みの公式エピソードページを新しいタブで）
function PosukamiList({ label, kind, episodes }: { label: string; kind: string; episodes: PosukamiEpisode[] }) {
  return (
    <div className={"podcastComment posukamiGroup posukami-" + kind}>
      <strong className="posukamiLabel">{label}</strong>
      <ul className="posukamiList">
        {episodes.map((episode) => {
          const meta = [episode.program && episode.program !== "ドーナツ" && kind !== "reply" ? episode.program : "", formatPosukamiDate(episode.date)].filter(Boolean).join("・");
          return (
            <li key={kind + "-" + episode.href}>
              <a className="posukamiTitleLink" href={posukamiHref(episode.href)} target="_blank" rel="noopener noreferrer">
                {episode.title}{episode.library ? "" : <span aria-label="（新しいタブで開きます）"> ↗</span>}
              </a>
              {kind !== "intro" && isPosukamiNew(episode.verifiedAt) && <span className="newBadge newBadgeActive posukamiNew">NEW</span>}
              {meta && <small className="posukamiMeta">{meta}</small>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}


export default function PosukamiCardSection({ podcast, card, submitEnabled, endpoint, loadJsonp }: Props) {
  // URL一発投稿（#315）: URL欄と投稿ボタンだけ。番組ID・番組名はカードから、種類はボタンから自動で付ける
  const [mode, setMode] = useState<"" | "reply" | "other">("");
  const [url, setUrl] = useState("");
  const [website2, setWebsite2] = useState(""); // ボット対策（人には見えない欄）
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string[]>([]); // この画面で送ったURL（同じURLの二重送信を防ぐ）
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const formId = "posukami-form-" + podcast.id;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || !mode) return; // 二重送信を防ぐ
    const u = url.trim();
    if (!looksLikeEpisodeUrl(u)) { setResult({ ok: false, text: "エピソード（回）ごとのURLを貼り付けてください。番組トップのURLは受け付けていません。" }); return; }
    if (sent.includes(u)) { setResult({ ok: false, text: "このURLはさきほど送りました。" }); return; }
    setSending(true);
    setResult(null);
    try {
      const res = await loadJsonp(posukamiSubmitUrl(endpoint, { podcastId: podcast.id, podcastTitle: podcast.title, url: u, relation: mode, website2 }));
      const message = posukamiResultMessage(res);
      setResult(message);
      if (message.ok) { setSent((v) => [...v, u]); setUrl(""); }
    } catch {
      setResult({ ok: false, text: "送信を確認できませんでした（通信エラー）。受付は完了していない可能性があります。時間をおいてもう一度お試しください。" });
    } finally {
      setSending(false);
    }
  }
  function toggle(next: "reply" | "other") { setMode((m) => (m === next ? "" : next)); setResult(null); }
  // どちらを選んでいるかを、ボタンの色・印と入力欄の見出しで示す（管理人 2026-11-20「どっちがどっちだかわからない」）
  const MODE = {
    reply: { icon: "💬", name: "ポすすめ返し", hint: "ポすすめを受けて、この番組が配信した回のURL" },
    other: { icon: "✨", name: "ポす神回", hint: "神田さんのゲスト出演など、ドーナツとこの番組が交流した回のURL" },
  } as const;

  const intros = card?.introductions || [];
  const replies = card?.replies || [];
  const specials = card?.specials || [];
  if (!intros.length && !replies.length && !specials.length && !submitEnabled) return null;

  return (
    <div className="posukamiSection">
      {intros.length > 0 && <PosukamiList label="🎙 紹介された回" kind="intro" episodes={intros} />}
      {replies.length > 0 && <PosukamiList label="💬 ポすすめ返し" kind="reply" episodes={replies} />}
      {specials.length > 0 && <PosukamiList label="✨ ポす神回" kind="special" episodes={specials} />}
      {submitEnabled && (
        <div className="posukamiSubmit">
          <div className="posukamiSubmitButtons">
            <button type="button" className={"posukamiSubmitToggle posukamiToggle-reply" + (mode === "reply" ? " isActive" : "")} aria-expanded={mode === "reply"} aria-controls={formId} onClick={() => toggle("reply")}>💬 この番組の「ポすすめ返し」を教える{mode === "reply" && <span className="posukamiChosen">✓ 選択中</span>}</button>
            <button type="button" className={"posukamiSubmitToggle posukamiToggle-other" + (mode === "other" ? " isActive" : "")} aria-expanded={mode === "other"} aria-controls={formId} onClick={() => toggle("other")}>✨ ポす神回を教える{mode === "other" && <span className="posukamiChosen">✓ 選択中</span>}</button>
          </div>
          {mode && (
            <form id={formId} onSubmit={submit} className={"posukamiForm posukamiForm-" + mode}>
              <p className="posukamiFormHead"><strong>{MODE[mode].icon} {MODE[mode].name}を投稿</strong><span>{MODE[mode].hint}</span></p>
              <label className="posukamiUrlLabel">
                <span className="visuallyHidden">{MODE[mode].name}のエピソードURL</span>
                <input type="url" inputMode="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder={MODE[mode].name + "の回のURLを貼り付け"} />
              </label>
              <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website2} onChange={(e) => setWebsite2(e.target.value)} style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }} />
              <button type="submit" disabled={sending}>{sending ? "送信中…" : MODE[mode].name + "を投稿"}</button>
              {result && <p role="status" className="posukamiResult">{result.text}</p>}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
