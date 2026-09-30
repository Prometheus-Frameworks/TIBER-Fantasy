import { open } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { decodeWatsonModel } from '../draftReview/playerStateCardEvidence';
import { EVIDENCE_ID, evidenceCatalog, INPUT_LIMIT, RESULT_LIMIT, TOOL_NAMES } from './catalog';

export type EvidenceReader = () => Promise<Buffer>;
export class EvidenceFailure extends Error {
  constructor(public readonly code: 'busy' | 'evidence_unavailable') { super(code); }
}

/** Read at most the decoder's ceiling plus one byte, even if the file is replaced. */
export const readPinnedModel: EvidenceReader = async () => {
  const path = fileURLToPath(new URL('../draftReview/artifacts/watsonGbCase01ReadModel.json', import.meta.url));
  const file = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(40_001);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await file.read(buffer, offset, buffer.length - offset, null);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    return buffer.subarray(0, offset);
  } finally { await file.close(); }
};

export function createWeeklyEvidenceService(reader: EvidenceReader = readPinnedModel, readTimeoutMs = 5_000) {
  let reading = false;
  return {
    describe() {
      return {
        contract: 'tiber_weekly_evidence_offline_v0', tools: [...TOOL_NAMES],
        transport: 'local_stdio', input_limit_bytes: INPUT_LIMIT, result_limit_bytes: RESULT_LIMIT,
        source_mode: 'fixed_hash_local_projection', remote_consumer_enabled: false,
        unsupported: ['provider_fetch', 'producer_run', 'promotion', 'persistence', 'roster_transaction', 'remote_access'],
        limitations: ['Offline inspection is not remote ChatGPT acceptance.', 'Catalog presence does not certify current bytes or admission.'],
      };
    },
    list() { return evidenceCatalog(); },
    async get(id: string) {
      if (id !== EVIDENCE_ID) return {
        status: 'unavailable', reason: 'Evidence ID is not bound to this offline catalog.',
        producer_executed: false, substitution_performed: false,
      };
      if (reading) throw new EvidenceFailure('busy');
      reading = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      // A timed-out read retains its busy slot until the actual read settles.
      const pending = Promise.resolve().then(reader).finally(() => { reading = false; });
      try {
        // Reuse the exact reviewed decoder, preserving the entire model unchanged.
        const bytes = await Promise.race([
          pending,
          new Promise<Buffer>((_, reject) => { timer = setTimeout(() => reject(new EvidenceFailure('evidence_unavailable')), readTimeoutMs); }),
        ]);
        const model = decodeWatsonModel(bytes);
        return {
          status: 'available_for_offline_inspection', evidence_id: EVIDENCE_ID,
          remote_consumer_enabled: false, representation: 'reviewed_presentation_projection', model,
        };
      } catch {
        throw new EvidenceFailure('evidence_unavailable');
      } finally { if (timer) clearTimeout(timer); }
    },
  };
}
