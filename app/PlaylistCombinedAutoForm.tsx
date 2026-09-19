"use client";

import { useState } from "react";
import {
  isSpotifyCollaborativeInviteUrl,
  isSpotifyPlaylistUrl,
  submitAutoUpdateRequestConfirmed,
  submitPlaylistRegistrationConfirmed,
} from "./autoUpdateSubmit";

const PLAYLIST_SUBMIT_ENDPOINT = "https://script.google.com/macros/s/AKfycbxlZCNqGqOEY7j61OgcSGM8_xfGT08f4jjamXtSj2DES9fXl-xwJrvcRGYHnskidjIMug/exec";

type AutoUpdateType = "series" | "speaker" | "theme";
type SubmitStatus = "idle" | "sending" | "success" | "error";

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

    // 一時停止中のテーマ別は、通常のプレイリスト登録も含め送信前に止める。
    if (updateType === "theme") {
      setStatus("error");
      setMessage("テーマ別は現在、耕し中のため新規受付を休止しています。");
      return;
    }

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
    let registrationConfirmed = false;

    try {
      await submitPlaylistRegistrationConfirmed(PLAYLIST_SUBMIT_ENDPOINT, {
        kind: "playlist",
        updateType,
        url: cleanUrl,
        title: cleanTitle,
        maker: cleanMaker,
        inviteUrl: cleanInviteUrl,
        comment: "",
        introducedDate: "",
        securityAnswer: cleanSecurityAnswer,
        website,
      });
      registrationConfirmed = true;

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
      setMessage(
        updateType === "theme"
          ? "登録と申請を受け付けました。テーマ別は内容を確認してから自動更新を開始します。朝リスの田への掲載は通常30〜60分程度です。"
          : "登録と申請を受け付けました🐿️ 共同編集確認後、Spotifyの初回分は1時間ごとに最大50件ずつ、古い回から順に追加します。完了後は毎朝4〜5時に新着回だけ確認します。朝リスの田への掲載は通常30〜60分程度です。",
      );
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
        registrationConfirmed
          ? "プレイリスト登録は確認できましたが、自動更新申請の受付を確認できませんでした。時間をおいて『今あるリストを自動更新』から申請してください。"
          : error instanceof Error
          ? error.message
          : "送信できませんでした。時間をおいてもう一度お試しください。",
      );
    }
  }

  return (
    <form className="autoUpdateForm" onSubmit={submit}>
      <h3>登録＋自動更新（楽育ち）を申し込む</h3>
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
        <label><input type="radio" name="combinedAutoUpdateType" checked={updateType === "theme"} onChange={() => setUpdateType("theme")} disabled /><span><b>🌱 テーマ別（耕し中）</b><small>新規受付は一時休止しています</small></span></label>
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
        <b>自動更新（楽育ち）について</b>
        <p>最初に入れた1本を目印に、そこから最新回までを古い順に追加します。準備が終わった後は、毎朝、新しい回がないか確認します。</p>
      </div>
      <div className="autoUpdateAfterSubmit">
        <strong className="autoUpdateGuideTitle">連載と朝リスト</strong>
        <div className="autoUpdateShelfGuide">
          <span><b>連載</b><small>同じシリーズ</small></span>
          <span><b>朝リスト</b><small>出演者・テーマ別</small></span>
        </div>
        <dl className="autoUpdateTimingGuide">
          <div><dt>初回</dt><dd>1時間ごとに最大50件、古い回から追加</dd></div>
          <div><dt>完了後</dt><dd>毎朝4〜5時に新着回だけ確認</dd></div>
          <div><dt>掲載</dt><dd>通常30〜60分</dd></div>
        </dl>
        <p className="autoUpdateThemeNote">※テーマ別は現在、耕し中のため新規受付を休止しています。</p>
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

      <button type="submit" disabled={status === "sending"}>{status === "sending" ? "送信中…" : "登録＋自動更新（楽育ち）を申し込む"}</button>
      {message && <p aria-live="polite" className={status === "success" ? "submitNotice success" : "submitNotice error"}>{message}</p>}
    </form>
  );
}
