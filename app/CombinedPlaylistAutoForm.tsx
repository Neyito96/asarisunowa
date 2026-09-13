"use client";

import { useState } from "react";

const PLAYLIST_SUBMIT_ENDPOINT = "https://script.google.com/macros/s/AKfycbxlZCNqGqOEY7j61OgcSGM8_xfGT08f4jjamXtSj2DES9fXl-xwJrvcRGYHnskidjIMug/exec";

type AutoType = "series" | "speaker" | "theme";
type Status = "idle" | "sending" | "success" | "error";

export default function CombinedPlaylistAutoForm() {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [maker, setMaker] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [autoType, setAutoType] = useState<AutoType>("series");
  const [keywords, setKeywords] = useState("");
  const [ruleNote, setRuleNote] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanUrl = url.trim();
    if (!cleanUrl.includes("open.spotify.com/playlist/")) {
      setStatus("error");
      setMessage("自動更新の申請はSpotifyプレイリストのみ対応しています。");
      return;
    }
    if (securityAnswer.trim() !== "大介") {
      setStatus("error");
      setMessage("合言葉が違います。「神田さんの名は？」をもう一度どうぞ。");
      return;
    }

    setStatus("sending");
    setMessage("");

    const commonRequest = {
      method: "POST",
      mode: "no-cors" as const,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
    };

    let registrationSent = false;
    try {
      await fetch(PLAYLIST_SUBMIT_ENDPOINT, {
        ...commonRequest,
        body: JSON.stringify({
          kind: "playlist",
          url: cleanUrl,
          title: title.trim(),
          maker: maker.trim(),
          comment: "",
          introducedDate: "",
          securityAnswer: securityAnswer.trim(),
          website,
        }),
      });
      registrationSent = true;

      await fetch(PLAYLIST_SUBMIT_ENDPOINT, {
        ...commonRequest,
        body: JSON.stringify({
          kind: "autoUpdateRequest",
          updateType: autoType,
          url: cleanUrl,
          title: title.trim(),
          maker: maker.trim(),
          inviteUrl: inviteUrl.trim(),
          keywords: keywords.trim(),
          ruleNote: ruleNote.trim(),
          securityAnswer: securityAnswer.trim(),
          website,
        }),
      });

      setStatus("success");
      setMessage("朝リストへの登録と、自動更新の申請を受け付けました。確認後に設定します。");
      setUrl("");
      setTitle("");
      setMaker("");
      setInviteUrl("");
      setAutoType("series");
      setKeywords("");
      setRuleNote("");
      setSecurityAnswer("");
      setWebsite("");
    } catch {
      setStatus("error");
      setMessage(
        registrationSent
          ? "朝リスト登録は送信しましたが、自動更新申請の送信に失敗しました。時間をおいて『登録済みを自動更新にする』から申請してください。"
          : "送信できませんでした。時間をおいてもう一度お試しください。",
      );
    }
  }

  return (
    <section className="playlistSubmit" aria-labelledby="combined-playlist-submit-title">
      <div className="playlistSubmitHead">
        <div>
          <p className="kicker">ADD + AUTO UPDATE</p>
          <h3 id="combined-playlist-submit-title">登録して、自動更新も申し込む</h3>
          <p>Spotifyプレイリストを朝リストに登録し、続けて自動更新の申請も送ります。</p>
        </div>
      </div>
      <form onSubmit={submit}>
        <label>
          <span>SpotifyプレイリストURL</span>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://open.spotify.com/playlist/..." required />
        </label>
        <label>
          <span>タイトル</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
        </label>
        <label>
          <span>朝リスネーム</span>
          <input type="text" value={maker} onChange={(e) => setMaker(e.target.value)} maxLength={80} required />
        </label>
        <label>
          <span>Spotify 共同編集者招待URL</span>
          <input type="url" value={inviteUrl} onChange={(e) => setInviteUrl(e.target.value)} placeholder="Spotifyで発行した共同編集者の招待リンク" required />
        </label>
        <fieldset className="autoUpdateTypes">
          <legend>どんなプレイリスト？</legend>
          <label><input type="radio" name="combinedAutoType" checked={autoType === "series"} onChange={() => setAutoType("series")} /><span><b>📻 シリーズ別</b><small>例：一緒に新聞をめくろう！</small></span></label>
          <label><input type="radio" name="combinedAutoType" checked={autoType === "speaker"} onChange={() => setAutoType("speaker")} /><span><b>🎙️ 出演者別</b><small>例：宮沢賢一さん出演回</small></span></label>
          <label><input type="radio" name="combinedAutoType" checked={autoType === "theme"} onChange={() => setAutoType("theme")} /><span><b>🔎 テーマ別</b><small>例：中東・鉄道・教育</small></span></label>
        </fieldset>
        <label>
          <span>{autoType === "series" ? "シリーズ名・キーワード" : autoType === "speaker" ? "出演者名" : "テーマのキーワード"}</span>
          <textarea value={keywords} onChange={(e) => setKeywords(e.target.value)} rows={autoType === "speaker" ? 2 : 3} required />
          <small>{autoType === "speaker" ? "タイトルや概要欄に出演者名がある回を探すために使います。" : "複数ある場合は改行か「,」で区切ってください。"}</small>
        </label>
        <label>
          <span>更新ルール・補足 <small>（任意）</small></span>
          <textarea value={ruleNote} onChange={(e) => setRuleNote(e.target.value)} rows={3} />
        </label>
        <label>
          <span>セキュリティ：神田さんの名は？</span>
          <input type="text" value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} placeholder="漢字2文字" maxLength={10} autoComplete="off" required />
        </label>
        <label className="submitHoneypot" aria-hidden="true">
          <span>website</span>
          <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
        <button type="submit" disabled={status === "sending"}>{status === "sending" ? "送信中…" : "登録＋自動更新を申し込む"}</button>
        {message && <p className={status === "success" ? "submitNotice success" : "submitNotice error"}>{message}</p>}
      </form>
    </section>
  );
}
