#!/usr/bin/env python3
"""Owner-only byte verifier/packager. Never executes retained producer code."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import zipfile

ROOT = 'TIBER-ROP-2026-W01-W05/'
ARCHIVE_SHA = 'd2bb08b185c7ec73d80480ccc7cbc234ce02d89ac6d57308f6bcfa34ff69af13'
OUTPUT_SHA = '7cdfdb96fa5bbb1f6703698b83fe0f142c7498f74043be7bad72d6f5f3e91c49'
REVIEW_SHA = '3b39f6abb7710aa155e19b0217f56b08d00c13691cc1e67f5f7322d0789b79fd'
POPULATION_SHA = '05e1adeabe28f820a2ff722feaccd69044858393d190bdd7ebd4822e910d92c0'
PRODUCER = 'de9e540178cd8d45c8cbea5837a1ba7d0eaa020c'
CI_KEYS = ('CI', 'GITHUB_ACTIONS', 'GITLAB_CI', 'BUILDKITE', 'CIRCLECI', 'TF_BUILD', 'JENKINS_URL', 'TEAMCITY_VERSION')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def owner_paths(owner_private, output):
    if not owner_private or any(os.environ.get(k) for k in CI_KEYS):
        raise ValueError('owner_environment_required')
    repo = Path(__file__).resolve().parent.parent
    original = Path(output)
    if not original.is_absolute():
        raise ValueError('private_output_must_be_outside_repository')
    # Inspect unresolved entries first: resolve() hides dangling symlink outputs
    # and ancestors, allowing mkdir/open to create their destinations instead.
    if original.exists() or original.is_symlink():
        raise ValueError('output_already_exists')
    for parent in original.parents:
        if parent.is_symlink() and not parent.exists():
            raise ValueError('private_output_path_unresolvable')
    target = original.resolve()
    if target.is_relative_to(repo):
        raise ValueError('private_output_must_be_outside_repository')
    if target.exists():
        raise ValueError('output_already_exists')
    return target


def verify_members(archive, root, expected_count):
    names = [i.filename for i in archive.infolist() if not i.is_dir()]
    if len(names) != len(set(names)):
        raise ValueError('duplicate_member')
    manifest = json.loads(archive.read(root + 'MANIFEST.json'))
    entries = manifest['files']
    if len(entries) != expected_count or len({f['path'] for f in entries}) != len(entries):
        raise ValueError('invalid_manifest')
    if set(names) != {root + f['path'] for f in entries} | {root + 'MANIFEST.json'}:
        raise ValueError('member_set_mismatch')
    for entry in entries:
        data = archive.read(root + entry['path'])
        if len(data) != entry['size'] or digest(data) != entry['sha256']:
            raise ValueError('member_integrity_mismatch')
    return {f['path']: f for f in entries}


def prepare(source):
    # The archive is immutable and pinned before any ZIP member is read.
    if source.stat().st_size != 24420710 or digest(source.read_bytes()) != ARCHIVE_SHA:
        raise ValueError('archive_pin_mismatch')
    with zipfile.ZipFile(source) as archive:
        files = verify_members(archive, ROOT, 1216)
        def read(path, pin=None):
            data = archive.read(ROOT + path)
            if pin and digest(data) != pin:
                raise ValueError('binding_pin_mismatch')
            return json.loads(data)
        output = read('outputs/player-weeks.json', OUTPUT_SHA)
        population = read('population.json', POPULATION_SHA)
        review = read('review/output-review.json', REVIEW_SHA)
        if (review['disposition'] != 'clean' or review['material_findings'] or
                review['producer_revision'] != PRODUCER or output['producer']['rop_revision'] != PRODUCER or
                review['run_id'] != output['run_id'] or review['input_manifest_sha256'] != output['input_manifest_sha256'] or
                not any(f['path'] == 'outputs/player-weeks.json' and f['sha256'] == OUTPUT_SHA for f in review['output_files'])):
            raise ValueError('review_binding_mismatch')
        if population['scope'] != {'season': 2026, 'seasonType': 'REG', 'weeks': [1, 2, 3, 4, 5]}:
            raise ValueError('scope_mismatch')
        if len(population['players']) != 209 or len(output['rows']) != 1045:
            raise ValueError('coverage_mismatch')
        states = {}
        for row in output['rows']:
            path = row['state_path']
            if path is None:
                if row['coverage_status'] != 'missing_source_evidence':
                    raise ValueError('coverage_state_mismatch')
                continue
            full_path = 'outputs/' + path
            retained = read(full_path)
            state = retained['state']
            if (state['subject']['playerId'] != row['player_id'] or
                    state['scope'] != {'season': row['season'], 'seasonType': row['season_type'], 'week': row['week']} or
                    retained['binding']['handoff'] != row['input_handoff']['artifact'] or
                    retained['binding']['companionPin'] != row['companion']['pin']):
                raise ValueError('state_binding_mismatch')
            states[path] = {'reference': files[full_path], 'retained': retained}
        if len(states) != 939:
            raise ValueError('state_count_mismatch')
        return {
            'schemaVersion': 'tiber_private_rop_input_v1',
            'release': {
                'id': 'TIBER-ROP-2026-W01-W05-Private-Release', 'version': 2,
                'archiveSha256': ARCHIVE_SHA, 'outputSha256': OUTPUT_SHA,
                'manifestSha256': digest(archive.read(ROOT + 'MANIFEST.json')),
                'populationReference': files['population.json'],
                'outputReference': files['outputs/player-weeks.json'],
                'reviewReference': files['review/output-review.json'],
                'reviewDisposition': review['disposition'], 'reviewCompletedAt': review['completed_at'],
                'producerRevision': PRODUCER,
                'consumerEligibility': {
                    'operator': 'Joe', 'decision': 'step_1_accepted', 'date': '2026-10-22',
                    'path': 'TIBER MCP role-evidence', 'use': 'repeated_owner_private_descriptive_reads',
                    'sharing': 'none', 'promotion': 'none', 'otherConsumers': 'none',
                },
            },
            'metadata': {k: v for k, v in output.items() if k != 'rows'},
            'catalogue': population['players'], 'rows': output['rows'], 'states': states,
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--owner-private', action='store_true')
    parser.add_argument('--archive', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    try:
        target = owner_paths(args.owner_private, args.output)
        result = prepare(Path(args.archive))
        data = json.dumps(result, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        # Exclusive, restrictive write; reject pre-existing/symlink destinations.
        with os.fdopen(os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'wb') as handle:
            handle.write(data)
        print(json.dumps({'status': 'prepared_private', 'sha256': digest(data), 'bytes': len(data),
                          'verifiedMembers': 1216, 'rows': 1045, 'states': 939}))
    except Exception:
        # Do not print source paths, bytes, member names or exception details.
        print('{"status":"unavailable","reason":"private_preparation_refused"}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
