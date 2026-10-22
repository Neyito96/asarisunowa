"""READ_ONLY extraction. Never modify workbook; raw row data stays outside git.
Usage: python scripts/read-onsa-workbook.py PRIVATE.xlsx PRIVATE.json
"""
import datetime as dt
import email.utils
import hashlib
import json
import re
import sys
from pathlib import Path
import openpyxl

EPISODE_SHEETS = {'ニュースの現場から', 'メディアトーク', 'ドーナツ', 'スポンジ', 'SDGs', '報談', 'YouTube', 'ニュースの学校'}

def published(value):
    if not value: return None
    if isinstance(value, dt.datetime):
        # An unzoned spreadsheet date has no reliable timezone evidence.
        return value.astimezone(dt.timezone.utc).isoformat() if value.tzinfo else None
    text=str(value).strip()
    try:
        date=dt.datetime.fromisoformat(text.replace('Z','+00:00'))
    except ValueError:
        try:
            date=email.utils.parsedate_to_datetime(text)
            if date.tzinfo is None and re.search(r' -0000$',text): date=date.replace(tzinfo=dt.timezone.utc)
        except (ValueError,TypeError): return None
    return date.astimezone(dt.timezone.utc).isoformat() if date.tzinfo else None

def extract(path):
    workbook=openpyxl.load_workbook(path,read_only=True,data_only=True)
    episodes=[];sheets=[]
    for sheet in workbook:
        rows=list(sheet.values)
        counts={'sheet':sheet.title,'role':'episode' if sheet.title in EPISODE_SHEETS else 'auxiliary','physicalRows':len(rows),'records':0,'headers':0,'explanations':0,'blankRows':0,'otherRows':[],'missingDates':0,'duplicateSourceUrlRows':0}
        seen=set()
        for number,row in enumerate(rows,1):
            nonempty=any(value is not None and str(value).strip() for value in row)
            if not nonempty: counts['blankRows']+=1;continue
            if number==1:counts['headers']+=1;continue
            if number==2:counts['explanations']+=1;continue
            if counts['role']=='auxiliary':
                if row and row[0]:counts['records']+=1
                else:counts['otherRows'].append(number)
                continue
            values=list(row)+[None]*max(0,15-len(row))
            url=str(values[0] or '').strip();title=str(values[2] or '').strip();date=published(values[1])
            # The label says Omny, but post-migration rows contain Megaphone MP3s.
            if not (url.startswith(('https://','http://')) or title and date):
                counts['otherRows'].append(number);continue
            if not title and not date:counts['otherRows'].append(number);continue
            counts['records']+=1
            if not date:counts['missingDates']+=1
            if url and url in seen:counts['duplicateSourceUrlRows']+=1
            if url:seen.add(url)
            episodes.append({'sheet':sheet.title,'row':number,'sourceUrl':url,'publishedAt':date,'title':title,'spotify':str(values[11] or '').strip(),'official':str(values[12] or '').strip(),'pocketcasts':str(values[13] or '').strip()})
        sheets.append(counts)
    workbook.close()
    return {'mode':'READ_ONLY','extractedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'workbookSha256':hashlib.sha256(Path(path).read_bytes()).hexdigest(),'sheetCount':len(sheets),'sheets':sheets,'episodes':episodes}

if __name__=='__main__':
    source,destination=map(Path,sys.argv[1:3])
    if destination.resolve().is_relative_to(Path(__file__).resolve().parents[1]):raise SystemExit('Raw extraction must remain outside repository')
    result=extract(source)
    destination.write_text(json.dumps(result,ensure_ascii=False,default=str),encoding='utf-8')
    print(json.dumps({'sheetCount':result['sheetCount'],'sheets':result['sheets']},ensure_ascii=False))
