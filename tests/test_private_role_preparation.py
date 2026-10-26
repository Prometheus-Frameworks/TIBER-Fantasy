"""Synthetic bytes only. Does not open or acquire the retained release."""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import subprocess
import sys
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
    def assert_preparation_refused_before_reads(self, output):
        argv = ['preparePrivateRoleEvidence.py', '--owner-private',
                '--archive', 'synthetic-unused.zip', '--output', str(output)]
        with patch.dict(os.environ, {}, clear=True), patch.object(sys, 'argv', argv), \
                patch.object(prepare, 'prepare', return_value={'synthetic': True}) as source, \
                patch('sys.stdout', new_callable=io.StringIO) as stdout, \
                patch('sys.stderr', new_callable=io.StringIO) as stderr:
            self.assertEqual(prepare.main(), 1)
            source.assert_not_called()
            self.assertEqual(stdout.getvalue(), '')
            self.assertEqual(stderr.getvalue(),
                             '{"status":"unavailable","reason":"private_preparation_refused"}\n')

    def test_preparation_rejects_dangling_output_before_reads(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            destination = root / 'never-created' / 'nested' / 'private.json'
            output = root / 'output.json'
            output.symlink_to(destination)
            self.assert_preparation_refused_before_reads(output)
            self.assertTrue(output.is_symlink())
            self.assertFalse(os.path.lexists(destination.parent.parent))

    def test_preparation_rejects_dangling_ancestors_before_reads(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            destination = root / 'never-created'
            ancestor = root / 'dangling'
            ancestor.symlink_to(destination, target_is_directory=True)
            for suffix in ('private.json', 'nested/deeper/private.json'):
                with self.subTest(suffix=suffix):
                    self.assert_preparation_refused_before_reads(ancestor / suffix)
                    self.assertTrue(ancestor.is_symlink())
                    self.assertFalse(os.path.lexists(destination))

    def test_preparation_preserves_existing_outputs_and_repository_guard(self):
        repo = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            existing = root / 'existing.json'
            existing.write_bytes(b'synthetic-existing')
            directory = root / 'existing-directory'
            directory.mkdir()
            link = root / 'existing-link.json'
            link.symlink_to(existing)
            repo_link = root / 'repository'
            repo_link.symlink_to(repo, target_is_directory=True)
            inside = repo / 'synthetic-refused-private-output.json'
            self.assertFalse(os.path.lexists(inside))
            for output in (existing, directory, link, repo_link / inside.name):
                with self.subTest(output=output.name):
                    self.assert_preparation_refused_before_reads(output)
            self.assertEqual(existing.read_bytes(), b'synthetic-existing')
            self.assertTrue(link.is_symlink())
            self.assertEqual(list(directory.iterdir()), [])
            self.assertFalse(os.path.lexists(inside))

    def test_preparation_accepts_fresh_nested_output_with_private_permissions(self):
        with tempfile.TemporaryDirectory() as d:
            output = Path(d) / 'fresh' / 'nested' / 'private.json'
            argv = ['preparePrivateRoleEvidence.py', '--owner-private',
                    '--archive', 'synthetic-unused.zip', '--output', str(output)]
            with patch.dict(os.environ, {}, clear=True), patch.object(sys, 'argv', argv), \
                    patch.object(prepare, 'prepare', return_value={'synthetic': True}) as source, \
                    patch('sys.stdout', new_callable=io.StringIO) as stdout:
                self.assertEqual(prepare.main(), 0)
                source.assert_called_once_with(Path('synthetic-unused.zip'))
                self.assertEqual(json.loads(output.read_bytes()), {'synthetic': True})
                self.assertEqual(output.stat().st_mode & 0o777, 0o600)
                self.assertEqual(output.parent.stat().st_mode & 0o777, 0o700)
                self.assertEqual(json.loads(stdout.getvalue())['status'], 'prepared_private')

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

    def test_private_builder_rejected_paths_create_no_directories(self):
        repo = Path(__file__).resolve().parents[1]
        env = {k: v for k, v in os.environ.items() if k not in prepare.CI_KEYS}
        pin = 'd5d4cb469fc0bed4b5df1576a424c21b102844a7d9bd7b937e240e53666c1083'
        with tempfile.TemporaryDirectory() as d:
            fake = Path(d) / 'synthetic.json'
            fake.write_text('{"synthetic":"must_not_become_evidence"}')
            tag = os.urandom(6).hex()
            # Lexical inside, symlink into the repo, and a dangling link aimed into the repo.
            (Path(d) / 'link').symlink_to(repo, target_is_directory=True)
            (Path(d) / 'dangling').symlink_to(repo / f'.reject-dangling-{tag}')
            cases = [(repo / f'.reject-lexical-{tag}' / 'sub' / 'worker.mjs', repo / f'.reject-lexical-{tag}', 'outside repository'),
                     (Path(d) / 'link' / f'.reject-link-{tag}' / 'worker.mjs', repo / f'.reject-link-{tag}', 'outside repository'),
                     (Path(d) / 'dangling' / 'sub' / 'worker.mjs', repo / f'.reject-dangling-{tag}', 'unresolvable'),
                     # Outside the repo but a substituted input: the pin fails before any directory exists.
                     (Path(d) / 'fresh' / 'nested' / 'worker.mjs', Path(d) / 'fresh', 'pin mismatch')]
            for output, created, reason in cases:
                result = subprocess.run(['node', 'scripts/buildLeagueReaderWorker.mjs', str(output), '--owner-private',
                                         '--role-evidence', str(fake), '--sha256', pin],
                                        cwd=repo, env=env, capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(reason, result.stderr)
                self.assertFalse(os.path.lexists(created), created)
                self.assertNotIn('must_not_become_evidence', result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
