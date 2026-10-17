import importlib.util,pathlib,unittest,unittest.mock as mock,subprocess,tempfile,json,os
spec=importlib.util.spec_from_file_location('audio',pathlib.Path('scripts/library-v3-audio-probe.py'));audio=importlib.util.module_from_spec(spec);spec.loader.exec_module(audio)
class Response:
 def __init__(self,code,headers=None,data=b''):self.code=code;self.headers=headers or {};self.data=data;self.reads=[]
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def read(self,n):self.reads.append(n);return self.data[:n]
class AudioTests(unittest.TestCase):
 def run_probe(self,responses,follow=False):
  opener=mock.Mock();opener.open.side_effect=responses
  with mock.patch.object(audio.urllib.request,'build_opener',return_value=opener):r=audio.probe({'id':'EP-00001','url':'https://traffic.omny.fm/audio.mp3'},True,follow)
  return r,opener
 def test_head_is_not_playback_and_ignored_range_is_not_read(self):
  a,b=Response(200),Response(200,{'Content-Type':'audio/mpeg'},b'ID3'+b'x'*9999);r,_=self.run_probe([a,b]);self.assertEqual(r['verdict'],'RANGE_IGNORED');self.assertEqual(b.reads,[]);self.assertFalse(r['playbackVerified'])
 def test_prefix_is_bounded_and_requires_type_and_signature(self):
  a=Response(206,{'Content-Type':'audio/mpeg'},b'ID3'+b'x'*9999);r,_=self.run_probe([Response(200),a]);self.assertEqual(r['verdict'],'AUDIO_PREFIX_OBSERVED');self.assertEqual(a.reads,[1024]);self.assertEqual(r['bytes'],1024)
  r,_=self.run_probe([Response(200),Response(206,{'Content-Type':'text/html'},b'<html>')]);self.assertEqual(r['verdict'],'NON_AUDIO_RESPONSE')
 def test_rate_limit_and_notfound_do_not_trigger_get_or_retry(self):
  for code in [403,404,410,429,503]:
   r,o=self.run_probe([Response(code,{'Retry-After':'7200'})]);self.assertEqual(o.open.call_count,1);self.assertFalse(r['playbackVerified']);self.assertEqual(r['observations'][0]['retryAfter'],'7200')
 def test_only_allowlisted_redirect_is_followed_and_two_hop_limit(self):
  r,o=self.run_probe([Response(302,{'Location':'https://127.0.0.1/private'})],True);self.assertEqual(o.open.call_count,1)
  red=Response(302,{'Location':'https://omny-us.pdn.tritondigital.com/audio.mp3'})
  r,o=self.run_probe([red,red,red],True);self.assertEqual(o.open.call_count,3);self.assertEqual(r['verdict'],'REDIRECT_NOT_FOLLOWED')
 def test_private_host_is_rejected(self):
  with self.assertRaises(ValueError):audio.probe({'id':'EP-1','url':'https://localhost/audio'})
class ProjectionTests(unittest.TestCase):
 def test_minus0000_date_is_utc_in_every_host_timezone(self):
  with tempfile.TemporaryDirectory() as directory:
   p=pathlib.Path(directory);(p/'ledger.json').write_text(json.dumps({'rows':[],'headers':[]}));(p/'rss.xml').write_text('<rss><channel><item><guid>id</guid><title>T</title><pubDate>Thu, 15 Oct 2026 19:00:00 -0000</pubDate></item></channel></rss>');(p/'manifest.json').write_text(json.dumps([{'path':str(p/'rss.xml'),'show':'Show','url':'https://rss.test'}]))
   for zone in ['UTC','Asia/Tokyo']:
    subprocess.run(['python','scripts/project-library-v3-inputs.py',str(p/'ledger.json'),str(p/'manifest.json'),str(p/'out')],env={**os.environ,'TZ':zone},check=True,capture_output=True)
    item=json.loads((p/'out.rss.json').read_text())[0]['items'][0];self.assertEqual(item['date'],'2026-10-16');self.assertEqual(item['published'],'2026-10-15T19:00:00+00:00')
if __name__=='__main__':unittest.main()
