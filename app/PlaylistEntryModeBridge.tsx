"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import CombinedPlaylistAutoForm from "./CombinedPlaylistAutoForm";
import PlaylistEntryModeSelector, { type PlaylistEntryMode } from "./PlaylistEntryMode";

export default function PlaylistEntryModeBridge() {
  const [mode, setMode] = useState<PlaylistEntryMode>("register");
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let currentHost: HTMLElement | null = null;

    const mountWhenReady = () => {
      const registerSection = document.querySelector<HTMLElement>(
        "main .playlistSubmit[aria-labelledby='playlist-submit-title']",
      );
      const autoSection = document.getElementById("auto-update-request");
      if (!registerSection || !autoSection) {
        if (currentHost && !currentHost.isConnected) {
          currentHost = null;
          setHost(null);
        }
        return;
      }

      let mount = document.getElementById("playlist-entry-mode-host") as HTMLElement | null;
      if (!mount) {
        mount = document.createElement("section");
        mount.id = "playlist-entry-mode-host";
        mount.className = "playlistSubmit";
        mount.setAttribute("aria-label", "朝リストに追加・育てる");
        registerSection.parentElement?.insertBefore(mount, registerSection);
      }

      if (currentHost !== mount) {
        currentHost = mount;
        setHost(mount);
      }
    };

    mountWhenReady();
    const observer = new MutationObserver(mountWhenReady);
    observer.observe(document.body, { childList: true, subtree: true });

    const handleManagerJump = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.closest(".playlistOwnerJump")) setMode("autoExisting");
    };
    document.addEventListener("click", handleManagerJump);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleManagerJump);
      const registerSection = document.querySelector<HTMLElement>(
        "main .playlistSubmit[aria-labelledby='playlist-submit-title']",
      );
      const autoSection = document.getElementById("auto-update-request");
      if (registerSection) registerSection.hidden = false;
      if (autoSection) autoSection.hidden = false;
      currentHost?.remove();
    };
  }, []);

  useEffect(() => {
    if (!host?.isConnected) return;

    const registerSection = document.querySelector<HTMLElement>(
      "main .playlistSubmit[aria-labelledby='playlist-submit-title']",
    );
    const autoSection = document.getElementById("auto-update-request");
    if (!registerSection || !autoSection) return;

    if (mode === "register") {
      registerSection.hidden = false;
      autoSection.hidden = true;
      return;
    }

    if (mode === "registerAndAuto") {
      registerSection.hidden = true;
      autoSection.hidden = true;
      return;
    }

    registerSection.hidden = true;
    autoSection.hidden = false;
    const toggle = autoSection.querySelector<HTMLButtonElement>(".autoUpdateToggle");
    const form = autoSection.querySelector<HTMLFormElement>(".autoUpdateForm");
    if (!form && toggle) toggle.click();
  }, [mode, host]);

  if (!host?.isConnected) return null;

  return createPortal(
    <div>
      <div className="playlistSubmitHead">
        <div>
          <p className="kicker">ADD / GROW A PLAYLIST</p>
          <h3>朝リストに追加・育てる</h3>
          <p>やりたいことを選ぶと、必要なフォームだけ表示します。</p>
          <PlaylistEntryModeSelector value={mode} onChange={setMode} />
        </div>
      </div>
      {mode === "registerAndAuto" && <CombinedPlaylistAutoForm />}
    </div>,
    host,
  );
}
