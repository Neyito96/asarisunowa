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

    registerSection.hidden = mode === "autoExisting";
    autoSection.hidden = mode === "register";

    if (mode === "registerAndAuto" || mode === "autoExisting") {
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
        <PlaylistEntryModeSelector value={mode} onChange={setMode} />
        {mode === "registerAndAuto" && (
          <p className="submitNotice">
            登録情報と自動更新情報を続けて入力できます。2つをまとめて送る処理は次の段階で接続します。
          </p>
        )}
      </div>
    </div>,
    host,
  );
}
