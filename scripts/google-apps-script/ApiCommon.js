// API共通補助

function normalizeUrl(url) {
  const clean = String(url || "").trim().replace(/#.*$/, "");
  const parts = clean.split("?");
  const base = String(parts.shift() || "").replace(/\/+$/, "");
  const query = parts.join("?");

  if (!query) {
    return base;
  }

  // Spotify等の共有用クエリは同一URL判定には不要だが、
  // YouTube / YouTube Music は list / v がコンテンツ識別子なので残す。
  if (/youtube\.com|youtu\.be/i.test(base)) {
    const keep = query
      .split("&")
      .filter(Boolean)
      .filter(function(part) {
        const key = String(part.split("=")[0] || "").toLowerCase();
        return key === "list" || key === "v";
      })
      .sort();

    return keep.length
      ? base + "?" + keep.join("&")
      : base;
  }

  return base;
}

function normalizeTitle(title) {
  return String(
    title || ""
  )
    .toLowerCase()
    .replace(
      /[\s　・･\-—–_()（）「」『』【】\[\]！!？?：:]/g,
      ""
    )
    .trim();
}

function isValidJsonpCallback_(callback) {
  return !callback || /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback);
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(
      JSON.stringify(
        payload
      )
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}

function apiResponse(payload, callback) {
  if (callback) {
    return ContentService
      .createTextOutput(
        callback +
        "(" +
        JSON.stringify(
          payload
        ) +
        ");"
      )
      .setMimeType(
        ContentService.MimeType.JAVASCRIPT
      );
  }

  return jsonResponse(
    payload
  );
}
