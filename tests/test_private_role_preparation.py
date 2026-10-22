"""Synthetic bytes only. Does not open or acquire the retained release."""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import subprocess
import unittest
from unittest.mock import patch
import zipfile

spec = importlib.util.spec_from_file_location('prepare', Path(__file__).resolve().parents[1] / 'scripts/preparePrivateRoleEvidence.py')
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)


def synthetic_zip(*, corrupt=False, duplicate=False, extra=False):
    data = b'{"synthetic":"not_evidence"}'
    manifest = {'files': [{'path': 'sample.json', 'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()}]}
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w') as z:
        z.writestr('root/MANIFEST.json', json.dumps(manifest))
        z.writestr('root/sample.json', b'changed' if corrupt else data)
        if duplicate:
            z.writestr('root/sample.json', data)
        if extra:
            z.writestr('root/extra.json', data)
    buffer.seek(0)
    return zipfile.ZipFile(buffer)


class PreparationBoundary(unittest.TestCase):
    def test_synthetic_manifest_exactness(self):
        with synthetic_zip() as z:
            self.assertEqual(len(prepare.verify_members(z, 'root/', 1)), 1)
        for args in ({'corrupt': True}, {'duplicate': True}, {'extra': True}):
            with synthetic_zip(**args) as z, self.assertRaises(ValueError):
                prepare.verify_members(z, 'root/', 1)

    def test_wrong_archive_cannot_prepare(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'synthetic.zip'
            p.write_bytes(b'not_the_release')
            with self.assertRaises(ValueError):
                prepare.prepare(p)

    def test_private_path_and_ci_guards(self):
        with tempfile.TemporaryDirectory() as d, patch.dict(os.environ, {}, clear=True):
            output = str(Path(d) / 'private.json')
            self.assertEqual(prepare.owner_paths(True, output), Path(output))
            with self.assertRaises(ValueError):
                prepare.owner_paths(False, output)
            with self.assertRaises(ValueError):
                prepare.owner_paths(True, str(Path(__file__).resolve().parents[1] / 'private.json'))
            for key in prepare.CI_KEYS:
                with patch.dict(os.environ, {key: 'true'}), self.assertRaises(ValueError):
                    prepare.owner_paths(True, output)
            Path(output).touch()
            with self.assertRaises(ValueError):
                prepare.owner_paths(True, output)

    def test_private_builder_rejects_ci_and_substituted_input(self):
        repo = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as d:
            fake = Path(d) / 'synthetic.json'
            fake.write_text('{"synthetic":"must_not_become_evidence"}')
            output = Path(d) / 'worker.mjs'
            flags = ['node', 'scripts/buildLeagueReaderWorker.mjs', str(output), '--owner-private',
                     '--role-evidence', str(fake), '--sha256', hashlib.sha256(fake.read_bytes()).hexdigest()]
            # Even a matching caller-supplied digest must not accept substituted input.
            for ci in (False, True):
                env = {k: v for k, v in os.environ.items() if k not in prepare.CI_KEYS}
                if ci:
                    env['GITHUB_ACTIONS'] = 'true'
                result = subprocess.run(flags, cwd=repo, env=env, capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(output.exists())
                self.assertNotIn('must_not_become_evidence', result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
