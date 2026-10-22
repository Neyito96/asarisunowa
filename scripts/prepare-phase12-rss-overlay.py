"""Prepare TWO local files from an approved baseline; never deploy or touch source.
Usage: python scripts/prepare-phase12-rss-overlay.py PRIVATE_CLASP_DIR NEW_OUTPUT_DIR
"""
from pathlib import Path
import sys,json,hashlib,re
source,out=map(lambda x:Path(x).resolve(),sys.argv[1:3]);release=Path(__file__).resolve().parents[1]/'docs/releases/phase12-rss-20261022'
if out==source or out.is_relative_to(source):raise SystemExit('Output must be separate from the live clone')
if out.exists() and any(out.iterdir()):raise SystemExit('Output must be empty')
manifest=json.loads((release/'overlay-manifest.json').read_text());expected={r['file']:r for r in manifest['files']}
texts={}
for name,record in expected.items():
 data=(source/name).read_bytes()
 if hashlib.sha256(data).hexdigest()!=record['beforeSha256']:raise SystemExit('Live source changed: '+name)
 texts[name]=data.decode('utf-8').splitlines(True)
lines=(release/'minimal-rss.patch').read_text().splitlines(True);results={};i=0
while i<len(lines):
 if not lines[i].startswith('--- a/'):raise SystemExit('Invalid patch header')
 name=lines[i][6:].strip();i+=1
 if name not in expected or lines[i].strip()!='+++ b/'+name:raise SystemExit('Unexpected patch file')
 i+=1;original=texts[name];result=[];pos=0
 while i<len(lines) and not lines[i].startswith('--- a/'):
  m=re.match(r'@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@',lines[i])
  if not m:raise SystemExit('Invalid hunk')
  start=int(m[1])-1;old_count=int(m[2] or 1);new_count=int(m[4] or 1);i+=1
  if start<pos:raise SystemExit('Overlapping hunks')
  result.extend(original[pos:start]);pos=start;consumed=produced=0
  while i<len(lines) and not lines[i].startswith(('@@ ','--- a/')):
   line=lines[i];i+=1;tag=line[0];content=line[1:]
   if i<len(lines) and lines[i].startswith('\\ No newline'):
    content=content[:-1];i+=1
   if tag in ' -':
    if pos>=len(original) or original[pos]!=content:raise SystemExit('Patch context changed: '+name)
    pos+=1;consumed+=1
   if tag in ' +':result.append(content);produced+=1
  if consumed!=old_count or produced!=new_count:raise SystemExit('Hunk count mismatch')
 result.extend(original[pos:]);data=''.join(result).encode()
 if hashlib.sha256(data).hexdigest()!=expected[name]['afterSha256']:raise SystemExit('Prepared SHA mismatch: '+name)
 results[name]=data
if set(results)!=set(expected):raise SystemExit('Missing target file')
out.mkdir(parents=True,exist_ok=True)
for name,data in results.items():(out/name).write_bytes(data)
print(json.dumps({'status':'PREPARED_LOCAL_ONLY','files':list(results),'sourceWrites':0,'gasDeployments':0,'manifestChanged':False}))
