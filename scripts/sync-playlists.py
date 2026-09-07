from pathlib import Path
import csv
import json
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQHi9LM842wuiTT-N8FzgJXVFyY4W5sZRYEdp4a9OVBTgVBJgPWG52AK6sgH4qBciqB6Q5UAd2-n2bA/pub?gid=697105746&single=true&output=csv"

# 外部CDNの読み込みが不安定な項目は、GitHub Pages内に保存した
# 公式アートワークを使う。スプレッドシート同期後もこの指定を保つ。
LOCAL_ARTWORK_BY_URL = {
    "https://music.youtube.com/playlist?list=PLW_Nbzh9Y-J8PPlwXSOvfANQz4Xf39BBi":
        "./playlist-artwork/basukura.jpg",
}

def normalize_url(value):
    value = value.strip()
    if not value:
        return None

    parsed = urllib.parse.urlparse(value)
    if parsed.netloc == "open.spotify.com" and parsed.path.startswith("/playlist/"):
        return f"https://open.spotify.com{parsed.path}"

    if parsed.netloc == "music.youtube.com" and parsed.path == "/playlist":
        playlist_id = urllib.parse.parse_qs(parsed.query).get("list", [""])[0]
        if playlist_id:
            return f"https://music.youtube.com/playlist?list={playlist_id}"

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

        return thumbnail_url
    except Exception as error:
        print(f"注意：画像を取得できませんでした: {url} ({error})")
        return None

with urllib.request.urlopen(CSV_URL, timeout=30) as response:
    lines = response.read().decode("utf-8-sig").splitlines()

table = list(csv.reader(lines))
expected = ["Spotifyプレイリストのリンク", "公開プレイリスト", "プロフィール"]

if not table or table[0][:3] != expected:
    raise SystemExit("停止：スプレッドシートの見出しが想定と異なります")

base_rows = []
for source in table[1:]:
    source += [""] * (3 - len(source))
    raw_url, title, maker = (value.strip() for value in source[:3])

    if not title:
        continue

    base_rows.append([title, maker, normalize_url(raw_url)])

if len(base_rows) < 10:
    raise SystemExit(f"停止：取得件数が少なすぎます（{len(base_rows)}件）")

with ThreadPoolExecutor(max_workers=6) as executor:
    artworks = list(executor.map(
        get_artwork,
        [
            None if row[2] in LOCAL_ARTWORK_BY_URL else row[2]
            for row in base_rows
        ],
    ))

rows = [
    [title, maker, url, LOCAL_ARTWORK_BY_URL.get(url, artwork)]
    for (title, maker, url), artwork in zip(base_rows, artworks)
]

output = (
    "export type Playlist = { "
    "id:string; title:string; maker:string; "
    "url:string|null; artwork:string|null "
    "};\n"
    + "const rows:[string,string,string|null,string|null][] = "
    + json.dumps(rows, ensure_ascii=False, indent=2)
    + ";\n"
    + "export const playlists:Playlist[] = rows.map((r,i)=>"
      "({id:String(i+1),title:r[0],maker:r[1],url:r[2],artwork:r[3]}));\n"
)

Path("app/data.ts").write_text(output, encoding="utf-8")
print(f"成功：{len(rows)}件の情報とアートワークを読み込みました")
