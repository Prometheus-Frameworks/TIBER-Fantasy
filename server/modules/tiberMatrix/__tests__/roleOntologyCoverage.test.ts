import { TIBER_MATRIX_ROLE_ONTOLOGY_V1 } from '../roleOntology';
import {
  TIBER_MATRIX_ROLE_IDS,
  CANONICAL_ROLE_IDS,
  REQUIRED_RICH_FIELDS,
  type RoleOntologyEntry,
} from '@shared/types/roleOntology';

describe('role ontology coverage', () => {
  it('every TIBER_MATRIX_ROLE_ID has an entry in the ontology dictionary', () => {
    for (const roleId of TIBER_MATRIX_ROLE_IDS) {
      expect(TIBER_MATRIX_ROLE_ONTOLOGY_V1.roles[roleId]).toBeDefined();
    }
  });

  it('ontology contains no extra roles beyond TIBER_MATRIX_ROLE_IDS', () => {
    const ontologyKeys = Object.keys(TIBER_MATRIX_ROLE_ONTOLOGY_V1.roles);
    const roleIdSet = new Set(TIBER_MATRIX_ROLE_IDS as readonly string[]);
    for (const key of ontologyKeys) {
      expect(roleIdSet.has(key)).toBe(true);
    }
  });

  it('every canonical role has all required rich metadata fields populated', () => {
    for (const roleId of CANONICAL_ROLE_IDS) {
      const entry: RoleOntologyEntry = TIBER_MATRIX_ROLE_ONTOLOGY_V1.roles[roleId];
      expect(entry).toBeDefined();

      for (const field of REQUIRED_RICH_FIELDS) {
        const fieldValue = entry[field];
        expect(fieldValue).toBeDefined();

        // Arrays should not be empty for canonical roles
        if (Array.isArray(fieldValue)) {
          expect(fieldValue.length).toBeGreaterThan(0);
        }

        // Strings should not be empty for canonical roles
        if (typeof fieldValue === 'string') {
          expect(fieldValue.length).toBeGreaterThan(0);
        }

        // Objects should have keys
        if (typeof fieldValue === 'object' && !Array.isArray(fieldValue) && fieldValue !== null) {
          expect(Object.keys(fieldValue).length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('every role entry has matching role_id key', () => {
    for (const [key, entry] of Object.entries(TIBER_MATRIX_ROLE_ONTOLOGY_V1.roles)) {
      expect(entry.role_id).toBe(key);
    }
  });

  it('every role entry has a valid position', () => {
    const validPositions = new Set(['QB', 'RB', 'WR', 'TE']);
    for (const entry of Object.values(TIBER_MATRIX_ROLE_ONTOLOGY_V1.roles)) {
      expect(validPositions.has(entry.position)).toBe(true);
    }
  });

  it('role_id prefix matches position field', () => {
    for (const entry of Object.values(TIBER_MATRIX_ROLE_ONTOLOGY_V1.roles)) {
      expect(entry.role_id.startsWith(entry.position + '_')).toBe(true);
    }
  });

  it('fallback_adjacent_roles reference valid role IDs', () => {
    const validIds = new Set(TIBER_MATRIX_ROLE_IDS as readonly string[]);
    for (const entry of Object.values(TIBER_MATRIX_ROLE_ONTOLOGY_V1.roles)) {
      for (const adj of entry.fallback_adjacent_roles) {
        expect(validIds.has(adj)).toBe(true);
      }
    }
  });

  it('usage_signature elevated/suppressed contain strings', () => {
    for (const entry of Object.values(TIBER_MATRIX_ROLE_ONTOLOGY_V1.roles)) {
      expect(Array.isArray(entry.usage_signature.elevated)).toBe(true);
      expect(Array.isArray(entry.usage_signature.suppressed)).toBe(true);
    }
  });

  it('unknown roles have empty core_traits, failure_modes, and upside_triggers', () => {
    const unknownIds = TIBER_MATRIX_ROLE_IDS.filter((id) => id.endsWith('_UNKNOWN'));
    expect(unknownIds.length).toBe(4); // one per position

    for (const roleId of unknownIds) {
      const entry = TIBER_MATRIX_ROLE_ONTOLOGY_V1.roles[roleId];
      expect(entry.core_traits).toEqual([]);
      expect(entry.common_failure_modes).toEqual([]);
      expect(entry.common_upside_triggers).toEqual([]);
      expect(entry.fallback_adjacent_roles).toEqual([]);
    }
  });
});
