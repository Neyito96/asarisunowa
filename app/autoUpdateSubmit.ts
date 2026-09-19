export type AutoUpdatePayload = {
  kind: "autoUpdateRequest";
  updateType: "series" | "speaker" | "theme";
  url: string;
  title: string;
  maker: string;
  inviteUrl: string;
  keywords: string;
  ruleNote: string;
  securityAnswer: string;
  website: string;
};

export type PlaylistRegistrationPayload = {
  kind: "playlist";
  updateType: "series" | "speaker" | "theme";
  url: string;
  title: string;
  maker: string;
  inviteUrl: string;
  comment: string;
  introducedDate: string;
  securityAnswer: string;
  website: string;
};

export function isSpotifyPlaylistUrl(value: string) {
  return Boolean(spotifyPlaylistId(value));
}

function spotifyPlaylistId(value: string) {
  return value.trim().match(/^https:\/\/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)(?:[?#]|$)/i)?.[1] ?? "";
}

export function isSpotifyCollaborativeInviteUrl(value: string, playlistUrl?: string) {
  const clean = value.trim();
  const invitePlaylistId = spotifyPlaylistId(clean);
  return Boolean(
    invitePlaylistId &&
      /[?&]pt=[^&#]+/i.test(clean) &&
      (!playlistUrl || invitePlaylistId === spotifyPlaylistId(playlistUrl)),
  );
}

function createRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "_");
  }
  return "request_" + Date.now() + "_" + Math.random().toString(36).slice(2, 14);
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function loadJsonp<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const functionName = "__asarisunowa_receipt_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const globalWindow = window as unknown as Record<string, unknown>;
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("受付結果の確認がタイムアウトしました"));
    }, 5000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      script.remove();
      delete globalWindow[functionName];
    };
    globalWindow[functionName] = (payload: T) => {
      cleanup();
      resolve(payload);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("受付結果を確認できませんでした"));
    };
    script.src = url + (url.includes("?") ? "&" : "?") + "callback=" + encodeURIComponent(functionName);
    document.head.appendChild(script);
  });
}

async function submitRequestConfirmed(
  endpoint: string,
  payload: AutoUpdatePayload | PlaylistRegistrationPayload,
  statusType: "autoUpdateRequestStatus" | "playlistRequestStatus",
) {
  // Temporary pause: remove this guard when theme submissions reopen.
  if (payload.updateType === "theme") {
    throw new Error("テーマ別は現在、耕し中のため新規申請を受け付けていません。");
  }

  const requestId = createRequestId();
  await fetch(endpoint, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...payload, requestId }),
  });

  for (const delay of [250, 500, 1000, 1500]) {
    await wait(delay);
    try {
      const status = await loadJsonp<{ ok?: boolean; accepted?: boolean }>(
        endpoint + "?type=" + statusType + "&requestId=" + encodeURIComponent(requestId) + "&_=" + Date.now(),
      );
      if (status?.ok && status.accepted) return;
    } catch {
      // 一時的なJSONP読み込み失敗は、次の照会で再確認する。
    }
  }

  throw new Error("送信結果を確認できませんでした。入力内容を確認して、時間をおいてもう一度お試しください。");
}

export function submitPlaylistRegistrationConfirmed(endpoint: string, payload: PlaylistRegistrationPayload) {
  return submitRequestConfirmed(endpoint, payload, "playlistRequestStatus");
}

export function submitAutoUpdateRequestConfirmed(endpoint: string, payload: AutoUpdatePayload) {
  return submitRequestConfirmed(endpoint, payload, "autoUpdateRequestStatus");
}
