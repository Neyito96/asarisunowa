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

export function isSpotifyPlaylistUrl(value: string) {
  return /^https:\/\/open\.spotify\.com\/playlist\/[A-Za-z0-9]+(?:[?/#]|$)/i.test(value.trim());
}

export function isSpotifyCollaborativeInviteUrl(value: string) {
  const clean = value.trim();
  return isSpotifyPlaylistUrl(clean) && /[?&]pt=[^&#]+/i.test(clean);
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
    const cleanup = () => {
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

export async function submitAutoUpdateRequestConfirmed(endpoint: string, payload: AutoUpdatePayload) {
  const requestId = createRequestId();
  await fetch(endpoint, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...payload, requestId }),
  });

  for (const delay of [250, 500, 1000, 1500]) {
    await wait(delay);
    const status = await loadJsonp<{ ok?: boolean; accepted?: boolean }>(
      endpoint + "?type=autoUpdateRequestStatus&requestId=" + encodeURIComponent(requestId) + "&_=" + Date.now(),
    );
    if (status?.ok && status.accepted) return;
  }

  throw new Error("送信結果を確認できませんでした。入力内容を確認して、時間をおいてもう一度お試しください。");
}
