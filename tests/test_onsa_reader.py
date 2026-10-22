import importlib.util
import tempfile
import unittest
from pathlib import Path
import openpyxl
spec=importlib.util.spec_from_file_location('onsa_reader',Path(__file__).resolve().parents[1]/'scripts/read-onsa-workbook.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class ReaderTests(unittest.TestCase):
    def test_excludes_header_notes_blank_and_keeps_migrated_audio(self):
        with tempfile.TemporaryDirectory() as directory:
            p=Path(directory)/'source.xlsx';w=openpyxl.Workbook();s=w.active;s.title='報談'
            s.append(['omny.fm へのリンク','日付','タイトル']);s.append(['毎日自動更新',None,'説明']);s.append([None,None,None])
            s.append(['https://pdst.fm/e/traffic.megaphone.fm/TASC1.mp3','Wed, 21 Oct 2026 19:00:00 -0000','Episode'])
            s.append(['https://omny.fm/shows/asahi/uuid','Thu, 22 Oct 2026 04:00:00 +0900','Other']);w.save(p)
            before=p.read_bytes();data=module.extract(p);self.assertEqual(p.read_bytes(),before)
            self.assertEqual(data['sheets'][0]['records'],2);self.assertEqual(data['sheets'][0]['headers'],1);self.assertEqual(data['sheets'][0]['explanations'],1);self.assertEqual(data['sheets'][0]['blankRows'],1)
            self.assertEqual(data['episodes'][0]['row'],4);self.assertEqual(data['episodes'][0]['publishedAt'],data['episodes'][1]['publishedAt'])
    def test_rfc_utc_and_iso_dates(self):
        self.assertEqual(module.published('Thu, 22 Oct 2026 04:00:00 +0900'),module.published('2026-10-21T19:00:00Z'))
        self.assertIsNone(module.published('日付'));self.assertIsNone(module.published('2026-10-22 04:00:00'))
    def test_auxiliary_rows_are_not_episodes(self):
        with tempfile.TemporaryDirectory() as directory:
            p=Path(directory)/'source.xlsx';w=openpyxl.Workbook();s=w.active;s.title='出演者';s.append(['名前']);s.append(['説明']);s.append(['Person']);w.save(p)
            result=module.extract(p);self.assertEqual(result['episodes'],[]);self.assertEqual(result['sheets'][0]['records'],1)

if __name__=='__main__':unittest.main()
