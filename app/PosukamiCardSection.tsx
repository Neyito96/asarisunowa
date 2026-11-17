"use client";
// ポすすめカードに足す欄（#312）: 「🎙 紹介された回」「💬 ポすすめ返し」「✨ ポす神回」「この番組のポす神回・ポすすめ返しを教える」
// 既存カードの番組名・配信者・アートワーク・紹介配信日・配信先リンク・並び替えには触れない。データが無いカードでは何も出さない（ボタンは投稿受付が有効なときだけ）。
import { useState } from "react";
import {
  POSUKAMI_RELATIONS,
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
          const meta = [episode.program && episode.program !== "ドーナツ" ? episode.program : "", formatPosukamiDate(episode.date)].filter(Boolean).join("・");
          return (
            <li key={kind + "-" + episode.href}>
              <a className="posukamiTitleLink" href={posukamiHref(episode.href)} {...(episode.library ? {} : { target: "_blank", rel: "noopener noreferrer" })}>
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
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [relation, setRelation] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [website2, setWebsite2] = useState(""); // ボット対策（人には見えない欄）
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const formId = "posukami-form-" + podcast.id;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return; // 二重送信を防ぐ
    if (!looksLikeEpisodeUrl(url)) { setResult({ ok: false, text: "エピソード（回）ごとのURLを入力してください。番組トップのURLは受け付けていません。" }); return; }
    if (!relation) { setResult({ ok: false, text: "どのような交流かを選んでください。" }); return; }
    setSending(true);
    setResult(null);
    try {
      const res = await loadJsonp(posukamiSubmitUrl(endpoint, { podcastId: podcast.id, podcastTitle: podcast.title, url, relation, title, date, note, website2 }));
      const message = posukamiResultMessage(res);
      setResult(message);
      if (message.ok) { setUrl(""); setTitle(""); setDate(""); setNote(""); setRelation(""); }
    } catch {
      setResult({ ok: false, text: "送信を確認できませんでした（通信エラー）。登録は完了していない可能性があります。時間をおいてもう一度お試しください。" });
    } finally {
      setSending(false);
    }
  }

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
        <div className="posukamiSubmit" style={{ marginTop: "0.5rem" }}>
          <button type="button" className="posukamiSubmitToggle" aria-expanded={open} aria-controls={formId} onClick={() => setOpen((v) => !v)} style={{ fontSize: "0.85rem" }}>
            {open ? "閉じる" : "✨ この番組のポす神回・ポすすめ返しを教える"}
          </button>
          {open && (
            <form id={formId} onSubmit={submit} className="posukamiForm" style={{ display: "grid", gap: "0.45rem", marginTop: "0.5rem", fontSize: "0.88rem" }}>
              <small style={{ opacity: 0.85 }}>「{podcast.title}」に付けます。確認・承認のあとに、このカードへ載ります。</small>
              <label>
                エピソードのURL（必須）
                <input type="url" inputMode="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…（回ごとのページ）" style={{ width: "100%" }} />
              </label>
              <label>
                どのような交流？（必須）
                <select required value={relation} onChange={(e) => setRelation(e.target.value)} style={{ width: "100%" }}>
                  <option value="">選んでください</option>
                  {POSUKAMI_RELATIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                タイトル（任意・空ならページから読み取ります）
                <input type="text" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%" }} />
              </label>
              <label>
                配信日（任意）
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label>
                補足（任意）
                <textarea maxLength={500} rows={2} value={note} onChange={(e) => setNote(e.target.value)} style={{ width: "100%" }} />
              </label>
              <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website2} onChange={(e) => setWebsite2(e.target.value)} style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }} />
              <button type="submit" disabled={sending}>{sending ? "送信中…" : "送る"}</button>
              <small style={{ opacity: 0.75 }}>送ったURLと内容は、確認のために管理人が見ます。お名前やメールアドレスは不要です。</small>
              {result && <p role="status" style={{ margin: 0, fontWeight: 600 }}>{result.text}</p>}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
