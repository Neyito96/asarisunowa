#!/usr/bin/env python3
import json,datetime,xml.etree.ElementTree as ET,email.utils,pathlib,re,unicodedata,argparse
parser=argparse.ArgumentParser(description='Offline projection of a Sheets snapshot and locally captured RSS XML; no network or Sheets writes.');parser.add_argument('ledger');parser.add_argument('manifest');parser.add_argument('output_prefix');args=parser.parse_args();d=json.loads(pathlib.Path(args.ledger).read_text())
for r in d['rows']:
 r.extend(['']*(51-len(r)))
 for i in range(51):
  if r[i] is None:r[i]=''
 if isinstance(r[3],(int,float)):r[3]=(datetime.datetime(1899,12,30)+datetime.timedelta(days=r[3])).strftime('%Y/%m/%d %H:%M')
pathlib.Path(args.output_prefix+'.ledger.json').write_text(json.dumps(d,ensure_ascii=False))
norm=lambda x:' '.join(unicodedata.normalize('NFKC',x or '').split())
guid=lambda x:(re.search(r'[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}',x or '',re.I)[0] if re.search(r'[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}',x or '',re.I) else x or '').lower()
feeds=[]
for f in json.loads(pathlib.Path(args.manifest).read_text()):
 if 'path' not in f:continue
 items=[]
 for n in ET.parse(f['path']).findall('./channel/item'):
  txt=lambda k:n.findtext(k) or ''
  try:dt=email.utils.parsedate_to_datetime(txt('pubDate'));dt=dt.replace(tzinfo=datetime.timezone.utc) if dt.tzinfo is None else dt;date=dt.astimezone(datetime.timezone(datetime.timedelta(hours=9))).date().isoformat();published=dt.isoformat()
  except:date=published=''
  enc=n.find('enclosure');image=n.find('{http://www.itunes.com/dtds/podcast-1.0.dtd}image');duration=txt('{http://www.itunes.com/dtds/podcast-1.0.dtd}duration').strip();dv=''
  if re.fullmatch(r'\d+(?::\d{2}){0,2}',duration):
   dv=0
   for p in duration.split(':'):dv=dv*60+int(p)
  cast=list(dict.fromkeys(norm(p.text) for p in n.findall('{https://podcastindex.org/namespace/1.0}person') if p.get('role','').lower() in ['host','guest'] and norm(p.text)))
  links=[txt('link')]+[p.text or '' for p in n.findall('{https://www.spotify.com/ns/rss}episode')];sp=set(x for x in links if re.fullmatch(r'https://open.spotify.com/episode/[A-Za-z0-9]{22}',x))
  items.append(dict(guid=guid(txt('guid')),title=norm(txt('title')),date=date,published=published,audio=enc.get('url','') if enc is not None else '',description=txt('description').strip().replace('\r\n','\n').replace('\r','\n').replace('\n','\\n'),cast='、'.join(cast),spotify=next(iter(sp)) if len(sp)==1 else '',image=image.get('href','') if image is not None else '',duration=dv,link=txt('link')))
 feeds.append(dict(show=f['show'],url=f['url'],items=items))
pathlib.Path(args.output_prefix+'.rss.json').write_text(json.dumps(feeds,ensure_ascii=False));print({'rows':len(d['rows']),'feeds':len(feeds),'items':sum(len(f['items']) for f in feeds)})
