// Adds a `source` provenance block to every clips.json entry. Re-runnable (idempotent).
// Rules (per project governance):
// - Existing 120 clips: exact origin version was never recorded -> origin_status
//   "unverified_version"; excerpt windows stay null (unknown stays unknown).
//   License/deposit fields describe the CURRENT owner deposit as the applicable
//   reference only (reference_basis), not the proven origin of these files.
// - Future imports (via scripts/ingest-edacc.mjs) pin the current deposit as exact
//   source and fill excerpt windows + retrieval date.
import { readFileSync, writeFileSync } from 'fs';

const path = new URL('../clips.json', import.meta.url);
const clips = JSON.parse(readFileSync(path));

const EDACC = {
  corpus: 'EdAcc',
  corpus_url: 'https://huggingface.co/datasets/edinburghcstr/edacc',
  license: 'CC BY-SA 4.0',
  license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
  deposit_url: 'https://datashare.ed.ac.uk/handle/10283/8983',
  consent_info_url: 'https://groups.inf.ed.ac.uk/edacc/',
};

for (const c of clips) {
  if (c.source) continue; // already has provenance (e.g. future imports) - never overwrite
  const m = c.speaker && c.speaker.match(/^(EDACC-C\d+)-([AB])$/);
  if (!m) throw new Error(`unrecognized speaker format: ${c.speaker} (${c.id})`);
  c.source = {
    ...EDACC,
    split: 'validation', // verified 2026-10-26: all 40 in-game speakers are in the validation split (parquet audit)
    conversation: m[1],
    speaker_id: c.speaker,
    origin_status: 'unverified_version',
    reference_basis: 'current_owner_deposit',
    excerpt: { start_sec: null, end_sec: null },
    retrieved_date: null,
    label_origin: 'corpus_metadata',
    label_normalized_from: null,
    import_batch: null,
  };
}
writeFileSync(path, JSON.stringify(clips, null, 1) + '\n');
console.log(`provenance added: ${clips.length} clips`);
