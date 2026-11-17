"use client";
// ポすすめカードに足す欄（#312）: 「🎙 紹介された回」「✨ ポす神回」「この番組のポす神回を教える」
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
} from "./posukami";

type Props = {
  podcast: { id: string; title: string };
  card?: PosukamiCard;
  submitEnabled: boolean;
  endpoint: string;
  loadJsonp: (url: string) => Promise<unknown>;
};

const linkStyle = { textDecoration: "underline", textUnderlineOffset: "0.18em" } as const;
const noteStyle = { display: "block", opacity: 0.8 } as const;

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
  const specials = card?.specials || [];
  if (!intros.length && !specials.length && !submitEnabled) return null;

  return (
    <div className="posukamiSection">
      {intros.map((episode) => (
        <p className="podcastComment posukamiIntro" key={"intro-" + episode.href} style={{ marginTop: "0.45rem" }}>
          <strong>🎙 {episode.program && episode.program !== "ドーナツ" ? "朝ポキで紹介された回" : "ドーナツで紹介された回"}</strong><br />
          <span>「{episode.title}」</span>
          <small style={noteStyle}>{formatPosukamiDate(episode.date)}{episode.program && episode.program !== "ドーナツ" ? "（" + episode.program + "）" : ""}</small>
          <a href={posukamiHref(episode.href)} {...(episode.library ? {} : { target: "_blank", rel: "noopener noreferrer" })} style={linkStyle}>
            {episode.library ? "→ 朝ポキの蔵でこの回を見る" : "→ この回を聴く（公式ページ）"}
          </a>
          {!episode.library && <small style={noteStyle}>朝ポキの蔵への収蔵は更新待ちです</small>}
        </p>
      ))}
      {specials.map((episode) => (
        <p className="podcastComment posukamiSpecial" key={"special-" + episode.href} style={{ marginTop: "0.45rem" }}>
          <strong>✨ ポす神回</strong>
          {isPosukamiNew(episode.verifiedAt) && <span className="newBadge newBadgeActive" style={{ marginLeft: "0.4rem" }}>NEW</span>}
          <br />
          <span>「{episode.title}」</span>
          <small style={noteStyle}>{[episode.program, formatPosukamiDate(episode.date)].filter(Boolean).join("・")}{episode.relation ? "　" + episode.relation : ""}</small>
          <a href={posukamiHref(episode.href)} {...(episode.library ? {} : { target: "_blank", rel: "noopener noreferrer" })} style={linkStyle}>
            {episode.library ? "→ 朝ポキの蔵でこの回を見る" : "→ この回を聴く"}
          </a>
        </p>
      ))}
      {submitEnabled && (
        <div className="posukamiSubmit" style={{ marginTop: "0.5rem" }}>
          <button type="button" className="posukamiSubmitToggle" aria-expanded={open} aria-controls={formId} onClick={() => setOpen((v) => !v)} style={{ fontSize: "0.85rem" }}>
            {open ? "閉じる" : "✨ この番組のポす神回を教える"}
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
