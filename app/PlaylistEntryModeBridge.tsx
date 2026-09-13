"use client";

import { useEffect, useState } from "react";
import PlaylistEntryModeSelector, { type PlaylistEntryMode } from "./PlaylistEntryMode";

export default function PlaylistEntryModeBridge() {
  const [mode, setMode] = useState<PlaylistEntryMode>("register");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const registerSection = document.querySelector<HTMLElement>("main .playlistSubmit[aria-labelledby='playlist-submit-title']");
    const autoSection = document.getElementById("auto-update-request");
    if (!registerSection || !autoSection) return;

    let host = document.getElementById("playlist-entry-mode-host");
    if (!host) {
      host = document.createElement("section");
      host.id = "playlist-entry-mode-host";
      host.className = "playlistSubmit";
      host.setAttribute("aria-label", "朝リストに追加・育てる");
      registerSection.parentElement?.insertBefore(host, registerSection);
    }
    setReady(true);

    const applyMode = (nextMode: PlaylistEntryMode) => {
      registerSection.hidden = nextMode === "autoExisting";
      autoSection.hidden = nextMode === "register";

      if (nextMode === "registerAndAuto" || nextMode === "autoExisting") {
        const toggle = autoSection.querySelector<HTMLButtonElement>(".autoUpdateToggle");
        const form = autoSection.querySelector<HTMLFormElement>(".autoUpdateForm");
        if (!form && toggle) toggle.click();
      }
    };

    applyMode(mode);
    return () => {
      registerSection.hidden = false;
      autoSection.hidden = false;
    };
  }, [mode]);

  useEffect(() => {
    if (!ready) return;
    const host = document.getElementById("playlist-entry-mode-host");
    if (!host) return;

    const marker = document.createElement("div");
    marker.className = "playlistEntryModeMount";
    host.replaceChildren(marker);

    import("react-dom/client").then(({ createRoot }) => {
      const root = createRoot(marker);
      root.render(
        <div className="playlistSubmitHead">
          <div>
            <p className="kicker">ADD / GROW A PLAYLIST</p>
            <h3>朝リストに追加・育てる</h3>
            <p>やりたいことを選ぶと、必要なフォームだけ表示します。</p>
            <PlaylistEntryModeSelector value={mode} onChange={setMode} />
            {mode === "registerAndAuto" && (
              <p className="submitNotice">まず登録情報と自動更新情報を続けて入力できます。2つをまとめて送る処理は次の段階で接続します。</p>
            )}
          </div>
        </div>
      );
      return () => root.unmount();
    });
  }, [mode, ready]);

  return null;
}
