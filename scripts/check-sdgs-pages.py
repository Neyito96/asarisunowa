"""Bounded, checkpointed GET validation of supplied public episode URLs.
No credentials, writes to Google, audio GETs, retries, or guessed MP3 URLs.
"""
import concurrent.futures
import datetime
import html
import json
from pathlib import Path
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import requests
local = threading.local()
urls_path, result_path = map(Path, sys.argv[1:3])
urls = json.loads(urls_path.read_text())
results = {}
if result_path.exists():
    for line in result_path.read_text().splitlines():
        entry = json.loads(line)
        results[entry['url']] = entry
lock = threading.Lock()
stop = threading.Event()

def fetch(url):
    if stop.is_set():
        return None
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname != 'www.asahi.com' or parsed.path != '/special/podcasts/item/':
        raise ValueError('Unexpected target URL')
    expected = urllib.parse.parse_qs(parsed.query).get('itemid', [''])[0]
    result = {'url': url, 'expectedUuid': expected, 'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    try:
        if not hasattr(local, 'session'):
            local.session = requests.Session()
            local.session.headers['User-Agent'] = 'AsarisunowaArchiveAudit/1.0'
        with local.session.get(url, timeout=15, stream=True) as response:
            if response.status_code >= 400:
                raise urllib.error.HTTPError(url, response.status_code, '', None, None)
            data = response.raw.read(350001, decode_content=True)
            body = data.decode('utf-8', errors='replace')
            result.update(status=response.status_code, finalUrl=response.url, truncated=len(data)>350000)
            def meta(key):
                match = re.search(r'<meta\b[^>]*(?:property|name)=[\"\x27]'+re.escape(key)+r'[\"\x27][^>]*content=[\"\x27](.*?)[\"\x27]', body, re.I)
                return html.unescape(match.group(1)) if match else ''
            heading = re.search(r'<div\b[^>]*id=[\"\x27]selected_player[\"\x27][^>]*>[\s\S]*?<h1\b[^>]*>([\s\S]*?)</h1>', body, re.I)
            result['title'] = html.unescape(re.sub(r'<[^>]*>', '', heading.group(1))).strip() if heading else meta('og:title')
            result['canonical'] = meta('og:url')
            match = re.search(r'<iframe[^>]*src=[\"\x27]([^\"\x27]+)[\"\x27][^>]*id=[\"\x27]onsei_item[\"\x27]', body, re.I)
            result['embed'] = html.unescape(match.group(1)) if match else ''
            match = re.search(r'<div class="o-body">([\s\S]*?)</div>', body)
            result['bodyHtml'] = match.group(1) if match else ''
            result['identityVerified'] = response.status_code==200 and expected in result['canonical'] and bool(result['title']) and bool(result['embed']) and not result['truncated']
            if re.search(r'verify you are human|captcha|unusual traffic', body, re.I):
                result['identityVerified'] = False
                result['reason'] = 'SECURITY_CHALLENGE_STOP'
                stop.set()
    except urllib.error.HTTPError as error:
        result.update(status=error.code, identityVerified=False, reason='HTTP_'+str(error.code))
        if error.code in (403, 429):
            stop.set()
    except Exception as error:
        result.update(status=0, identityVerified=False, reason=type(error).__name__)
    with lock:
        with result_path.open('a') as output:
            output.write(json.dumps(result, ensure_ascii=False)+'\n')
        results[url] = result
        if len(results)%200==0:
            print(json.dumps({'checked':len(results),'total':len(urls),'stop':stop.is_set()}), flush=True)
    time.sleep(.12)
    return result
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    list(pool.map(fetch, [url for url in urls if url not in results]))
from collections import Counter
print(json.dumps({'checked':len(results),'requested':len(urls),'verified':sum(bool(r.get('identityVerified')) for r in results.values()),'statuses':dict(Counter(r.get('status') for r in results.values())),'stopped':stop.is_set()}), flush=True)
