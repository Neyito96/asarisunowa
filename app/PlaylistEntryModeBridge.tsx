"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PlaylistEntryModeSelector, { type PlaylistEntryMode } from "./PlaylistEntryMode";

export default function PlaylistEntryModeBridge() {
  const [mode, setMode] = useState<PlaylistEntryMode>("register");
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const registerSection = document.querySelector<HTMLElement>("main .playlistSubmit[aria-labelledby='playlist-submit-title']");
    const autoSection = document.getElementById("auto-update-request");
    if (!registerSection || !autoSection) return;

    let mount = document.getElementById("playlist-entry-mode-host") as HTMLElement | null;
    if (!mount) {
      mount = document.createElement("section");
      mount.id = "playlist-entry-mode-host";
      mount.className = "playlistSubmit";
      mount.setAttribute("aria-label", "朝リストに追加・育てる");
      registerSection.parentElement?.insertBefore(mount, registerSection);
    }
    setHost(mount);

    registerSection.hidden = false;
    autoSection.hidden = true;

    return () => {
      registerSection.hidden = false;
      autoSection.hidden = false;
      mount?.remove();
    };
  }, []);

  useEffect(() => {
    const registerSection = document.querySelector<HTMLElement>("main .playlistSubmit[aria-labelledby='playlist-submit-title']");
    const autoSection = document.getElementById("auto-update-request");
    if (!registerSection || !autoSection) return;

    if (mode === "register") {
      registerSection.hidden = false;
      autoSection.hidden = true;
      return;
    }

    if (mode === "autoExisting") {
      registerSection.hidden = true;
      autoSection.hidden = false;
      const toggle = autoSection.querySelector<HTMLButtonElement>(".autoUpdateToggle");
      const form = autoSection.querySelector<HTMLFormElement>(".autoUpdateForm");
      if (!form && toggle) toggle.click();
    }
  }, [mode]);

  if (!host) return null;

  return createPortal(
    <div className="playlistSubmitHead">
      <div>
        <p className="kicker">ADD / GROW A PLAYLIST</p>
        <h3>朝リストに追加・育てる</h3>
        <p>やりたいことを選ぶと、必要なフォームだけ表示します。</p>
        <PlaylistEntryModeSelector
          value={mode}
          onChange={setMode}
          disabledModes={["registerAndAuto"]}
        />
        <p className="submitNotice">
          「登録して、自動更新も申し込む」は、入力を一度で済ませる送信処理を次の段階で接続します。
        </p>
      </div>
    </div>,
    host,
  );
}
