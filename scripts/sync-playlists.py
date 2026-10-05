from pathlib import Path
import csv
import json
import urllib.parse
import urllib.request
import re
from concurrent.futures import ThreadPoolExecutor

CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQHi9LM842wuiTT-N8FzgJXVFyY4W5sZRYEdp4a9OVBTgVBJgPWG52AK6sgH4qBciqB6Q5UAd2-n2bA/pub?gid=697105746&single=true&output=csv"

# 外部CDNの読み込みが不安定な項目は、GitHub Pages内に保存した
# 公式アートワークを使う。スプレッドシート同期後もこの指定を保つ。
LOCAL_ARTWORK_BY_URL = {
    "https://open.spotify.com/playlist/4FBXSFf2nLjLb3qaRoSdoD":
        "https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1f4ea26c84e38a43b8859df430",
    "https://open.spotify.com/playlist/6nDhZQG75F1wU62sdcYJMq":
        "https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1f7c49378fc19b81c6f0f72987",
    "https://open.spotify.com/playlist/4tY0lHoV8IemMBp4iTnKnl":
        "https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1f2b3a4e572f8666f2bb05c46c",
    "https://open.spotify.com/playlist/6hNrobOVHmYaQT5C7hPkNa":
        "https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1f09a8bd5875be5defced61b26",
    "https://music.youtube.com/playlist?list=PLW_Nbzh9Y-J8PPlwXSOvfANQz4Xf39BBi":
        "./playlist-artwork/basukura.jpg",
}

def normalize_url(value):
    value = value.strip()
    if not value:
        return None

    parsed = urllib.parse.urlparse(value)
    if parsed.netloc == "open.spotify.com" and (
        parsed.path.startswith("/playlist/") or parsed.path.startswith("/show/")
    ):
        return f"https://open.spotify.com{parsed.path}"

    if parsed.netloc == "music.youtube.com" and parsed.path == "/playlist":
        playlist_id = urllib.parse.parse_qs(parsed.query).get("list", [""])[0]
        if playlist_id:
            return f"https://music.youtube.com/playlist?list={playlist_id}"

    return None

def read_existing_artwork_by_url():
    path = Path("app/data.ts")
    if not path.exists():
        return {}
    text = path.read_text(encoding="utf-8")
    match = re.search(r"const rows:\[string,string,string\|null,string\|null\]\[] = (\[.*?\]);", text, re.S)
    if not match:
        return {}
    try:
        existing_rows = json.loads(match.group(1))
    except Exception:
        return {}
    return {
        row[2]: row[3]
        for row in existing_rows
        if len(row) >= 4 and row[2] and row[3]
    }

def get_spotify_page_artwork(url):
    try:
        request = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 asarisunowa-artwork-sync/1.1"},
        )
        with urllib.request.urlopen(request, timeout=20) as response:
            html = response.read().decode("utf-8", errors="ignore")
        patterns = [
            r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
            r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
        ]
        for pattern in patterns:
            found = re.search(pattern, html, re.I)
            if found:
                return found.group(1)
    except Exception as error:
        print(f"注意：Spotifyページ画像を取得できませんでした: {url} ({error})")
    return None

def get_artwork(url):
    if not url:
        return None

    try:
        if "music.youtube.com" in url:
            # YouTube Music の公開プレイリストも、画像は YouTube 公式の
            # oEmbed エンドポイントから取得する。oEmbed へ渡す URL は
            # YouTube 標準形のほうが安定して認識される。
            parsed = urllib.parse.urlparse(url)
            playlist_id = urllib.parse.parse_qs(parsed.query).get("list", [""])[0]
            oembed_url = f"https://www.youtube.com/playlist?list={playlist_id}"
            endpoint = (
                "https://www.youtube.com/oembed?format=json&url="
                + urllib.parse.quote(oembed_url, safe="")
            )
        else:
            endpoint = (
                "https://open.spotify.com/oembed?url="
                + urllib.parse.quote(url, safe="")
            )
        request = urllib.request.Request(
            endpoint,
            headers={"User-Agent": "asarisunowa-artwork-sync/1.0"},
        )
        with urllib.request.urlopen(request, timeout=20) as response:
            thumbnail_url = json.load(response).get("thumbnail_url")

        if "music.youtube.com" in url and thumbnail_url:
            thumbnail_host = urllib.parse.urlparse(thumbnail_url).hostname or ""
            if thumbnail_host not in {"i.ytimg.com", "img.youtube.com"}:
                raise ValueError("YouTube公式以外の画像URLが返されました")

        if thumbnail_url:
            return thumbnail_url
        if "open.spotify.com" in url:
            return get_spotify_page_artwork(url)
        return None
    except Exception as error:
        print(f"注意：画像を取得できませんでした: {url} ({error})")
        if "open.spotify.com" in url:
            return get_spotify_page_artwork(url)
        return None

with urllib.request.urlopen(CSV_URL, timeout=30) as response:
    lines = response.read().decode("utf-8-sig").splitlines()

table = list(csv.reader(lines))
expected = ["Spotifyプレイリストのリンク", "公開プレイリスト", "プロフィール"]

if not table or table[0][:3] != expected:
    raise SystemExit("停止：スプレッドシートの見出しが想定と異なります")

base_rows = []
for source in table[1:]:
    source += [""] * (5 - len(source))
    raw_url, title, maker, latest_date, introduced_date = (
        value.strip() for value in source[:5]
    )

    if not title:
        continue

    base_rows.append([
        title,
        maker,
        normalize_url(raw_url),
        latest_date or None,
        introduced_date or None,
    ])

if len(base_rows) < 10:
    raise SystemExit(f"停止：取得件数が少なすぎます（{len(base_rows)}件）")

existing_artwork_by_url = read_existing_artwork_by_url()

with ThreadPoolExecutor(max_workers=6) as executor:
    artworks = list(executor.map(
        get_artwork,
        [
            None if row[2] in LOCAL_ARTWORK_BY_URL else row[2]
            for row in base_rows
        ],
    ))

rows = [
    [
        title,
        maker,
        url,
        LOCAL_ARTWORK_BY_URL.get(url)
        or artwork
        or existing_artwork_by_url.get(url),
        latest_date,
        introduced_date,
    ]
    for (title, maker, url, latest_date, introduced_date), artwork in zip(base_rows, artworks)
]

output = (
    "export type Playlist = {\n"
    "  id: string;\n"
    "  title: string;\n"
    "  maker: string;\n"
    "  url: string | null;\n"
    "  artwork: string | null;\n"
    "  latestDate?: string | null;\n"
    "  introducedDate?: string | null;\n"
    "  autoManaged?: boolean;\n"
    "};\n"
    + "const rows:[string,string,string|null,string|null,string|null,string|null][] = "
    + json.dumps(rows, ensure_ascii=False, indent=2)
    + ";\n"
    + "export const playlists:Playlist[] = rows.map((r,i)=>"
      "({id:String(i+1),title:r[0],maker:r[1],url:r[2],artwork:r[3],latestDate:r[4],introducedDate:r[5]}));\n"
)

Path("app/data.ts").write_text(output, encoding="utf-8")
print(f"成功：{len(rows)}件の情報とアートワークを読み込みました")
