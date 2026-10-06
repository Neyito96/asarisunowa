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
  const requestId = createRequestId();
  await fetch(endpoint, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...payload, requestId }),
  });

  for (const delay of [250, 500, 1000, 1500, 2500, 4000]) {
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

  throw new Error("送信は完了しましたが、受付確認に時間がかかっています。二重登録は防止されるため、少し待ってから状態をご確認ください。");
}

export function submitPlaylistRegistrationConfirmed(endpoint: string, payload: PlaylistRegistrationPayload) {
  return submitRequestConfirmed(endpoint, payload, "playlistRequestStatus");
}

export function submitAutoUpdateRequestConfirmed(endpoint: string, payload: AutoUpdatePayload) {
  return submitRequestConfirmed(endpoint, payload, "autoUpdateRequestStatus");
}


export async function submitCombinedAutoUpdateConfirmed(
  endpoint: string,
  registration: PlaylistRegistrationPayload,
  autoUpdate: AutoUpdatePayload,
) {
  // 2件を先にPOSTする。従来は「登録の受付確認」が終わるまでAUTO申請を
  // 送らなかったため、JSONP確認待ちが直列になっていた。
  // 保存先は別シートで、各requestIdの受付確認・重複防止は従来どおり維持する。
  const results = await Promise.allSettled([
    submitRequestConfirmed(endpoint, registration, "playlistRequestStatus"),
    submitRequestConfirmed(endpoint, autoUpdate, "autoUpdateRequestStatus"),
  ]);

  const registrationOk = results[0].status === "fulfilled";
  const autoUpdateOk = results[1].status === "fulfilled";

  if (registrationOk && autoUpdateOk) return;

  if (registrationOk && !autoUpdateOk) {
    throw new Error(
      "プレイリスト登録は確認できましたが、自動更新申請の受付確認に時間がかかっています。二重登録は防止されるため、少し待ってから状態をご確認ください。",
    );
  }

  if (!registrationOk && autoUpdateOk) {
    throw new Error(
      "自動更新申請は確認できましたが、プレイリスト登録の受付確認に時間がかかっています。二重登録は防止されるため、少し待ってから状態をご確認ください。",
    );
  }

  const firstError = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  throw firstError?.reason instanceof Error
    ? firstError.reason
    : new Error("送信は完了しましたが、受付確認に時間がかかっています。少し待ってから状態をご確認ください。");
}
