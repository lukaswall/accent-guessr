// Stages new EdAcc clips per data/expansion-spec.json. Writes staging/ ONLY -
// nothing enters clips.json until QA (transcription + waveform inspection)
// passes and the manifest update is applied deliberately.
//
// Window policy: prefer whole utterances of 9-14s (natural boundaries, no
// cutting). Longer utterances are trimmed at the silence gap closest to ~11.5s
// (natural pause boundary); if no usable silence exists the clip is cut at 12s
// and flagged boundary_uncertain for closer QA.
//
// Provenance: records HF mirror revision, row index, asset URL, sha256 of
// downloaded source bytes and of the output MP3. origin_status is "hf_mirror":
// the relationship between the HF copy's bytes and the current owner deposit is
// NOT verified, so deposit-equivalence stays explicitly unknown.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { execFileSync, spawnSync } from 'child_process';
import { createHash } from 'crypto';

const HF_REVISION = 'd9ae7bd344f0562b766ec93ee5ce8f2f9568ce66'; // /api/datasets/edinburghcstr/edacc .sha at ingest time - re-check each run
const OUT = new URL('../staging/', import.meta.url).pathname;
const spec = JSON.parse(readFileSync(new URL('../data/expansion-spec.json', import.meta.url)));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/g, '');
const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getJson(url, tries = 3) {
  for (let a = 0; ; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'accent-guessr-ingest' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) { if (a >= tries - 1) throw e; await sleep(1500 * (a + 1)); }
  }
}
async function getBytes(url, tries = 3) {
  for (let a = 0; ; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'accent-guessr-ingest' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) { if (a >= tries - 1) throw e; await sleep(1500 * (a + 1)); }
  }
}
const ff = (args) => execFileSync('ffmpeg', ['-v', 'quiet', ...args]);
const duration = (p) => parseFloat(execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', p]).toString());

function bestSilenceCut(path, lo = 9, hi = 13) {
  // returns {start, end, uncertain}
  const err = spawnSync('ffmpeg', ['-i', path, '-af', 'silencedetect=noise=-35dB:d=0.35', '-f', 'null', '-']).stderr?.toString() || '';
  const gaps = [];
  const re = /silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g; let m;
  while ((m = re.exec(err))) gaps.push([parseFloat(m[1]), parseFloat(m[2])]);
  const target = 11.5;
  const mids = gaps.filter(([a, b]) => a >= lo && a <= hi).map(([a, b]) => (a + b) / 2);
  if (!mids.length) return { start: 0, end: Math.min(12, duration(path)), uncertain: true };
  mids.sort((x, y) => Math.abs(x - target) - Math.abs(y - target));
  return { start: 0, end: Math.round(mids[0] * 10) / 10, uncertain: false };
}

const only = process.argv[2]; // optional single-speaker filter
const PER_SPEAKER = parseInt(process.env.CLIPS_PER_SPEAKER || '6', 10);
mkdirSync(OUT + 'clips', { recursive: true });
const staged = [];

for (const sp of spec.speakers) {
  if (only && sp.speaker !== only) continue;
  const labelInfo = spec.labels[sp.accent] || spec.labels[Object.keys(spec.labels).find(k => spec.labels[k].normalized_from === sp.accent)];
  const answer = spec.labels[sp.accent] ? sp.accent : Object.keys(spec.labels).find(k => spec.labels[k].normalized_from === sp.accent);
  const normalized = answer !== sp.accent ? sp.accent : null;
  const where = encodeURIComponent(`"speaker"='${sp.speaker}'`);
  const data = await getJson(`https://datasets-server.huggingface.co/filter?dataset=edinburghcstr/edacc&config=default&split=${sp.split}&where=${where}&limit=100&offset=0`);
  let made = 0, idx = 0;
  for (const row of data.rows) {
    if (made >= PER_SPEAKER) break;
    const src = row.row?.audio?.[0]?.src;
    if (!src) continue;
    let bytes;
    try { bytes = await getBytes(src); } catch (e) { console.error(sp.speaker, 'audio err', String(e).slice(0, 60)); continue; }
    const tmp = `${OUT}tmp.wav`;
    writeFileSync(tmp, bytes);
    const dur = duration(tmp);
    let win = null;
    if (dur >= 9 && dur <= 14) win = { start: 0, end: Math.round(dur * 10) / 10, uncertain: false };
    else if (dur > 14) { win = bestSilenceCut(tmp); if (win.uncertain) { idx++; continue; } } // no clean pause boundary: skip, never hard-cut
    else { idx++; continue; } // too short: skip, do not concatenate (boundaries unreviewable)
    const id = `${slug(answer)}-${slug(sp.speaker)}-c${made}`; // cN = candidate; final clips get -0/-1/-2 at selection
    const out = `${OUT}clips/${id}.mp3`;
    ff(['-y', '-i', tmp, '-ss', String(win.start), '-t', String(win.end - win.start), '-ac', '1', '-ar', '32000', '-b:a', '32k', out]);
    const outBytes = readFileSync(out);
    staged.push({
      id, answer, region: labelInfo.region, language: sp.l1, continent: labelInfo.continent,
      gender: sp.gender, speaker: sp.speaker, secs: Math.round((win.end - win.start) * 10) / 10,
      src: `clips/${id}.mp3`, staged_file: `staging/clips/${id}.mp3`,
      qa: { boundary_uncertain: win.uncertain, transcription_reviewed: false },
      source: {
        corpus: 'EdAcc', corpus_url: 'https://huggingface.co/datasets/edinburghcstr/edacc',
        license: spec.license.license, license_url: spec.license.license_url,
        deposit_url: spec.license.deposit_url, consent_info_url: spec.license.consent_info_url,
        reference_basis: 'current_owner_deposit', deposit_equivalence: 'unknown',
        split: sp.split, conversation: sp.speaker.replace(/-[AB]$/, ''), speaker_id: sp.speaker,
        origin_status: 'hf_mirror', hf_revision: HF_REVISION, hf_row_idx: row.idx ?? row.row_idx ?? null,
        asset_url: src, source_sha256: sha256(bytes), output_sha256: sha256(outBytes),
        excerpt: { start_sec: win.start, end_sec: win.end }, retrieved_date: new Date().toISOString().slice(0, 10),
        label_origin: 'corpus_metadata', label_normalized_from: normalized, import_batch: 'edacc-2026-10-26',
      },
    });
    console.log(`${sp.speaker} [${made}] ${id} ${win.start}-${win.end}s${win.uncertain ? ' BOUNDARY-UNCERTAIN' : ''}`);
    made++; idx++;
    await sleep(100);
  }
  if (made < 3) console.error(`${sp.speaker}: only ${made} candidates found (need 3 final)`);
}
const mpath = OUT + 'staged-manifest.json';
const prev = existsSync(mpath) ? JSON.parse(readFileSync(mpath)) : [];
const keep = prev.filter(p => !staged.some(s => s.speaker === p.speaker && s.id === p.id));
// drop manifest entries whose speaker is being re-staged in this run
const rerunSpeakers = new Set(staged.map(s => s.speaker));
const merged = prev.filter(p => !rerunSpeakers.has(p.speaker)).concat(staged);
writeFileSync(mpath, JSON.stringify(merged, null, 1));
console.log(`staged ${staged.length} clips (total manifest: ${merged.length}) -> staging/`);
