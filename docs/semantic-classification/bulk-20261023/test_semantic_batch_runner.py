"""Offline safety checks for semantic_batch_runner."""
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

RUNNER = pathlib.Path(__file__).with_name("semantic_batch_runner.py")

class RunnerSafetyTests(unittest.TestCase):
    def test_rejects_incomplete_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            source = root / "snapshot.json"
            source.write_text(json.dumps([{"ep_id": "EP-00601", "title": "安保3文書", "eligible": True}]), encoding="utf-8")
            result = subprocess.run([sys.executable, str(RUNNER), "--input", str(source), "--classifier", "unused", "--output", str(root / "out")], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("expected exactly 5848", result.stderr)
            self.assertFalse((root / "out").exists())

    def test_requires_classifier(self):
        result = subprocess.run([sys.executable, str(RUNNER), "--help"], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)
        self.assertIn("--classifier", result.stdout)

if __name__ == "__main__":
    unittest.main()
