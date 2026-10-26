// Validates clips.json + data/schedule.json. Run before every commit that touches
// clips, the manifest or the schedule. Exit 1 on any failure.
import { readFileSync, existsSync } from 'fs';

let fail = 0;
let noLanguage = 0;
const bad = (msg) => { console.error('FAIL', msg); fail++; };

const clips = JSON.parse(readFileSync(new URL('../clips.json', import.meta.url)));
const ids = new Set();
for (const c of clips) {
  if (!c.id || ids.has(c.id)) bad(`duplicate/missing id: ${c.id}`);
  ids.add(c.id);
  for (const k of ['answer', 'region', 'continent', 'gender', 'speaker', 'src'])
    if (!c[k]) bad(`${c.id}: missing ${k}`);
  if (!c.language) noLanguage++; // language = speaker L1; empty means not recorded (do not invent)
  if (!(c.secs > 0)) bad(`${c.id}: bad secs ${c.secs}`);
  if (!existsSync(new URL('../' + c.src, import.meta.url))) bad(`${c.id}: missing file ${c.src}`);
  const s = c.source;
  if (!s) { bad(`${c.id}: no source block`); continue; }
  for (const k of ['corpus', 'corpus_url', 'license', 'license_url', 'deposit_url', 'split', 'conversation', 'speaker_id', 'origin_status', 'label_origin'])
    if (!s[k]) bad(`${c.id}: source missing ${k}`);
  if (!['unverified_version', 'pinned_deposit'].includes(s.origin_status)) bad(`${c.id}: bad origin_status ${s.origin_status}`);
  // excerpt windows: both or neither; never a half-record
  const ex = s.excerpt || {};
  if ((ex.start_sec == null) !== (ex.end_sec == null)) bad(`${c.id}: half-filled excerpt`);
  if (ex.start_sec != null && !(ex.end_sec > ex.start_sec)) bad(`${c.id}: bad excerpt window`);
  if (s.origin_status === 'pinned_deposit' && !s.retrieved_date) bad(`${c.id}: pinned_deposit without retrieved_date`);
}

const sched = JSON.parse(readFileSync(new URL('../data/schedule.json', import.meta.url)));
const dates = Object.keys(sched.sets || {});
for (const [date, setIds] of Object.entries(sched.sets || {})) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) bad(`schedule: bad date key ${date}`);
  if (!Array.isArray(setIds) || setIds.length !== 3) bad(`schedule ${date}: needs exactly 3 clips`);
  for (const id of setIds || []) if (!ids.has(id)) bad(`schedule ${date}: unknown clip id ${id}`);
  const answers = (setIds || []).map(id => clips.find(c => c.id === id)?.answer);
  if (new Set(answers).size !== answers.length) bad(`schedule ${date}: duplicate answer in set`);
}
// pinned dates must be contiguous from the first pinned date
const sorted = dates.sort();
if (sorted.length) {
  for (let d = new Date(sorted[0] + 'T00:00:00Z'), i = 0; i < sorted.length; d.setUTCDate(d.getUTCDate() + 1), i++)
    if (d.toISOString().slice(0, 10) !== sorted[i]) bad(`schedule: gap at ${d.toISOString().slice(0, 10)} (pins must be contiguous)`);
}

if (noLanguage) console.log(`note: ${noLanguage} clips have no language (speaker L1) recorded - backfill only from the corpus's l1 field if needed`);
console.log(fail ? `${fail} problem(s)` : `OK: ${clips.length} clips, ${dates.length} pinned dates (${sorted[0]}..${sorted[sorted.length - 1]})`);
process.exit(fail ? 1 : 0);
