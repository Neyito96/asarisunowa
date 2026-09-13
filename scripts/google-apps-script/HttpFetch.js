// HTTP取得の共通補助

function fetchJson(url) {
  try {
    const res =
      UrlFetchApp.fetch(
        url,
        {
          muteHttpExceptions:
            true,
          followRedirects:
            true,
          headers: {
            "User-Agent":
              "Mozilla/5.0"
          }
        }
      );

    if (
      res.getResponseCode() < 200 ||
      res.getResponseCode() >= 400
    ) {
      return null;
    }

    return JSON.parse(
      res.getContentText()
    );

  } catch (_) {
    return null;
  }
}

function fetchText(url) {
  try {
    const res =
      UrlFetchApp.fetch(
        url,
        {
          muteHttpExceptions:
            true,
          followRedirects:
            true,
          headers: {
            "User-Agent":
              "Mozilla/5.0"
          }
        }
      );

    if (
      res.getResponseCode() < 200 ||
      res.getResponseCode() >= 400
    ) {
      return "";
    }

    return res.getContentText();

  } catch (_) {
    return "";
  }
}
