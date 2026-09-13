"use client";

import { useState } from "react";

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

    if (!/^https:\/\/open\.spotify\.com\/playlist\//i.test(cleanUrl)) {
      setStatus("error");
      setMessage("自動更新を申し込む場合は、SpotifyプレイリストURLを入力してください。");
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
        url: cleanUrl,
        title: cleanTitle,
        maker: cleanMaker,
        comment: "",
        introducedDate: "",
        securityAnswer: cleanSecurityAnswer,
        website,
      });
      registrationSent = true;

      await postPayload({
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
      setMessage("朝リスト登録と自動更新申請を送信しました。確認後、登録・設定を行います。");
      setUrl("");
      setTitle("");
      setMaker("");
      setUpdateType("series");
      setInviteUrl("");
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
    <form className="autoUpdateForm" onSubmit={submit}>
      <h3>登録＋自動更新を申し込む</h3>
      <p>新しいSpotifyプレイリストを朝リストへ登録し、同じ内容で自動更新も申請します。</p>

      <label>
        <span>SpotifyプレイリストURL</span>
        <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://open.spotify.com/playlist/..." required />
      </label>
      <label>
        <span>タイトル</span>
        <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="プレイリスト名" maxLength={120} required />
      </label>
      <label>
        <span>朝リスネーム</span>
        <input type="text" value={maker} onChange={(event) => setMaker(event.target.value)} placeholder="お名前・ハンドルネーム" maxLength={80} required />
      </label>

      <fieldset className="autoUpdateTypes">
        <legend>どんなプレイリスト？</legend>
        <label><input type="radio" name="combinedAutoUpdateType" checked={updateType === "series"} onChange={() => setUpdateType("series")} /><span><b>📻 シリーズ別</b><small>例：一緒に新聞をめくろう！</small></span></label>
        <label><input type="radio" name="combinedAutoUpdateType" checked={updateType === "speaker"} onChange={() => setUpdateType("speaker")} /><span><b>🎙️ 出演者別</b><small>例：宮沢賢一さん出演回</small></span></label>
        <label><input type="radio" name="combinedAutoUpdateType" checked={updateType === "theme"} onChange={() => setUpdateType("theme")} /><span><b>🔎 テーマ別</b><small>例：中東・鉄道・教育</small></span></label>
      </fieldset>

      <label>
        <span>Spotify 共同編集者招待URL</span>
        <input type="url" value={inviteUrl} onChange={(event) => setInviteUrl(event.target.value)} placeholder="Spotifyで発行した共同編集者の招待リンク" required />
        <small>対象プレイリストを開き「共同編集者を招待」から発行したリンクを貼ってください。</small>
      </label>
      <label>
        <span>{updateType === "series" ? "シリーズ名・キーワード" : updateType === "speaker" ? "出演者名" : "テーマのキーワード"}</span>
        <textarea value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder={updateType === "series" ? "例：めくろう\n一緒に新聞をめくろう" : updateType === "speaker" ? "例：宮沢賢一" : "例：中東\nイスラエル\nパレスチナ\nイラン"} rows={updateType === "speaker" ? 2 : 3} required />
      </label>
      <label>
        <span>更新ルール・補足 <small>（任意）</small></span>
        <textarea value={ruleNote} onChange={(event) => setRuleNote(event.target.value)} placeholder="例：新着回だけ追加。再配信や予告編は除外。" rows={3} />
      </label>
      <label>
        <span>セキュリティ：神田さんの名は？</span>
        <input type="text" value={securityAnswer} onChange={(event) => setSecurityAnswer(event.target.value)} placeholder="漢字2文字" maxLength={10} autoComplete="off" required />
      </label>
      <label className="submitHoneypot" aria-hidden="true">
        <span>website</span>
        <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
      </label>

      <button type="submit" disabled={status === "sending"}>{status === "sending" ? "2件を送信中…" : "登録＋自動更新を申し込む"}</button>
      {message && <p className={status === "success" ? "submitNotice success" : "submitNotice error"}>{message}</p>}
    </form>
  );
}
