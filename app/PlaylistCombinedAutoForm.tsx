"use client";

import { useState } from "react";
import {
  isSpotifyCollaborativeInviteUrl,
  isSpotifyPlaylistUrl,
  submitAutoUpdateRequestConfirmed,
} from "./autoUpdateSubmit";

const PLAYLIST_SUBMIT_ENDPOINT = "https://script.google.com/macros/s/AKfycbxlZCNqGqOEY7j61OgcSGM8_xfGT08f4jjamXtSj2DES9fXl-xwJrvcRGYHnskidjIMug/exec";

type AutoUpdateType = "series" | "speaker" | "theme";
type SubmitStatus = "idle" | "sending" | "success" | "error";

async function postPayload(payload: Record<string, string>) {
  await fetch(PLAYLIST_SUBMIT_ENDPOINT, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
}

export default function PlaylistCombinedAutoForm() {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [maker, setMaker] = useState("");
  const [updateType, setUpdateType] = useState<AutoUpdateType>("series");
  const [inviteUrl, setInviteUrl] = useState("");
  const [keywords, setKeywords] = useState("");
  const [ruleNote, setRuleNote] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanUrl = url.trim();
    const cleanTitle = title.trim();
    const cleanMaker = maker.trim();
    const cleanInviteUrl = inviteUrl.trim();
    const cleanKeywords = keywords.trim();
    const cleanSecurityAnswer = securityAnswer.trim();

    if (!isSpotifyPlaylistUrl(cleanUrl)) {
      setStatus("error");
      setMessage("自動更新を申し込む場合は、SpotifyプレイリストURLを入力してください。");
      return;
    }
    if (!isSpotifyCollaborativeInviteUrl(cleanInviteUrl, cleanUrl)) {
      setStatus("error");
      setMessage("Spotifyの「共同編集者を招待」で発行したURLを貼ってください。");
      return;
    }
    if (cleanSecurityAnswer !== "大介") {
      setStatus("error");
      setMessage("合言葉が違います。「神田さんの名は？」をもう一度どうぞ。");
      return;
    }

    setStatus("sending");
    setMessage("");
    let registrationSent = false;

    try {
      await postPayload({
        kind: "playlist",
        updateType,
        url: cleanUrl,
        title: cleanTitle,
        maker: cleanMaker,
        comment: "",
        introducedDate: "",
        securityAnswer: cleanSecurityAnswer,
        website,
      });
      registrationSent = true;

      await submitAutoUpdateRequestConfirmed(PLAYLIST_SUBMIT_ENDPOINT, {
        kind: "autoUpdateRequest",
        updateType,
        url: cleanUrl,
        title: cleanTitle,
        maker: cleanMaker,
        inviteUrl: cleanInviteUrl,
        keywords: cleanKeywords,
        ruleNote: ruleNote.trim(),
        securityAnswer: cleanSecurityAnswer,
        website,
      });

      setStatus("success");
      setMessage("申請を受け付けました。Spotifyの初回補完は共同編集確認後、通常は数分後に始まり、最初に最大100件追加します。100件を超える分は翌朝以降、毎朝4〜5時に最大100件ずつ追加します。朝リスの田への掲載は通常1時間以内、長くても約90分です。");
      setUrl("");
      setTitle("");
      setMaker("");
      setUpdateType("series");
      setInviteUrl("");
      setKeywords("");
      setRuleNote("");
      setSecurityAnswer("");
      setWebsite("");
    } catch (error) {
      setStatus("error");
      setMessage(
        registrationSent
          ? "プレイリスト登録は送信しましたが、自動更新申請の受付を確認できませんでした。時間をおいて『今あるリストを育てる』から申請してください。"
          : error instanceof Error
          ? error.message
          : "送信できませんでした。時間をおいてもう一度お試しください。",
      );
    }
  }

  return (
    <form className="autoUpdateForm" onSubmit={submit}>
      <h3>登録＋自動更新を申し込む</h3>
      <p>まずSpotifyで新しいプレイリストを作り、起点となる一番古いエピソードを1本入れてください。その後、この画面から申請してください。</p>

      <label>
        <span>SpotifyプレイリストURL</span>
        <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://open.spotify.com/playlist/..." required />
      </label>
      <label>
        <span>タイトル</span>
        <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="プレイリスト名" maxLength={120} required />
      </label>
      <label>
        <span>プレイリスト制作者</span>
        <input type="text" value={maker} onChange={(event) => setMaker(event.target.value)} placeholder="朝リスネーム または 朝日新聞ポッドキャスト" maxLength={80} required />
      </label>

      <fieldset className="autoUpdateTypes">
        <legend>どんなプレイリスト？</legend>
        <label><input type="radio" name="combinedAutoUpdateType" checked={updateType === "series"} onChange={() => setUpdateType("series")} /><span><b>📻 連載・シリーズ</b><small>同じシリーズの回をまとめる　例：一緒に新聞をめくろう！</small></span></label>
        <label><input type="radio" name="combinedAutoUpdateType" checked={updateType === "speaker"} onChange={() => setUpdateType("speaker")} /><span><b>🎙️ 出演者別</b><small>例：宮沢賢一さん出演回</small></span></label>
        <label><input type="radio" name="combinedAutoUpdateType" checked={updateType === "theme"} onChange={() => setUpdateType("theme")} /><span><b>🔎 テーマ別</b><small>例：中東・鉄道・教育</small></span></label>
      </fieldset>

      <label>
        <span>Spotify 共同編集者招待URL</span>
        <input type="url" value={inviteUrl} onChange={(event) => setInviteUrl(event.target.value)} placeholder="Spotifyで発行した共同編集者の招待リンク" required />
        <small>対象プレイリストを開き「共同編集者を招待」から発行したリンクを貼ってください。</small>
      </label>
      <label>
        <span>{updateType === "series" ? "連載・シリーズ名／キーワード" : updateType === "speaker" ? "出演者名" : "テーマのキーワード"}</span>
        <textarea value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder={updateType === "series" ? "例：めくろう\n一緒に新聞をめくろう" : updateType === "speaker" ? "例：宮沢賢一" : "例：中東\nイスラエル\nパレスチナ\nイラン"} rows={updateType === "speaker" ? 2 : 3} required />
      </label>
      <div className="autoUpdateCommonRule">
        <b>自動更新について</b>
        <p>起点の回から現在までの不足回を古い順に補い、完了後は毎朝、新着回だけを確認して追加します。</p>
      </div>
      <div className="autoUpdateAfterSubmit">
        <b>申請後</b>
        <p><b>Spotify：</b>共同編集の確認後、通常は数分で更新します。初回は最大100件、残りは翌朝4〜5時に追加します。</p>
        <p><b>朝リスの田：</b>通常は1時間以内に掲載します。</p>
        <small>掲載後も初回補完が続いている場合があります。Spotifyの内容は翌朝の処理後に増えることがあります。</small>
      </div>
      <label>
        <span>更新ルール・補足 <small>（任意）</small></span>
        <textarea value={ruleNote} onChange={(event) => setRuleNote(event.target.value)} placeholder="標準の自動更新と違う希望があれば入力してください" rows={3} />
      </label>
      <label>
        <span>セキュリティ：神田さんの名は？</span>
        <input type="text" value={securityAnswer} onChange={(event) => setSecurityAnswer(event.target.value)} placeholder="漢字2文字" maxLength={10} autoComplete="off" required />
      </label>
      <label className="submitHoneypot" aria-hidden="true">
        <span>website</span>
        <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
      </label>

      <button type="submit" disabled={status === "sending"}>{status === "sending" ? "送信中…" : "登録＋自動更新を申し込む"}</button>
      {message && <p aria-live="polite" className={status === "success" ? "submitNotice success" : "submitNotice error"}>{message}</p>}
    </form>
  );
}
