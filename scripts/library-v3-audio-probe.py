#!/usr/bin/env python3
"""Read-only media check. Input JSON [{id,url}], max five. Never writes Sheets.
HEAD has no body. --range requests max 1024 bytes and reads at most 1024,
only on an actual 206 response. Redirects are recorded; opt-in follows at most two provider-allowlisted hops.
HTTP/prefix evidence cannot prove full playback. No credentials required.
"""
import argparse, datetime, json, time, urllib.request, urllib.error, urllib.parse
HOSTS={'traffic.omny.fm','omny.fm','www.omny.fm','www.omnycontent.com','omnycontent.com','traffic.megaphone.fm','pdst.fm','omny-us.pdn.tritondigital.com'}
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None

def audio_signature(data):
    return data.startswith((b'ID3',b'OggS',b'fLaC',b'RIFF')) or len(data)>1 and data[0]==255 and data[1]&224==224 or len(data)>8 and data[4:8]==b'ftyp'

def probe(item,range_probe=False,follow_provider=False,depth=0):
    url=item['url']; parsed=urllib.parse.urlparse(url)
    if parsed.scheme!='https' or parsed.hostname not in HOSTS or parsed.username or parsed.password or parsed.port not in (None,443):raise ValueError('Unsupported audio URL')
    result={'id':item['id'],'url':url,'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'playbackVerified':False,'bytes':0,'apiCalls':0,'observations':[]}
    opener=urllib.request.build_opener(NoRedirect);started=time.monotonic()
    for method in (['HEAD','GET'] if range_probe else ['HEAD']):
        headers={'User-Agent':'Asarisu-Library-V3-Audit/1.0','Accept-Encoding':'identity'}
        if method=='GET':headers['Range']='bytes=0-1023'
        result['apiCalls']+=1
        try:
            try:res=opener.open(urllib.request.Request(url,method=method,headers=headers),timeout=12)
            except urllib.error.HTTPError as err:res=err
            with res:
                status=res.code;ctype=res.headers.get('Content-Type','');retry=res.headers.get('Retry-After');n=0
                verdict='HTTP_NOT_FOUND_AT_CHECK_TIME' if status in (404,410) else 'REDIRECT_NOT_FOLLOWED' if status in (301,302,303,307,308) else 'INCONCLUSIVE_HTTP'
                if method=='HEAD' and status in (200,206):verdict='HEAD_REACHABLE'
                if method=='GET':
                    if status==200:verdict='RANGE_IGNORED' # close without reading body
                    elif status==206:
                        data=res.read(1024);n=len(data)
                        verdict='AUDIO_PREFIX_OBSERVED' if ctype.lower().startswith('audio/') and audio_signature(data) else 'NON_AUDIO_RESPONSE'
                result.update(http=status,verdict=verdict,bytes=n)
                obs={'method':method,'http':status,'verdict':verdict,'bytes':n,'contentType':ctype}
                if retry:obs['retryAfter']=retry
                result['observations'].append(obs)
                if status in (301,302,303,307,308) and follow_provider and depth<2:
                    location=urllib.parse.urljoin(url,res.headers.get('Location',''));target=urllib.parse.urlparse(location)
                    if target.scheme=='https' and target.hostname in HOSTS:
                        child=probe({'id':item['id'],'url':location},range_probe,True,depth+1)
                        result['apiCalls']+=child['apiCalls'];result['observations']+=child['observations']
                        result.update(http=child['http'],verdict=child['verdict'],bytes=child['bytes']);break
                # Do not retry during a rate limit, redirect or other failure.
                if status not in (200,206):break
        except Exception as err:
            result.update(http=None,verdict='FETCH_ERROR');result['observations'].append({'method':method,'errorType':type(err).__name__});break
    result['elapsedMs']=round((time.monotonic()-started)*1000);return result

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('input');parser.add_argument('output');parser.add_argument('--range',action='store_true',dest='range_probe');parser.add_argument('--follow-provider-redirects',action='store_true');args=parser.parse_args()
    items=json.load(open(args.input))
    if not isinstance(items,list) or len(items)>5 or len({x['id'] for x in items})!=len(items):raise ValueError('Maximum five unique IDs')
    results=[probe(x,args.range_probe,args.follow_provider_redirects) for x in items];json.dump(results,open(args.output,'w'),ensure_ascii=False,indent=2)
    print(json.dumps({'tested':len(results),'apiCalls':sum(x['apiCalls'] for x in results),'bytesRead':sum(x['bytes'] for x in results),'results':[{'id':x['id'],'http':x['http'],'verdict':x['verdict']} for x in results]},ensure_ascii=False))
if __name__=='__main__':main()
