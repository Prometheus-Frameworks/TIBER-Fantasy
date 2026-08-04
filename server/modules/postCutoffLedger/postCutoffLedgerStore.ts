/**
 * Append-only file store for post-cutoff signal ledger records (issue #297).
 *
 * Persistence boundary chosen for the pilot: repository-local candidate JSON
 * behind the authenticated API (the smallest durable option from the issue's
 * open implementation decision). Each revision is one immutable JSON file
 * under data/post-cutoff-ledger/records/ — written with the `wx` flag so an
 * existing record can never be overwritten. Edits, corroboration,
 * supersession, and closure append a new record that points at the record it
 * supersedes; history is always preserved and exportable as plain files.
 *
 * This store never touches Forecast outputs, promoted artifacts, rankings,
 * or player cards.
 */
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import {
  LedgerEntry,
  LedgerEntryView,
  LedgerRecord,
} from '@shared/postCutoffLedger';

export class PostCutoffLedgerStoreError extends Error {
  constructor(
    public readonly code: 'not_found' | 'conflict' | 'storage_failure',
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'PostCutoffLedgerStoreError';
  }
}

export interface ListEntriesOptions {
  /** Case-insensitive display-name match or exact canonical-id match. */
  player?: string;
  baselineRunId?: string;
  limit?: number;
}

export interface LedgerEntryDetail extends LedgerEntryView {
  history: LedgerRecord[];
}

const DEFAULT_DIR = () =>
  process.env.POST_CUTOFF_LEDGER_DIR || path.join(process.cwd(), 'data', 'post-cutoff-ledger');

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

export class PostCutoffLedgerStore {
  private readonly recordsDir: string;

  constructor(baseDir: string = DEFAULT_DIR()) {
    this.recordsDir = path.join(baseDir, 'records');
  }

  private async readAllRecords(): Promise<LedgerRecord[]> {
    let files: string[];
    try {
      files = await fs.readdir(this.recordsDir);
    } catch (error: any) {
      if (error?.code === 'ENOENT') return [];
      throw new PostCutoffLedgerStoreError('storage_failure', `Could not read ledger directory: ${error?.message}`, 500);
    }

    const records: LedgerRecord[] = [];
    for (const file of files.filter((f) => f.endsWith('.json')).sort()) {
      try {
        const rawText = await fs.readFile(path.join(this.recordsDir, file), 'utf-8');
        records.push(JSON.parse(rawText) as LedgerRecord);
      } catch (error: any) {
        // A corrupt record is surfaced, never silently skipped into "clean" state.
        throw new PostCutoffLedgerStoreError('storage_failure', `Ledger record ${file} is unreadable: ${error?.message}`, 500);
      }
    }
    return records;
  }

  private async writeRecord(record: LedgerRecord): Promise<void> {
    await fs.mkdir(this.recordsDir, { recursive: true });
    const file = path.join(this.recordsDir, `${record.record_id}.json`);
    try {
      // 'wx' fails if the file exists: records are immutable by construction.
      await fs.writeFile(file, JSON.stringify(record, null, 2), { flag: 'wx' });
    } catch (error: any) {
      if (error?.code === 'EEXIST') {
        throw new PostCutoffLedgerStoreError('conflict', `Record ${record.record_id} already exists and is immutable.`, 409);
      }
      throw new PostCutoffLedgerStoreError('storage_failure', `Could not persist ledger record: ${error?.message}`, 500);
    }
  }

  async createEntry(entry: LedgerEntry, changeNote: string | null = null): Promise<LedgerRecord> {
    const record: LedgerRecord = {
      record_id: newId('pclr'),
      ledger_entry_id: newId('pcl'),
      revision: 1,
      supersedes_record_id: null,
      recorded_at: new Date().toISOString(),
      change_note: changeNote,
      entry,
    };
    await this.writeRecord(record);
    return record;
  }

  async appendRevision(
    ledgerEntryId: string,
    entry: LedgerEntry,
    changeNote: string | null = null,
  ): Promise<LedgerRecord> {
    const history = await this.getHistory(ledgerEntryId);
    if (history.length === 0) {
      throw new PostCutoffLedgerStoreError('not_found', `Ledger entry ${ledgerEntryId} does not exist.`, 404);
    }
    const latest = history[history.length - 1];
    const record: LedgerRecord = {
      record_id: newId('pclr'),
      ledger_entry_id: ledgerEntryId,
      revision: latest.revision + 1,
      supersedes_record_id: latest.record_id,
      recorded_at: new Date().toISOString(),
      change_note: changeNote,
      entry,
    };
    await this.writeRecord(record);
    return record;
  }

  private async getHistory(ledgerEntryId: string): Promise<LedgerRecord[]> {
    const records = await this.readAllRecords();
    return records
      .filter((record) => record.ledger_entry_id === ledgerEntryId)
      .sort((a, b) => a.revision - b.revision);
  }

  async getEntry(ledgerEntryId: string): Promise<LedgerEntryDetail> {
    const history = await this.getHistory(ledgerEntryId);
    if (history.length === 0) {
      throw new PostCutoffLedgerStoreError('not_found', `Ledger entry ${ledgerEntryId} does not exist.`, 404);
    }
    const latest = history[history.length - 1];
    return {
      ledger_entry_id: ledgerEntryId,
      created_at: history[0].recorded_at,
      updated_at: latest.recorded_at,
      revision: latest.revision,
      entry: latest.entry,
      history,
    };
  }

  async listEntries(options: ListEntriesOptions = {}): Promise<LedgerEntryView[]> {
    const records = await this.readAllRecords();
    const byEntry = new Map<string, LedgerRecord[]>();
    for (const record of records) {
      const bucket = byEntry.get(record.ledger_entry_id) ?? [];
      bucket.push(record);
      byEntry.set(record.ledger_entry_id, bucket);
    }

    let views: LedgerEntryView[] = [];
    byEntry.forEach((history, ledgerEntryId) => {
      history.sort((a, b) => a.revision - b.revision);
      const latest = history[history.length - 1];
      views.push({
        ledger_entry_id: ledgerEntryId,
        created_at: history[0].recorded_at,
        updated_at: latest.recorded_at,
        revision: latest.revision,
        entry: latest.entry,
      });
    });

    if (options.player) {
      const needle = options.player.trim().toLowerCase();
      views = views.filter(
        (view) =>
          view.entry.player_ref.canonical_player_id?.toLowerCase() === needle ||
          view.entry.player_ref.display_name.trim().toLowerCase() === needle,
      );
    }
    if (options.baselineRunId) {
      views = views.filter((view) => view.entry.baseline_run_id === options.baselineRunId);
    }

    // Chronological ledger: newest first by creation time (append order).
    views.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (options.limit && options.limit > 0) views = views.slice(0, options.limit);
    return views;
  }

  async listBaselineRunIds(): Promise<string[]> {
    const records = await this.readAllRecords();
    return Array.from(new Set(records.map((record) => record.entry.baseline_run_id))).sort();
  }
}

export const postCutoffLedgerStore = new PostCutoffLedgerStore();
