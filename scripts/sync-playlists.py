from pathlib import Path
import csv
import json
import urllib.request
from urllib.parse import urlparse

CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQHi9LM842wuiTT-N8FzgJXVFyY4W5sZRYEdp4a9OVBTgVBJgPWG52AK6sgH4qBciqB6Q5UAd2-n2bA/pub?gid=697105746&single=true&output=csv"

with urllib.request.urlopen(CSV_URL, timeout=30) as response:
    lines = response.read().decode("utf-8-sig").splitlines()

table = list(csv.reader(lines))
expected = ["Spotifyプレイリストのリンク", "公開プレイリスト", "プロフィール"]

if not table or table[0][:3] != expected:
    raise SystemExit("停止：スプレッドシートの見出しが想定と異なります")

rows = []
for source in table[1:]:
    source += [""] * (3 - len(source))
    url, title, maker = (value.strip() for value in source[:3])

    if not title:
        continue

    if url:
        parsed = urlparse(url)
        if parsed.netloc != "open.spotify.com" or not parsed.path.startswith("/playlist/"):
            print(f"注意：プレイリストではないためリンクを省略します: {title}")
            url = ""
        else:
            url = f"https://open.spotify.com{parsed.path}"

    rows.append([title, maker, url or None])

if len(rows) < 10:
    raise SystemExit(f"停止：取得件数が少なすぎます（{len(rows)}件）")

output = (
    'export type Playlist = { id:string; title:string; maker:string; url:string|null };\n'
    + 'const rows:[string,string,string|null][] = '
    + json.dumps(rows, ensure_ascii=False, indent=2)
    + ';\n'
    + 'export const playlists:Playlist[] = rows.map((r,i)=>'
      '({id:String(i+1),title:r[0],maker:r[1],url:r[2]}));\n'
)

Path("app/data.ts").write_text(output, encoding="utf-8")
print(f"成功：{len(rows)}件を読み込みました")
