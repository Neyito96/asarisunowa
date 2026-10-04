"""Offline regression: artwork fallback and sync -> git push -> Pages contract."""
import contextlib
import csv
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import textwrap
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sync_playlists', ROOT / 'scripts/sync-playlists.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)
URL = 'https://open.spotify.com/playlist/7FBbaBPpGDSJUIXN4L2iYi'
OLD = 'https://mosaic.scdn.co/300/existing'
NEW = 'https://mosaic.scdn.co/300/new'


def data(rows):
    return 'const rows:[string,string,string|null,string|null][] = ' + json.dumps(rows) + ';\n'


class SyncTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.cwd = Path.cwd()
        os.chdir(self.tmp.name)
        self.addCleanup(os.chdir, self.cwd)
        Path('app').mkdir()
        self.file = Path('app/data.ts')
        self.file.write_text(data([['斎藤健一郎', 'ぽくぽく', URL, OLD]]))

    def run_sync(self, artwork=None, title='斎藤健一郎', url=URL, bad_header=False):
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(['bad'] if bad_header else ['Spotifyプレイリストのリンク', '公開プレイリスト', 'プロフィール'])
        writer.writerow([url, title, 'ぽくぽく'])
        for i in range(9):
            writer.writerow([f'https://open.spotify.com/playlist/test{i}', f'fixture{i}', 'fixture'])
        # All external access is mocked; accidental extra network calls fail the assertion.
        with patch.object(sync.urllib.request, 'urlopen', return_value=io.BytesIO(buf.getvalue().encode())) as network, patch.object(sync, 'get_artwork', return_value=artwork), contextlib.redirect_stdout(io.StringIO()):
            sync.main()
        self.assertEqual(network.call_count, 1)
        source = self.file.read_text()
        match = re.search(r'const rows:[^=]+?=\s*', source)
        return json.JSONDecoder().raw_decode(source[match.end():])[0]

    def test_failure_keeps_existing_image_and_metadata_changes(self):
        rows = self.run_sync(title='斎藤健一郎 出演回', url=URL+'?si=fixture')
        self.assertEqual(rows[0], ['斎藤健一郎 出演回', 'ぽくぽく', URL, OLD])

    def test_empty_and_invalid_image_keep_existing(self):
        for value in ['', '   ', 'javascript:bad', 123]:
            with self.subTest(value=value):
                self.assertEqual(self.run_sync(value)[0][3], OLD)

    def test_success_replaces_existing(self):
        self.assertEqual(self.run_sync(NEW)[0][3], NEW)

    def test_new_playlist_failure_remains_null_without_cross_title_fallback(self):
        self.assertIsNone(self.run_sync(url=URL+'other')[0][3])

    def test_local_override_has_priority(self):
        url, artwork = next(iter(sync.LOCAL_ARTWORK_BY_URL.items()))
        self.assertEqual(self.run_sync(NEW, url=url)[0][3], artwork)

    def test_unreadable_existing_data_fails_without_overwrite_or_network(self):
        self.file.write_text('unrecognized source')
        with patch.object(sync.urllib.request, 'urlopen') as network:
            with self.assertRaises(ValueError):
                sync.main()
        network.assert_not_called()
        self.assertEqual(self.file.read_text(), 'unrecognized source')

    def test_invalid_sheet_does_not_overwrite(self):
        before = self.file.read_bytes()
        with self.assertRaises(SystemExit):
            self.run_sync(bad_header=True)
        self.assertEqual(self.file.read_bytes(), before)

    def test_oembed_error_and_missing_thumbnail_return_none(self):
        with contextlib.redirect_stdout(io.StringIO()), patch.object(sync.urllib.request, 'urlopen', side_effect=TimeoutError('offline')):
            self.assertIsNone(sync.get_artwork(URL))
        with patch.object(sync.urllib.request, 'urlopen', return_value=io.BytesIO(b'{}')):
            self.assertIsNone(sync.get_artwork(URL))

    def test_sync_commit_push_and_publish_checkout_contains_new_data(self):
        def git(*args, cwd=None):
            return subprocess.run(['git', *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()
        remote = Path(self.tmp.name) / 'remote.git'
        git('init', '--bare', str(remote))
        git('init', '-b', 'main')
        git('config', 'user.name', 'Fixture')
        git('config', 'user.email', 'fixture@example.invalid')
        git('add', 'app/data.ts')
        git('commit', '-m', 'baseline')
        git('remote', 'add', 'origin', str(remote))
        git('push', '-u', 'origin', 'main')
        trigger_sha = git('rev-parse', 'HEAD')
        self.run_sync(NEW)
        workflow = (ROOT / '.github/workflows/sync-playlists.yml').read_text()
        # Execute the actual production Save changes shell, against a local bare remote.
        save_shell = textwrap.dedent(workflow.split('      - name: Save changes\n        run: |\n', 1)[1])
        subprocess.run(['bash', '-e', '-c', save_shell], check=True, capture_output=True)
        pushed_sha = git('rev-parse', 'refs/heads/main', cwd=remote)
        self.assertNotEqual(trigger_sha, pushed_sha)
        published = Path(self.tmp.name) / 'published'
        git('clone', '--branch', 'main', str(remote), str(published))
        self.assertIn(NEW, (published / 'app/data.ts').read_text())
        subprocess.run(['bash', '-e', '-c', save_shell], check=True, capture_output=True)
        self.assertEqual(git('rev-parse', 'HEAD'), pushed_sha, 'No-change sync creates no commit')


class WorkflowContractTests(unittest.TestCase):
    def test_successful_main_sync_reuses_pages_build_and_deploy(self):
        pages = (ROOT / '.github/workflows/pages.yml').read_text()
        self.assertIn('workflow_run:\n    workflows: [Sync listener playlists]\n    types: [completed]\n    branches: [main]', pages)
        self.assertIn("if: github.event_name != 'workflow_run' || github.event.workflow_run.conclusion == 'success'", pages)
        self.assertIn("ref: ${{ github.event_name == 'workflow_run' && 'main' || github.sha }}", pages)
        self.assertIn('needs: build', pages)
        self.assertIn('uses: actions/deploy-pages@v4', pages)
        self.assertNotIn('scripts/sync-playlists.py', pages, 'Publishing must not refetch Spotify')
        sync_workflow = (ROOT / '.github/workflows/sync-playlists.yml').read_text()
        self.assertIn('name: Sync listener playlists\n', sync_workflow)
        self.assertLess(sync_workflow.index('python3 scripts/sync-playlists.py'), sync_workflow.index('git commit'))
        self.assertLess(sync_workflow.index('git commit'), sync_workflow.index('git push'))
        for name in ['pages.yml', 'pages-pr-check.yml', 'sync-playlists.yml']:
            self.assertIn("python3 -m unittest discover -s tests -p 'test_playlist_sync.py' -v", (ROOT / '.github/workflows' / name).read_text())


if __name__ == '__main__':
    unittest.main()
