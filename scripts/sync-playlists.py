from pathlib import Path
import csv
import json
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQHi9LM842wuiTT-N8FzgJXVFyY4W5sZRYEdp4a9OVBTgVBJgPWG52AK6sgH4qBciqB6Q5UAd2-n2bA/pub?gid=697105746&single=true&output=csv"

def normalize_url(value):
    value = value.strip()
    if not value:
        return None

    parsed = urllib.parse.urlparse(value)
    if parsed.netloc != "open.spotify.com" or not parsed.path.startswith("/playlist/"):
        return None

    return f"https://open.spotify.com{parsed.path}"

def get_artwork(url):
    if not url:
        return None

    try:
        endpoint = (
            "https://open.spotify.com/oembed?url="
            + urllib.parse.quote(url, safe="")
        )
        request = urllib.request.Request(
            endpoint,
            headers={"User-Agent": "asarisunowa-artwork-sync/1.0"},
        )
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.load(response).get("thumbnail_url")
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
        [row[2] for row in base_rows],
    ))

rows = [
    [title, maker, url, artwork]
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
