"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PlaylistCombinedAutoForm from "./PlaylistCombinedAutoForm";
import PlaylistEntryModeSelector, { type PlaylistEntryMode } from "./PlaylistEntryMode";

export default function PlaylistEntryModeBridge() {
  const [mode, setMode] = useState<PlaylistEntryMode>("register");
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [sortHost, setSortHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let currentHost: HTMLElement | null = null;
    let currentSortHost: HTMLElement | null = null;

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
        mount.setAttribute("aria-label", "二次プレイリストを追加・育てる");
        registerSection.parentElement?.insertBefore(mount, registerSection);
      }

      if (currentHost !== mount) {
        currentHost = mount;
        setHost(mount);
      }

      const nextSortHost = document.querySelector<HTMLElement>(".sorts");
      if (nextSortHost && currentSortHost !== nextSortHost) {
        currentSortHost = nextSortHost;
        setSortHost(nextSortHost);
      }

      const legacyManagerButton = document.querySelector<HTMLButtonElement>(".playlistOwnerJump");
      if (legacyManagerButton) legacyManagerButton.hidden = true;
    };

    mountWhenReady();
    const observer = new MutationObserver(mountWhenReady);
    observer.observe(document.body, { childList: true, subtree: true });

    const handleManagerJump = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.closest(".playlistOwnerJump")) {
        setMode("autoExisting");
        window.setTimeout(() => {
          document.getElementById("playlist-entry-mode-host")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 0);
      }
    };
    document.addEventListener("click", handleManagerJump);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleManagerJump);
      const registerSection = document.querySelector<HTMLElement>(
        "main .playlistSubmit[aria-labelledby='playlist-submit-title']",
      );
      const autoSection = document.getElementById("auto-update-request");
      const legacyManagerButton = document.querySelector<HTMLButtonElement>(".playlistOwnerJump");
      if (registerSection) registerSection.hidden = false;
      if (autoSection) autoSection.hidden = false;
      if (legacyManagerButton) legacyManagerButton.hidden = false;
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

  const jumpToManagerForm = () => {
    setMode("autoExisting");
    window.setTimeout(() => {
      document.getElementById("playlist-entry-mode-host")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  return (
    <>
      {createPortal(
        <div>
          <div className="playlistSubmitHead">
            <div>
              <p className="kicker">SECONDARY PLAYLISTS</p>
              <h3>二次プレイリストを追加・育てる</h3>
              <p>
                朝公式の番組・一次プレイリストをもとに、テーマや出演者ごとの二次プレイリストを育てます。
              </p>
              <PlaylistEntryModeSelector value={mode} onChange={setMode} />
            </div>
          </div>
          {mode === "registerAndAuto" && <PlaylistCombinedAutoForm />}
        </div>,
        host,
      )}
      {sortHost?.isConnected
        ? createPortal(
            <button
              type="button"
              className="playlistManagerSortButton"
              onClick={jumpToManagerForm}
              aria-label="プレイリスト管理者向け・自動更新申請へ"
              title="プレイリスト管理者向け"
              style={{ marginLeft: "auto", borderColor: "#cc4b78", color: "#0b5874", fontWeight: 800 }}
            >
              ⚙️ プレイリスト管理者
            </button>,
            sortHost,
          )
        : null}
    </>
  );
}
