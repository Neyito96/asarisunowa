#!/usr/bin/env python3
"""Read-only media check. Input JSON [{id,url}], max five. Never writes Sheets.
HEAD has no body. --range requests max 1024 bytes and reads at most 1024,
only on an actual 206 response. Redirects are recorded; opt-in follows at most two provider-allowlisted hops.
HTTP/prefix evidence cannot prove full playback. No credentials required.
"""
import argparse, datetime, email.utils, hashlib, json, os, pathlib, time, urllib.request, urllib.error, urllib.parse
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
                verdict={403:'HTTP_FORBIDDEN',404:'HTTP_NOT_FOUND',410:'HTTP_GONE',429:'HTTP_RATE_LIMITED',503:'HTTP_UNAVAILABLE'}.get(status) or ('REDIRECT_NOT_FOLLOWED' if status in (301,302,303,307,308) else 'INCONCLUSIVE_HTTP')
                if method=='HEAD' and status in (200,206):verdict='HEAD_REACHABLE'
                if method=='GET':
                    if status==200:verdict='RANGE_IGNORED' # close without reading body
                    elif status==206:
                        data=res.read(1024);n=len(data)
                        verdict='AUDIO_PREFIX_OBSERVED' if ctype.lower().startswith('audio/') and audio_signature(data) else 'NON_AUDIO_RESPONSE'
                result.update(http=status,verdict=verdict,bytes=n)
                obs={'host':parsed.hostname,'method':method,'http':status,'verdict':verdict,'bytes':n,'contentType':ctype}
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
    result['elapsedMs']=round((time.monotonic()-started)*1000)
    return schedule(result)

def schedule(result,now=None,attempt=1):
    """Per-URL due time; Retry-After is a lower bound, never shortened."""
    now=now or datetime.datetime.now(datetime.timezone.utc)
    http=result.get('http');delay=30*86400 if result.get('verdict')=='AUDIO_PREFIX_OBSERVED' else 86400 if result.get('verdict')=='HEAD_REACHABLE' else 7*86400 if http in (403,404,410) or result.get('verdict') in ('RANGE_IGNORED','NON_AUDIO_RESPONSE','REDIRECT_NOT_FOLLOWED') else min(3600,60*2**min(attempt-1,6))
    raw=next((o.get('retryAfter') for o in reversed(result['observations']) if o.get('retryAfter')),None)
    if raw:
        try:
            seconds=int(raw) if str(raw).isdigit() else max(0,(email.utils.parsedate_to_datetime(raw)-now).total_seconds())
            delay=max(delay,seconds)
        except (TypeError,ValueError,OverflowError):pass
    result.update(nextCheckAt=(now+datetime.timedelta(seconds=delay)).isoformat(),attempt=attempt,stopped=(http in (429,503) or result.get('verdict')=='FETCH_ERROR') and attempt>=5)
    return result

def batch(items,state,range_probe=False,follow_provider=False,max_seconds=100):
    started=time.monotonic();results=[]
    for item in items:
        key=hashlib.sha256((item['id']+'|'+item['url']).encode()).hexdigest();old=state.get(key,{})
        if old.get('stopped') or old.get('nextCheckAt','')>datetime.datetime.now(datetime.timezone.utc).isoformat():continue
        if time.monotonic()-started>=max_seconds:break
        result=probe(item,range_probe,follow_provider)
        transient=result.get('http') in (429,503) or result.get('verdict')=='FETCH_ERROR'
        attempt=old.get('attempt',0)+1 if transient else 1
        schedule(result,attempt=attempt);state[key]={k:result[k] for k in ['nextCheckAt','attempt','stopped']};results.append(result)
    return results

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('input');parser.add_argument('output');parser.add_argument('--range',action='store_true',dest='range_probe');parser.add_argument('--follow-provider-redirects',action='store_true');parser.add_argument('--state',help='Private local checkpoint file; optional');args=parser.parse_args()
    items=json.load(open(args.input))
    if not isinstance(items,list) or len(items)>5 or len({x['id'] for x in items})!=len(items):raise ValueError('Maximum five unique IDs')
    state=json.load(open(args.state)) if args.state and pathlib.Path(args.state).exists() else {}
    results=batch(items,state,args.range_probe,args.follow_provider_redirects)
    output=pathlib.Path(args.output);output.write_text(json.dumps(results,ensure_ascii=False,indent=2));output.chmod(0o600)
    if args.state:
        checkpoint=pathlib.Path(args.state);temporary=checkpoint.with_suffix(checkpoint.suffix+'.tmp')
        temporary.write_text(json.dumps(state));temporary.chmod(0o600);os.replace(temporary,checkpoint)
    print(json.dumps({'tested':len(results),'apiCalls':sum(x['apiCalls'] for x in results),'bytesRead':sum(x['bytes'] for x in results),'results':[{'id':x['id'],'http':x['http'],'verdict':x['verdict']} for x in results]},ensure_ascii=False))
if __name__=='__main__':main()
