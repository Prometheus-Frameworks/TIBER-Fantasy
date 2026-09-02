import type { CanonicalRegistryEntry } from '../canonicalization';

export interface DigestVector { id: string; payload: Record<string, unknown>; entry: CanonicalRegistryEntry; bytes: number; digest: `sha256:${string}`; preimage: string; }
const entry = (purpose: CanonicalRegistryEntry['purpose'], component: string): CanonicalRegistryEntry => ({
  purpose, component, schema: 'tiber.hypothesis-core/conformance-fixture-v0', projection: 'fixture_payload_v0', mode: 'test',
  arrayRules: [{ path: '/payload/steps', semantics: 'ordered' }, { path: '/payload/witness_types', semantics: 'set', key: '$scalar' }],
});
const make = (id: string, payload: Record<string, unknown>, e: CanonicalRegistryEntry, bytes: number, hash: string, preimage: string): DigestVector => ({ id, payload, entry: e, bytes, digest: `sha256:${hash}`, preimage });

export const DIGEST_VECTORS = Object.freeze({
  D1: make('D1',{id:'h_1'},entry('component_fingerprint','hypothesis_definition'),272,'da2f87dbc2894e5ef9fb6eb0d929553415dc92547b1af1476d052968e3542570','{"component":"hypothesis_definition","domain":"tiber.hypothesis-core","payload":{"id":"h_1"},"profile":"tiber.hypothesis-core.digest/jcs-sha256-v0","projection":"fixture_payload_v0","purpose":"component_fingerprint","schema":"tiber.hypothesis-core/conformance-fixture-v0"}'),
  D2: make('D2',{id:'h_1'},entry('component_fingerprint','football_evidence'),268,'36927fe1c2c0601e757f011d1205765c9dd6240b9fff5173ea2d81461d94699e','{"component":"football_evidence","domain":"tiber.hypothesis-core","payload":{"id":"h_1"},"profile":"tiber.hypothesis-core.digest/jcs-sha256-v0","projection":"fixture_payload_v0","purpose":"component_fingerprint","schema":"tiber.hypothesis-core/conformance-fixture-v0"}'),
  A2: make('A2',{id:'h_1',optional_note:null},entry('component_fingerprint','hypothesis_definition'),293,'72c41d7ab0d20612e3033fa8fb5e9056eda0e811073ba4a0f23c9525e527e9d0','{"component":"hypothesis_definition","domain":"tiber.hypothesis-core","payload":{"id":"h_1","optional_note":null},"profile":"tiber.hypothesis-core.digest/jcs-sha256-v0","projection":"fixture_payload_v0","purpose":"component_fingerprint","schema":"tiber.hypothesis-core/conformance-fixture-v0"}'),
  O1: make('O1',{id:'h_1',steps:['a','b']},entry('evaluation_output','composite_evaluation'),285,'938b403a588ebe7c443fc063a499d91e41795ff6a72271ac95b91f43c5b7108d','{"component":"composite_evaluation","domain":"tiber.hypothesis-core","payload":{"id":"h_1","steps":["a","b"]},"profile":"tiber.hypothesis-core.digest/jcs-sha256-v0","projection":"fixture_payload_v0","purpose":"evaluation_output","schema":"tiber.hypothesis-core/conformance-fixture-v0"}'),
  O2: make('O2',{id:'h_1',steps:['b','a']},entry('evaluation_output','composite_evaluation'),285,'7c43139d79478d2865d8e1dc3c2e0999064f89ca4bddd27b7aa3958e9dd22c40','{"component":"composite_evaluation","domain":"tiber.hypothesis-core","payload":{"id":"h_1","steps":["b","a"]},"profile":"tiber.hypothesis-core.digest/jcs-sha256-v0","projection":"fixture_payload_v0","purpose":"evaluation_output","schema":"tiber.hypothesis-core/conformance-fixture-v0"}'),
  S1: make('S1',{id:'h_1',witness_types:['target','snap']},entry('component_fingerprint','hypothesis_definition'),306,'809179a7bc165eebdde579f8539d4d983ed605e2d7bfaaa06b04f992de42800c','{"component":"hypothesis_definition","domain":"tiber.hypothesis-core","payload":{"id":"h_1","witness_types":["snap","target"]},"profile":"tiber.hypothesis-core.digest/jcs-sha256-v0","projection":"fixture_payload_v0","purpose":"component_fingerprint","schema":"tiber.hypothesis-core/conformance-fixture-v0"}'),
  T1: make('T1',{id:'h_1',observed_at:'2026-08-31T20:04:05.120-04:00'},entry('component_fingerprint','football_evidence'),309,'7bcb80e7b5fc151ba847f6b09cb656ddb032a6693f1232b67ae69fa9baa6a8f2','{"component":"football_evidence","domain":"tiber.hypothesis-core","payload":{"id":"h_1","observed_at":"2026-09-01T00:04:05.120Z"},"profile":"tiber.hypothesis-core.digest/jcs-sha256-v0","projection":"fixture_payload_v0","purpose":"component_fingerprint","schema":"tiber.hypothesis-core/conformance-fixture-v0"}'),
});

export const INVALID_DIGEST_INPUTS = Object.freeze([
  ['canonical_input_number_invalid', { id: 'h_1', n: 1.5 }],
  ['canonical_input_timestamp_invalid', { id: 'h_1', observed_at: '2026-09-01T00:04:05' }],
  ['canonical_input_timestamp_leap_second', { id: 'h_1', observed_at: '2026-09-01T00:04:60Z' }],
  ['canonical_input_timestamp_precision', { id: 'h_1', observed_at: '2026-09-01T00:04:05.1201Z' }],
] as const);
