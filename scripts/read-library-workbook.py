"""Read a downloaded library workbook; never write the source workbook.
Usage: python scripts/read-library-workbook.py PRIVATE.xlsx PRIVATE.json
The output contains source/audit columns and MUST stay outside the repository.
"""
import datetime
import json
import sys
from pathlib import Path
import openpyxl
source, destination = map(Path, sys.argv[1:3])
repository = Path(__file__).resolve().parents[1]
if destination.resolve().is_relative_to(repository):
    raise SystemExit('Private source JSON must be outside the repository')
workbook = openpyxl.load_workbook(source, read_only=True, data_only=True)
rows = list(workbook['エピソード台帳'].values)
output = {'headers': rows[0], 'rows': [r for r in rows[1:] if r[0]],
          'exclusions': list(workbook['削除・除外履歴'].values),
          'snapshotDate': datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).date().isoformat()}
destination.write_text(json.dumps(output, ensure_ascii=False, default=str), encoding='utf-8')
print(f'Read {len(output["rows"])} episodes; source workbook unchanged')
