"""READ_ONLY reuse of PR250 extracted rows; no network, sheet or public-data writes.
Usage: PRIVATE_LIBRARY.json PRIVATE_ONSA.xlsx PRIVATE_ONSA_EXTRACT.json REPORT_DIR
Exact source URL grouping is provisional evidence, not an automatic identity merge.
"""
import sys,json,csv,math,gzip,datetime as dt,collections,hashlib
from pathlib import Path
import openpyxl
lib_path,book_path,ex_path,out=map(Path,sys.argv[1:5]);out.mkdir(parents=True,exist_ok=True)
lib=json.loads(lib_path.read_text());external=json.loads(ex_path.read_text());book=openpyxl.load_workbook(book_path,read_only=True,data_only=True)
durations={}
for sh in book:
 if sh.title not in {'ニュースの現場から','メディアトーク','ドーナツ','スポンジ','SDGs','報談','ニュースの学校'}:continue
 for i,row in enumerate(sh.values,1):
  if len(row)>3:durations[(sh.title,i)]=row[3]
book.close()
def seconds(v):return float(v) if isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v) and v>0 else None
def rerun(t):return t.startswith(('（再）','（ふりかえり）','（深掘り）')) or '再放送です' in t
def decide(show,title,date):
 if show in {'アルキキ','AJW','朝ポキTV','YouTube'}:return 'OUTSIDE_AUDIO_PROGRAMMES'
 if show=='ニュースの学校':return 'NOT_IN_SPEAKERS2_SIX_CATEGORIES'
 if show=='こどもそうだんしつ':return 'SUCCESSOR_OUTSIDE_OLD_SDGS_CUTOFF'
 if show=='SDGs' and date and date>='2026-06-29T15:00:00+00:00':return 'SUCCESSOR_OUTSIDE_OLD_SDGS_CUTOFF'
 if rerun(title):return 'SPEAKERS2_ZERO_DURATION_MARKER'
 return 'IN_SCOPE'
rows=[]
for r in lib['rows']:
 rows.append({'side':'library','id':r[0],'show':r[1],'title':r[2],'date':r[3],'guid':r[6],'url':r[8] or '', 'duration':seconds(r[15]),'reason':decide(r[1],r[2],str(r[3]))})
for x in external['episodes']:
 rows.append({'side':'copy1022','id':f"{x['sheet']}:{x['row']}",'show':x['sheet'],'title':x['title'],'date':x['publishedAt'],'guid':'','url':x['sourceUrl'],'duration':seconds(durations.get((x['sheet'],x['row']))),'reason':decide(x['sheet'],x['title'],x['publishedAt'])})
def summary(side):
 records=[r for r in rows if r['side']==side];kept=[r for r in records if r['reason']=='IN_SCOPE'];groups=collections.defaultdict(list)
 for r in kept:groups[r['url'] or 'UNRESOLVED:'+r['id']].append(r)
 reasons=dict(collections.Counter(r['reason'] for r in records if r['reason']!='IN_SCOPE'))
 bounds=[];conflicts=0;unknown=0
 for members in groups.values():
  vals=[r['duration'] for r in members if r['duration'] is not None]
  if not vals:unknown+=1
  if len(set(vals))>1:conflicts+=1
  if vals:bounds.append((min(vals),max(vals)))
 result={'rawRows':len(records),'adjustments':reasons,'rowsInScope':len(kept),'extraExactSourceUrlRows':len(kept)-len(groups),'provisionalSourceUrlGroups':len(groups),'missingSourceUrls':sum(not r['url'] for r in kept),'missingDurationRows':sum(r['duration'] is None for r in kept),'groupsWithoutDuration':unknown,'groupsWithConflictingDuration':conflicts,'knownDurationMinSeconds':sum(v[0] for v in bounds),'knownDurationMaxSeconds':sum(v[1] for v in bounds),'finalUniqueEpisodes':None,'finalDurationSeconds':None}
 assert len(records)-sum(reasons.values())-result['extraExactSourceUrlRows']==len(groups)
 return result,groups
l,lg=summary('library');e,eg=summary('copy1022');benchmark=173*86400+19*3600+8*60
report={'mode':'READ_ONLY_NOT_FINAL_POPULATION','at':dt.datetime.now(dt.timezone.utc).isoformat(),'benchmark':{'episodes':5452,'durationSeconds':benchmark,'durationLabel':'173日19時間8分','source':'USER_OBSERVED_SPEAKERS2_20261022'},'cutoffTimezone':'Asia/Tokyo','library':l,'copy1022':e,'libraryProvisionalCountDelta':l['provisionalSourceUrlGroups']-5452,'copyProvisionalCountDelta':e['provisionalSourceUrlGroups']-5452,'exactSourceUrlDifferenceIsNotFinalEpisodeDifference':True,'externalRuntimeDataUnavailable':True,'overlapWithPR250':'Reuse snapshots/extracted rows and source URL group evidence; no new identity engine','inputSha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [lib_path,book_path,ex_path]},'publicCountChanged':False,'writesToSheets':0}
(out/'summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
with gzip.open(out/'library-scope-decisions.csv.gz','wt') as f:
 w=csv.writer(f);w.writerow(['epId','programme','reason','durationStatus','sourceUrlStatus'])
 for r in rows:
  if r['side']=='library':w.writerow([r['id'],r['show'],r['reason'],'KNOWN' if r['duration'] is not None else 'HOLD_MISSING','PRESENT' if r['url'] else 'HOLD_MISSING'])
with (out/'unresolved-source-url-differences.csv').open('w') as f:
 w=csv.writer(f);w.writerow(['side','id','show','title','date','guid','sourceUrl','reason'])
 for side,groups,other in [('library',lg,eg),('copy1022',eg,lg)]:
  for key,members in groups.items():
   if key not in other:
    for r in members:w.writerow([side,r['id'],r['show'],r['title'],r['date'],r['guid'],r['url'],'EXACT_SOURCE_URL_ONLY_REVIEW_REQUIRED_NOT_CONFIRMED_MISSING'])
print(json.dumps({'library':l,'copy1022':e},ensure_ascii=False))
