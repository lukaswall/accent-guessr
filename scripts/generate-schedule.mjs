// Generates data/schedule.json: pinned Daily sets (UTC date -> clip ids).
// Replicates the in-game algorithm EXACTLY (hashStr/mulberry32/shuffleArr/pickSet
// copied from app.js) so pinned sets equal what players already saw.
// Usage: node scripts/generate-schedule.mjs <from YYYY-MM-DD> <to YYYY-MM-DD> [--merge]
import { readFileSync, writeFileSync, existsSync } from 'fs';

const CLIPS = JSON.parse(readFileSync(new URL('../clips.json', import.meta.url)));

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffleArr(arr, rnd) {
  const s = arr.slice();
  for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = s[i]; s[i] = s[j]; s[j] = t; }
  return s;
}
function pickSet(seed, excludeIds, count = 5) {
  const rnd = mulberry32(seed);
  const pool = CLIPS.filter(c => !excludeIds.has(c.id));
  const source = pool.length >= count ? pool : CLIPS.slice();
  const shuffled = shuffleArr(source, rnd);
  const picked = [], cont = {};
  for (const c of shuffled) {
    if (picked.length >= count) break;
    if (picked.some(p => p.answer === c.answer)) continue;
    if ((cont[c.continent] || 0) >= 2) continue;
    picked.push(c); cont[c.continent] = (cont[c.continent] || 0) + 1;
  }
  return picked;
}

const [from, to] = process.argv.slice(2);
if (!from || !to) { console.error('usage: node scripts/generate-schedule.mjs <from> <to> [--merge]'); process.exit(1); }
const path = new URL('../data/schedule.json', import.meta.url);
let sched = {};
if (process.argv.includes('--merge') && existsSync(path)) sched = JSON.parse(readFileSync(path));
for (let d = new Date(from + 'T00:00:00Z'); d <= new Date(to + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
  const key = d.toISOString().slice(0, 10);
  const ids = pickSet(hashStr(`accent-guessr:${key}`), new Set(), 3).map(c => c.id);
  if (sched[key] && JSON.stringify(sched[key]) !== JSON.stringify(ids)) {
    console.error(`CONFLICT ${key}: pinned ${sched[key]} vs regenerated ${ids} - keeping pinned`);
    continue; // pinned (published) entries are immutable
  }
  sched[key] = ids;
}
writeFileSync(path, JSON.stringify({ _comment: 'Pinned Daily sets (UTC date -> clip ids). Entries are immutable once published; app.js uses a pinned entry when present and only falls back to the seeded pick for unpinned dates.', manifest_clips: CLIPS.length, sets: Object.fromEntries(Object.entries(sched).sort()) }, null, 1));
console.log(`schedule.json: ${Object.keys(sched).length} pinned dates (${from}..${to} window)`);
