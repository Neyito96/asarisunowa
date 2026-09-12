// API共通補助

function normalizeUrl(url) {
  return String(
    url || ""
  )
    .trim()
    .split("?")[0]
    .replace(
      /\/+$/,
      ""
    );
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
