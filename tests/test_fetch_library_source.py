import importlib.util, pathlib, unittest
spec=importlib.util.spec_from_file_location('reader',pathlib.Path(__file__).parents[1]/'scripts/fetch-library-source.py');reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
class Response:
    status_code=200
    def __init__(self,data):self.data=data
    def json(self):return self.data
class Session:
    def __init__(self,change=False):self.calls=[];self.passes=0;self.change=change
    def get(self,url,params=None,timeout=None):
        self.calls.append((url,params))
        if '/values/' not in url:
            self.passes+=1
            return Response({'properties':{'timeZone':'Asia/Tokyo'},'sheets':[{'properties':{'title':title,'gridProperties':{'rowCount':2,'columnCount':width}}} for title,width in [('エピソード台帳',55),('削除・除外履歴',2),('図書館V3・項目状態',3)]]})
        if 'エピソード台帳' in url:
            h=['']*55;h[0]='台帳ID';r=['']*55;r[0]='EP-00001';r[3]=45956.25;r[2]='changed' if self.change and self.passes>1 else 'stable'
            return Response({'values':[h,r]})
        if '図書館V3' in url:return Response({'values':[['EP-ID','fieldStatesJSON','updatedAt']]})
        return Response({'values':[['GUID','固定ID']]})
class ReadOnlyAdapterTests(unittest.TestCase):
    def test_bounded_gets_and_jst_serial_date(self):
        session=Session();result=reader.stable_source(session)
        self.assertEqual(result['rows'][0][3],'2025-10-26 06:00:00')
        self.assertEqual(len(session.calls),8)
        self.assertTrue(all(c[1]['dateTimeRenderOption']=='SERIAL_NUMBER' for c in session.calls if '/values/' in c[0]))
        self.assertTrue(any("'エピソード台帳'!A1:BC2" in c[0] for c in session.calls))
    def test_change_during_read_holds_publication(self):
        with self.assertRaisesRegex(RuntimeError,'changed during read'):reader.stable_source(Session(change=True))
if __name__=='__main__':unittest.main()
