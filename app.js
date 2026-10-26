'use strict';
/* Accent Guessr - daily accent game. Vanilla JS, no dependencies. */

// Monetization wiring: no ad network is connected yet. When an ad account exists,
// set enabled + client/slot ids and the results-screen ad slot goes live.
// Until then nothing renders: no placeholders, no fake ads.
const ADS = { enabled: false, client: '', resultsSlot: '' };

// Display place for each corpus accent label: the place the label is named
// after. This is a display name for the label, NOT a claim about where any
// speaker was born or raised. "Eastern European" has no single namesake place.
const PLACE = {
  'Southern British English': 'Southern Britain', 'Scottish English': 'Scotland', 'Irish English': 'Ireland',
  'French': 'France', 'German': 'Germany', 'Dutch': 'Netherlands', 'Spanish': 'Spain',
  'Catalan': 'Catalonia', 'Italian': 'Italy', 'Bulgarian': 'Bulgaria',
  'Mainstream US English': 'United States', 'Jamaican English': 'Jamaica', 'Brazilian': 'Brazil',
  'Egyptian': 'Egypt', 'South African English': 'South Africa',
  'Chinese': 'China', 'Japanese': 'Japan', 'Vietnamese': 'Vietnam',
  'Indian English': 'India', 'Indonesian English': 'Indonesia',
  'Eastern European': 'Eastern Europe',
};

// Reference points for the places the accent labels are named after, used only
// for the coarse "how far off" hint. Region labels without a single namesake
// place (Eastern European) have no anchor and get continent-level text instead.
const COORDS = {
  'Southern British English': [51.5, -0.8], 'Scottish English': [56.8, -4.2], 'Irish English': [53.3, -8.2],
  'French': [46.6, 2.4], 'German': [51.1, 10.4], 'Dutch': [52.2, 5.3], 'Spanish': [40.3, -3.7],
  'Catalan': [41.6, 1.7], 'Italian': [42.8, 12.8], 'Bulgarian': [42.7, 25.5],
  'Mainstream US English': [39.8, -98.6], 'Jamaican English': [18.1, -77.3], 'Brazilian': [-10.8, -52.9],
  'Egyptian': [26.8, 30.8], 'South African English': [-30.6, 22.9],
  'Chinese': [35.9, 104.2], 'Japanese': [36.2, 138.3], 'Vietnamese': [14.1, 108.3],
  'Indian English': [21.0, 78.0], 'Indonesian English': [-2.2, 113.9],
};
// Continent per answer option, for honest proximity text when an answer has no
// precise anchor (e.g. "Eastern Europe" is a documented corpus label, not a point).
const GUESS_CONTINENT = {
  'Southern British English': 'Europe', 'Scottish English': 'Europe', 'Irish English': 'Europe',
  'French': 'Europe', 'German': 'Europe', 'Dutch': 'Europe', 'Spanish': 'Europe', 'Catalan': 'Europe',
  'Italian': 'Europe', 'Bulgarian': 'Europe', 'Eastern European': 'Europe',
  'Mainstream US English': 'North America', 'Jamaican English': 'North America', 'Brazilian': 'South America',
  'Egyptian': 'Africa', 'South African English': 'Africa',
  'Chinese': 'Asia', 'Japanese': 'Asia', 'Vietnamese': 'Asia', 'Indian English': 'Asia', 'Indonesian English': 'Asia',
};
const GROUP_ORDER = ['Europe', 'Africa', 'Asia', 'North America', 'South America'];

// Extra search terms per label. Kept strictly per label so countries stay
// separate: "spain" finds Spain (Spanish) only, "catalonia" finds Catalonia
// (Catalan) only, "uk" finds the two UK labels as separate rows.
const SEARCH_TERMS = {
  'Southern British English': ['england', 'britain', 'british', 'uk', 'united kingdom', 'english'],
  'Scottish English': ['scotland', 'scottish', 'uk', 'united kingdom'],
  'Irish English': ['ireland', 'irish'],
  'Mainstream US English': ['usa', 'us', 'america', 'american', 'united states'],
  'Jamaican English': ['jamaica', 'jamaican'],
  'South African English': ['south africa', 'south african'],
  'Indian English': ['india'],
  'Indonesian English': ['indonesia'],
  'French': ['france'],
  'German': ['germany'],
  'Dutch': ['netherlands', 'holland'],
  'Spanish': ['spain'],
  'Catalan': ['catalonia'],
  'Italian': ['italy'],
  'Bulgarian': ['bulgaria'],
  'Brazilian': ['brazil'],
  'Egyptian': ['egypt'],
  'Chinese': ['china'],
  'Japanese': ['japan'],
  'Vietnamese': ['vietnam'],
  'Eastern European': ['eastern europe'],
};

// Map highlight per answer (Natural Earth ADM0_A3 country codes): the country
// the label is named after. Shown only after the reveal.
const MAP_ISO = {
  'Irish English': ['IRL'],
  'French': ['FRA'], 'German': ['DEU'], 'Dutch': ['NLD'], 'Spanish': ['ESP'],
  'Italian': ['ITA'], 'Bulgarian': ['BGR'],
  'Mainstream US English': ['USA'], 'Jamaican English': ['JAM'], 'Brazilian': ['BRA'],
  'Egyptian': ['EGY'], 'South African English': ['ZAF'],
  'Chinese': ['CHN'], 'Japanese': ['JPN'], 'Vietnamese': ['VNM'],
  'Indian English': ['IND'], 'Indonesian English': ['IDN'],
};
// Labels named after a region rather than one country get a soft ellipse on
// the map instead (coordinates are in the map's 1000x394 viewBox space).
const MAP_REGION = {
  'Catalan': { cx: 505, cy: 117, rx: 15, ry: 15 },
  'Eastern European': { cx: 575, cy: 92, rx: 45, ry: 26 },
  // Scotland and Southern Britain have no single-country shape; shown as
  // approximate regions (same visual language as Catalan / Eastern European).
  'Scottish English': { cx: 488, cy: 74, rx: 14, ry: 11 },
  'Southern British English': { cx: 497, cy: 92, rx: 17, ry: 8 },
};

// Hard mode: the same clip, revealed progressively. You start with 2 seconds;
// each wrong guess or skip unlocks the next step (3 s, 5 s, then the full
// clip). Solving earlier scores more.
const TURNS = 3; // guesses per voice outside hard mode; there are no text clues anymore
const HARD_STEPS = [2, 5]; // seconds; anything past the last entry = full clip

// Short modes: the same game, but every voice is capped at one fixed length.
// Each length is its own mode with its own saved best.
const SHORT = {
  s2: { sec: 2, label: '2 seconds' },
  s3: { sec: 3, label: '3 seconds' },
  s5: { sec: 5, label: '5 seconds' },
};

// Quick pick mode: the same listening game with four written options instead
// of the search box.

function kmBetween(p, q) {
  const rad = Math.PI / 180, dLat = (q[0] - p[0]) * rad, dLon = (q[1] - p[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p[0] * rad) * Math.cos(q[0] * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)));
}
function kmOff(guess, answer) {
  const g = COORDS[guess], a = COORDS[answer];
  if (!g || !a) return null;
  return kmBetween(g, a);
}
function fmtKm(km) {
  if (km < 100) return 'under 100 km';
  const rounded = km < 1000 ? Math.round(km / 50) * 50 : Math.round(km / 100) * 100;
  return `about ${rounded.toLocaleString('en-US')} km`;
}

// The clip library: metadata for all 120 voices lives in clips.json (about
// 32 KB), loaded by boot() before the first render. Audio is one small MP3
// per voice, fetched only when that round starts, so the first page load no
// longer downloads the whole library.
let CLIPS = [];
let ANSWERS = [];

// Ranked search over accent label, display place and per-label terms.
// Exact match first, then prefix matches, then substring matches.
function filterAnswers(q) {
  const query = q.trim().toLowerCase();
  if (!query) return ANSWERS.slice();
  const scored = [];
  for (const a of ANSWERS) {
    const terms = [a.toLowerCase(), (PLACE[a] || '').toLowerCase()].concat(SEARCH_TERMS[a] || []);
    let best = -1;
    for (const t of terms) {
      if (!t) continue;
      if (t === query) { best = 0; break; }
      if (t.startsWith(query)) { if (best === -1 || best > 1) best = 1; }
      else if (t.includes(query)) { if (best === -1) best = 2; }
    }
    if (best !== -1) scored.push([best, a]);
  }
  scored.sort((x, y) => x[0] - y[0] || (PLACE[x[1]] || x[1]).localeCompare(PLACE[y[1]] || y[1]));
  return scored.map(s => s[1]);
}

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
// Endless/hard queue: shuffled pool, no immediate same-answer or same-speaker repeats.
function buildQueue(seed, excludeIds) {
  const rnd = mulberry32(seed);
  const pool = shuffleArr(CLIPS.filter(c => !excludeIds.has(c.id)), rnd);
  const queue = [];
  for (const c of pool) {
    const last = queue[queue.length - 1];
    if (last && (last.answer === c.answer || last.speaker === c.speaker)) continue;
    queue.push(c);
  }
  return queue;
}
function pad2(n) { return String(n).padStart(2, '0'); }
// The daily set changes at 00:00 UTC for everyone, worldwide (not local
// midnight), so all players get the same voices for the same date. The date
// string is the selector seed, so each UTC date keeps its established set.
function todayStr() { const d = new Date(); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`; }
function prettyDate() { return new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); }
// Three guesses per voice. Scores 3/2/1/0 (same /15 daily scale as the original game); hard mode scores 3/2/1/0 (solved from less audio = more).
function squares(p) {
  {
    return p >= 3 ? '🟩' : p === 2 ? '🟨' : p === 1 ? '🟧' : '⬛';
  }
}

const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} },
};
const EMPTY_STATS = { plays: 0, best: 0, streak: 0, lastDaily: null, lastRounds: [] };
const EMPTY_ENDLESS = { best: 0, runs: 0 };
const EMPTY_HARD = { best: 0, runs: 0 };
const EMPTY_SHORTS = { s2: { best: 0, runs: 0 }, s3: { best: 0, runs: 0 }, s5: { best: 0, runs: 0 } };
const EMPTY_QUICK = { best: 0, runs: 0 };

const state = {
  screen: 'home', // home | modes | progress | play | results
  mode: 'daily',  // daily | practice | endless | hard | short | quick
  set: [],
  index: 0,
  rounds: [],
  cleared: 0,
  stats: store.get('accent-guessr.stats.v1', EMPTY_STATS),
  endless: store.get('accent-guessr.endless.v1', EMPTY_ENDLESS),
  hard: store.get('accent-guessr.hard.v1', EMPTY_HARD),
  short: store.get('accent-guessr.shorts.v1', EMPTY_SHORTS),
  shortMode: 's2',
  quick: store.get('accent-guessr.quick.v1', EMPTY_QUICK),
  seen: store.get('accent-guessr.practice-seen.v1', []),
};

// Tolerate older/partial saved shapes for the short-mode stats.
for (const k of Object.keys(SHORT)) {
  if (!state.short[k] || typeof state.short[k].best !== 'number') state.short[k] = { best: 0, runs: 0 };
}
for (const k of ['quick']) {
  if (!state[k] || typeof state[k].best !== 'number') state[k] = { best: 0, runs: 0 };
}

let audio = null;
function stopAudio() { if (audio) { audio.pause(); audio = null; } }
let preloadedClip = null;
// Fetch the next voice's MP3 in the background while the player guesses, so
// the following round starts instantly. The browser cache serves it when the
// next round creates its own Audio for the same URL.
function preloadNextClip() {
  const nxt = state.set[state.index + 1];
  if (!nxt || (preloadedClip && preloadedClip._agClip === nxt.id)) return;
  preloadedClip = new Audio();
  preloadedClip._agClip = nxt.id;
  preloadedClip.preload = 'auto';
  preloadedClip.src = nxt.src;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// World map (Natural Earth boundaries) shown only after the reveal. The answer
// highlight marks the place the accent label is named after - never a claim
// about where the speaker is from. Wrong guesses are shown in grey.
function buildMap(answer, wrongs) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${MAP.w} ${MAP.h}`);
  svg.setAttribute('class', 'ag-map');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', answer ? `World map highlighting ${PLACE[answer] || answer}` : 'World map');
  const answerSet = new Set(MAP_ISO[answer] || []);
  const wrongSet = new Set();
  wrongs.forEach(w => (MAP_ISO[w] || []).forEach(c => wrongSet.add(c)));
  for (const code of Object.keys(MAP.c)) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', MAP.c[code]);
    p.setAttribute('class', 'ag-map-c' + (answerSet.has(code) ? ' is-answer' : wrongSet.has(code) ? ' is-wrong' : ''));
    svg.appendChild(p);
  }
  const drawRegion = (lbl, cls) => {
    const r = MAP_REGION[lbl];
    if (!r) return;
    const e = document.createElementNS(NS, 'ellipse');
    e.setAttribute('cx', r.cx); e.setAttribute('cy', r.cy);
    e.setAttribute('rx', r.rx); e.setAttribute('ry', r.ry);
    e.setAttribute('class', cls);
    svg.appendChild(e);
  };
  wrongs.forEach(w => { if (MAP_REGION[w]) drawRegion(w, 'ag-map-region is-wrong'); });
  if (MAP_REGION[answer]) drawRegion(answer, 'ag-map-region is-answer');
  return svg;
}

const app = document.getElementById('app');
let countdownTimer = null;

function render() {
  stopAudio();
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
  app.innerHTML = '';
  if (state.screen === 'home') renderHome();
  else if (state.screen === 'play') renderRound();
  else if (state.screen === 'modes') renderModes();
  else if (state.screen === 'progress') renderProgress();
  else renderResults();
}

function header() {
  const h = el('header', 'ag-header');
  h.appendChild(el('p', 'ag-date', prettyDate()));
  h.appendChild(el('p', 'ag-intro', 'Real voices. Listen, then guess which accent each speaker has.'));
  return h;
}
function about() {
  const g = el('section', 'ag-about-block');
  g.appendChild(el('h2', 'ag-about-title', 'About the voices'));
  const p = el('p', 'ag-about');
  p.innerHTML = 'Every clip is a real person in a recorded conversation, from the <a href="https://huggingface.co/datasets/edinburghcstr/edacc" target="_blank" rel="noopener">EdAcc corpus</a> (University of Edinburgh), shared under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>. These clips are shortened excerpts; this edited set is shared under the same license, with <a href="https://github.com/lukaswall/accent-guessr/blob/main/ATTRIBUTION.md" target="_blank" rel="noopener">per-clip credits and the edited set</a> in the source repository. The answer is the corpus\'s own accent label for that recording. An accent label is a description of speech, not a fact about where someone was born or raised, so treat it as that, not a verdict on anyone. The map after each reveal highlights the place a label is named after (country boundaries: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>, public domain) - not where the speaker is from.';
  g.appendChild(p);
  const c = el('p', 'ag-closing', 'Your streaks and scores stay on this device.');
  g.appendChild(c);
  return g;
}

function countdownLine() {
  const p = el('p', 'ag-countdown');
  const tick = () => {
    const now = new Date();
    const mid = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
    const s = Math.max(0, Math.floor((mid - now) / 1000));
    p.textContent = `New voices at 00:00 UTC - in ${Math.floor(s / 3600)}h ${pad2(Math.floor((s % 3600) / 60))}m ${pad2(s % 60)}s`;
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
  return p;
}

function startPractice() {
  const excl = new Set(state.seen);
  const set = pickSet(hashStr(`practice:${Date.now()}`), excl);
  state.seen = state.seen.concat(set.map(c => c.id));
  if (state.seen.length >= CLIPS.length - 4) state.seen = [];
  store.set('accent-guessr.practice-seen.v1', state.seen);
  state.mode = 'practice'; state.set = set; state.index = 0; state.rounds = []; state.cleared = 0; state.screen = 'play'; render();
}
function startEndless() {
  state.mode = 'endless';
  state.set = buildQueue(hashStr(`endless:${Date.now()}`), new Set());
  state.index = 0; state.rounds = []; state.cleared = 0; state.screen = 'play'; render();
}
function startHard() {
  state.mode = 'hard';
  state.set = buildQueue(hashStr(`hard:${Date.now()}`), new Set());
  state.index = 0; state.rounds = []; state.cleared = 0; state.screen = 'play'; render();
}
function startShort(key) {
  state.mode = 'short';
  state.shortMode = key;
  state.set = buildQueue(hashStr(`short:${key}:${Date.now()}`), new Set());
  state.index = 0; state.rounds = []; state.cleared = 0; state.screen = 'play'; render();
}
function startQuick() {
  state.mode = 'quick';
  state.set = buildQueue(hashStr(`quick:${Date.now()}`), new Set());
  state.index = 0; state.rounds = []; state.cleared = 0; state.screen = 'play'; render();
}

// Account gate (inert unless accounts are configured in auth-config.js).
// gated() wraps a mode starter with the sign-in wall; gateMark() adds a lock
// hint to the button label while the mode needs a login.
function gated(modeKey, fn) {
  return () => { if (window.AGAuth && AGAuth.gateInterception(modeKey)) return; fn(); };
}
function gateMark(modeKey, btn) {
  if (!(window.AGAuth && AGAuth.needsLogin(modeKey))) return;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'ag-lock');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>';
  btn.appendChild(s);
  btn.classList.add('is-locked');
}


function navIcon(kind) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'ag-nav-ic');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = kind === 'daily'
    ? '<circle cx="12" cy="12" r="8.5"/><path d="M10 8.6l5 3.4-5 3.4z" fill="currentColor" stroke="none"/>'
    : kind === 'modes'
    ? '<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>'
    : '<path d="M4 20h16"/><path d="M7.5 20v-5"/><path d="M12 20V7"/><path d="M16.5 20v-9"/>';
  return s;
}

function navBar(active) {
  const nav = el('nav', 'ag-nav');
  if (active === 'play') {
    const back = el('button', 'ag-nav-back');
    back.type = 'button';
    const arr = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arr.setAttribute('viewBox', '0 0 24 24');
    arr.setAttribute('class', 'ag-nav-ic');
    arr.setAttribute('aria-hidden', 'true');
    arr.innerHTML = '<path d="M15 5l-7 7 7 7"/>';
    back.appendChild(arr);
    back.appendChild(el('span', null, 'Back'));
    back.onclick = () => { state.screen = 'home'; render(); };
    nav.appendChild(back);
    const NAMES = { daily: 'Daily', quick: 'Quick pick', endless: 'Endless', hard: 'Hard mode', short: 'Short clips', practice: 'Practice' };
    nav.appendChild(el('span', 'ag-nav-mode', NAMES[state.mode] || ''));
    nav.appendChild(el('span', 'ag-nav-mode', ''));
    return nav;
  }
  const brand = el('button', 'ag-nav-brand', 'Accent Guessr');
  brand.type = 'button';
  brand.onclick = () => { state.screen = 'home'; render(); };
  nav.appendChild(brand);
  const tabs = el('div', 'ag-nav-tabs');
  [['daily', 'Daily', 'home'], ['modes', 'Modes', 'modes'], ['progress', 'Progress', 'progress']].forEach(([key, lab, scr]) => {
    const b = el('button', 'ag-nav-tab' + (active === key ? ' is-active' : ''));
    b.type = 'button';
    b.appendChild(navIcon(key));
    b.appendChild(el('span', 'ag-nav-lab', lab));
    b.onclick = () => {
      if (key === 'daily' && state.stats.lastDaily !== todayStr()) { startDaily(); return; }
      state.screen = scr; render();
    };
    tabs.appendChild(b);
  });
  nav.appendChild(tabs);
  return nav;
}

function startDaily() {
  const today = todayStr();
  state.mode = 'daily'; state.set = pickSet(hashStr(`accent-guessr:${today}`), new Set(), 3);
  state.index = 0; state.rounds = []; state.cleared = 0; state.screen = 'play'; render();
}

function doneBlock() {
  const done = el('div', 'ag-done');
  const sq = el('div', 'ag-squares');
  state.stats.lastRounds.forEach(r => sq.appendChild(el('span', null, squares(r.points))));
  done.appendChild(sq);
  done.appendChild(el('p', 'ag-done-score', `Today: ${state.stats.lastRounds.reduce((s, r) => s + r.points, 0)} / ${state.stats.lastRounds.length * (state.stats.scale5 ? 5 : TURNS)}`));
  done.appendChild(countdownLine());
  return done;
}

function renderHome() {
  app.appendChild(navBar('daily'));
  app.appendChild(header());
  const home = el('div', 'ag-home');
  if (state.stats.lastDaily === todayStr()) {
    home.appendChild(doneBlock());
  } else {
    const b = el('button', 'ag-btn is-primary is-big', "Play today's set");
    b.onclick = startDaily;
    home.appendChild(b);
    home.appendChild(countdownLine());
  }
  const strip = el('button', 'ag-strip', `${state.stats.streak} day streak · ${state.stats.plays} days played`);
  strip.type = 'button';
  strip.onclick = () => { state.screen = 'progress'; render(); };
  home.appendChild(strip);
  const aboutBlock = about();
  aboutBlock.style.display = 'none';
  const foot = el('div', 'ag-foot');
  const credBtn = el('button', 'ag-linklike', 'Credits & sources');
  credBtn.type = 'button';
  credBtn.onclick = () => {
    const opening = aboutBlock.style.display === 'none';
    aboutBlock.style.display = opening ? '' : 'none';
    credBtn.textContent = opening ? 'Hide credits' : 'Credits & sources';
  };
  foot.appendChild(credBtn);
  if (window.AGAuth) { const ac = AGAuth.accountControl(); if (ac) foot.appendChild(ac); }
  home.appendChild(foot);
  app.appendChild(home);
  app.appendChild(aboutBlock);
}

function renderModes() {
  app.appendChild(navBar('modes'));
  const home = el('div', 'ag-home');
  const h = el('header', 'ag-header');
  h.appendChild(el('h1', 'ag-title is-small', 'More ways to play'));
  home.appendChild(h);
  const modeRow = el('div', 'ag-mode-row');
  [['Quick pick', startQuick]].forEach(([lab, fn]) => {
    const b = el('button', 'ag-btn is-primary', lab);
    gateMark('quick', b);
    b.onclick = gated('quick', fn);
    modeRow.appendChild(b);
  });
  home.appendChild(modeRow);
  const runRow = el('div', 'ag-mode-row');
  [['Endless', startEndless], ['Hard · 2 s start', startHard]].forEach(([lab, fn]) => {
    const key = fn === startEndless ? 'endless' : 'hard';
    const b = el('button', 'ag-btn is-primary', lab);
    gateMark(key, b);
    b.onclick = gated(key, fn);
    runRow.appendChild(b);
  });
  home.appendChild(runRow);
  home.appendChild(el('p', 'ag-home-sub', 'Short clips - pick how much of each voice you hear'));
  const shortRow = el('div', 'ag-mode-row');
  Object.keys(SHORT).forEach((key) => {
    const b = el('button', 'ag-btn is-ghost', SHORT[key].label);
    gateMark('short', b);
    b.onclick = gated('short', () => startShort(key));
    shortRow.appendChild(b);
  });
  home.appendChild(shortRow);
  const p = el('button', 'ag-btn is-ghost is-big', 'Practice');
  p.onclick = startPractice;
  home.appendChild(p);
  app.appendChild(home);
}

function renderProgress() {
  app.appendChild(navBar('progress'));
  const home = el('div', 'ag-home');
  const h = el('header', 'ag-header');
  h.appendChild(el('h1', 'ag-title is-small', 'Your progress'));
  h.appendChild(el('p', 'ag-date', prettyDate()));
  home.appendChild(h);
  if (state.stats.lastDaily === todayStr()) home.appendChild(doneBlock());
  else home.appendChild(countdownLine());
  const stats = el('div', 'ag-stats');
  [['day streak', state.stats.streak], ['days played', state.stats.plays], ['best daily', state.stats.best9 || 0], ...(state.stats.best ? [['best daily (5-voice era /15)', state.stats.best]] : []), ...(state.stats.best5 ? [['best daily (5-guess era /25)', state.stats.best5]] : []), ['best endless', state.endless.best], ['best hard', state.hard.best], ['best short', Math.max(state.short.s2.best, state.short.s3.best, state.short.s5.best)], ['best quick', state.quick.best]].forEach(([label, num]) => {
    const d = el('div');
    d.appendChild(el('span', 'ag-stat-num', String(num)));
    d.appendChild(el('span', 'ag-stat-label', label));
    stats.appendChild(d);
  });
  home.appendChild(stats);
  const foot = el('div', 'ag-foot');
  if (window.AGAuth) { const ac = AGAuth.accountControl(); if (ac) foot.appendChild(ac); }
  home.appendChild(foot);
  app.appendChild(home);
}

let roundState = null; // { played, wrong[], over, solved, skipped, step }

function renderRound() {
  const clip = state.set[state.index];
  const total = state.set.length;
  const isHard = state.mode === 'hard';
  const isShort = state.mode === 'short';
  const isQuick = state.mode === 'quick';
  const isRun = state.mode === 'endless' || isHard || isShort || isQuick;
  roundState = { played: false, wrong: [], over: false, solved: false, skipped: false, step: 0, clues: 0 };

  app.appendChild(navBar('play'));
  const round = el('div', 'ag-round');

  const prog = el('div', 'ag-progress');
  if (isRun) {
    const runName = isHard ? 'Hard' : isShort ? SHORT[state.shortMode].label : isQuick ? 'Quick pick' : 'Endless';
    prog.appendChild(el('span', 'ag-round-no', `${runName} · voice ${state.index + 1} · streak ${state.cleared}`));
  } else {
    for (let i = 0; i < total; i++) prog.appendChild(el('span', 'ag-dot' + (i === state.index ? ' is-now' : i < state.index ? ' is-done' : '')));
    prog.appendChild(el('span', 'ag-round-no', `${state.mode === 'daily' ? 'Daily' : 'Practice'} · ${state.index + 1} of ${total}`));
  }
  round.appendChild(prog);

  // Hard mode caps the audio at the current step (the cap lifts as the player
  // guesses or skips); short modes cap every voice at one fixed length. Replay
  // always restarts from 0 and never goes past the unlocked window.
  const audioLimit = () => {
    if (isHard) return roundState.step < HARD_STEPS.length ? HARD_STEPS[roundState.step] : Infinity;
    if (isShort) return SHORT[state.shortMode].sec;
    return Infinity;
  };
  const hintText = () => {
    const lim = audioLimit();
    if (isHard) return isFinite(lim) ? `Hard mode: first ${lim} seconds unlocked · a wrong guess or skip unlocks more audio` : 'Hard mode: full clip unlocked · a miss now ends the round';
    if (isFinite(lim)) return `First ${lim} seconds unlocked · replay as much as you like`;
    return 'Replay as much as you like';
  };

  let input = null; let quickBtns = null;

  // Player: a clear play/pause toggle, a replay-from-start button, a live
  // time readout and a progress bar. The clock and bar always cover the
  // currently unlocked window (fixed cap in short modes, rising cap in hard,
  // full clip elsewhere), so replay never goes past what has been unlocked.
  const fmtT = (s) => { const t = Math.max(0, Math.floor(s)); return `${Math.floor(t / 60)}:${pad2(t % 60)}`; };
  const playSvg = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4.8v14.4c0 .9 1 1.5 1.8 1L19 13a1.2 1.2 0 0 0 0-2L7.8 3.9c-.8-.5-1.8 0-1.8.9Z"/></svg>';
  const pauseSvg = '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="4.5" width="3.6" height="15" rx="1.4"/><rect x="13.9" y="4.5" width="3.6" height="15" rx="1.4"/></svg>';
  const replaySvg = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 4.5v5h5"/><path d="M4.6 13a8 8 0 1 0 .9-6.6L3.5 9.5"/></svg>';

  const playerBox = el('div', 'ag-player2');
  const playerRow = el('div', 'ag-player-row');
  const replayBtn = el('button', 'ag-icon-btn');
  replayBtn.type = 'button';
  replayBtn.setAttribute('aria-label', 'Replay from the start');
  replayBtn.innerHTML = replaySvg;
  const playBtn = el('button', 'ag-playbtn');
  playBtn.type = 'button';
  playBtn.setAttribute('aria-label', 'Play voice');
  const ring = el('span', 'ag-player-ring');
  const core = el('span', 'ag-player-core');
  core.innerHTML = playSvg;
  ring.appendChild(core);
  playBtn.appendChild(ring);
  const timeEl = el('span', 'ag-time', '0:00 / –:––');
  playerRow.appendChild(replayBtn);
  playerRow.appendChild(playBtn);
  playerRow.appendChild(timeEl);
  const track = el('div', 'ag-track');
  const rail = el('div', 'ag-rail');
  const trackFill = el('div', 'ag-track-fill');
  const thumb = el('div', 'ag-thumb');
  rail.appendChild(trackFill);
  track.appendChild(rail);
  track.appendChild(thumb);
  track.setAttribute('role', 'slider');
  track.setAttribute('aria-label', 'Audio position');
  track.tabIndex = 0;
  const playerHint = el('span', 'ag-player-hint', hintText());
  playerBox.appendChild(playerRow);
  playerBox.appendChild(track);
  playerBox.appendChild(playerHint);

  audio = new Audio(clip.src);
  audio.preload = 'auto';
  preloadNextClip();
  const windowLen = () => {
    const lim = audioLimit();
    return isFinite(lim) ? lim : (audio.duration || 0);
  };
  const drawTime = () => {
    const base = windowLen();
    timeEl.textContent = `${fmtT(audio.currentTime)} / ${base ? fmtT(base) : '–:––'}`;
    const pct = base ? Math.min(100, (audio.currentTime / base) * 100) : 0;
    trackFill.style.width = `${pct}%`;
    thumb.style.left = `${pct}%`;
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', String(Math.round(base)));
    track.setAttribute('aria-valuenow', String(Math.round(audio.currentTime)));
    track.setAttribute('aria-valuetext', `${fmtT(audio.currentTime)} of ${base ? fmtT(base) : 'unknown'}`);
  };
  // Scrubbing: drag or tap the bar to jump. Never past the unlocked window.
  const seekTo = (t) => {
    const base = windowLen();
    if (!base) return;
    audio.currentTime = Math.max(0, Math.min(t, base - 0.05));
    drawTime();
  };
  let dragging = false;
  const seekFromEvent = (e) => {
    const r = track.getBoundingClientRect();
    seekTo(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * windowLen());
  };
  track.addEventListener('pointerdown', (e) => {
    dragging = true;
    track.classList.add('is-drag');
    try { track.setPointerCapture(e.pointerId); } catch (_) {}
    seekFromEvent(e);
    e.preventDefault();
  });
  track.addEventListener('pointermove', (e) => { if (dragging) seekFromEvent(e); });
  const endDrag = () => { dragging = false; track.classList.remove('is-drag'); };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  track.addEventListener('keydown', (e) => {
    const step = e.key === 'ArrowLeft' ? -2 : e.key === 'ArrowRight' ? 2 : 0;
    if (e.key === 'Home') seekTo(0);
    else if (e.key === 'End') seekTo(windowLen());
    else if (step) seekTo(audio.currentTime + step);
    else return;
    e.preventDefault();
  });
  audio.addEventListener('loadedmetadata', drawTime);
  audio.addEventListener('durationchange', drawTime);
  drawTime();
  audio.addEventListener('timeupdate', () => {
    const lim = audioLimit();
    if (audio.currentTime >= lim) {
      // Cap reached: stop and rewind so the next play starts from 0 again.
      audio.pause();
      audio.currentTime = 0;
    }
    drawTime();
  });
  audio.addEventListener('play', () => {
    roundState.played = true;
    core.innerHTML = pauseSvg;
    playBtn.setAttribute('aria-label', 'Pause voice');
    if (input) { input.disabled = false; input.placeholder = 'Search accents or countries…'; }
    if (quickBtns) quickBtns.forEach((b) => { b.disabled = false; });
    skipBtn.disabled = false;
  });
  const stopped = () => {
    core.innerHTML = playSvg;
    playBtn.setAttribute('aria-label', 'Play voice');
  };
  audio.addEventListener('pause', stopped);
  audio.addEventListener('ended', stopped);
  playBtn.onclick = () => { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); };
  replayBtn.onclick = () => {
    audio.currentTime = 0;
    audio.play().catch(() => {});
    drawTime();
  };
  round.appendChild(playerBox);

  round.appendChild(el('p', 'ag-question', 'Which accent is this?'));

  const hints = el('div', 'ag-hints');
  const tries = el('div', 'ag-tries');
  const tools = el('div', 'ag-tools');
  const skipBtn = el('button', 'ag-skip', 'Skip');
  skipBtn.type = 'button';
  skipBtn.disabled = true;
  tools.appendChild(tries);
  tools.appendChild(skipBtn);

  const turnsUsed = () => roundState.wrong.length;
  // No text clues: region and letter hints gave the answer away. Help is only
  // ever more audio (hard mode's ladder); elsewhere the full clip is already
  // unlocked, so the only way forward is listening again.
  const updateSkipLabel = () => {
    if (!isHard) return;
    if (roundState.step < HARD_STEPS.length) {
      const nextLab = roundState.step + 1 < HARD_STEPS.length ? `${HARD_STEPS[roundState.step + 1]} s` : 'full clip';
      skipBtn.textContent = `Skip · unlock ${nextLab}`;
    } else {
      skipBtn.textContent = 'Give up';
    }
  };

  const drawTries = () => {
    tries.innerHTML = '';
    if (isHard) {
      HARD_STEPS.map(s2 => `${s2} s`).concat(['Full']).forEach((lab, i) => {
        tries.appendChild(el('span', 'ag-step' + (i < roundState.step ? ' is-done' : i === roundState.step ? ' is-now' : ''), lab));
      });
      updateSkipLabel();
      return;
    }
    const left = TURNS - turnsUsed();
    for (let i = 0; i < TURNS; i++) tries.appendChild(el('span', 'ag-try' + (i < left ? ' is-left' : '')));
    tries.appendChild(el('span', null, `${left} ${left === 1 ? 'guess' : 'guesses'} left`));
    skipBtn.textContent = 'Give up';
  };
  const advanceStep = () => {
    roundState.step += 1;
    playerHint.textContent = hintText();
    drawTime();
    drawTries();
  };

  const guessWrap = el('div', 'ag-guess');
  let closeOptions = () => {};
  if (!isQuick) {
  const inputWrap = el('div', 'ag-input-wrap');
  input = el('input', 'ag-input');
  input.type = 'text'; input.placeholder = 'Play the voice first'; input.disabled = true;
  input.autocomplete = 'off'; input.autocapitalize = 'off'; input.spellcheck = false;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-label', 'Search accents or countries');
  const caret = el('button', 'ag-caret');
  caret.type = 'button';
  caret.setAttribute('aria-label', 'Show all options');
  caret.tabIndex = -1;
  caret.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const optionsBox = el('div', 'ag-options');
  optionsBox.setAttribute('role', 'listbox');
  optionsBox.style.display = 'none';

  let visibleOpts = [];
  let activeIdx = -1;

  const setActive = (idx) => {
    activeIdx = idx;
    optionsBox.querySelectorAll('.ag-option').forEach(b => b.classList.remove('is-active'));
    if (idx >= 0 && visibleOpts[idx]) {
      const btn = optionsBox.querySelector(`[data-answer="${CSS.escape(visibleOpts[idx])}"]`);
      if (btn) {
        btn.classList.add('is-active');
        btn.scrollIntoView({ block: 'nearest' });
        input.setAttribute('aria-activedescendant', btn.id);
      }
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  };

  const openOptions = () => { optionsBox.style.display = ''; input.setAttribute('aria-expanded', 'true'); drawOptions(); };
  closeOptions = () => { optionsBox.style.display = 'none'; input.setAttribute('aria-expanded', 'false'); };

  const drawOptions = () => {
    const list = filterAnswers(input.value);
    visibleOpts = [];
    activeIdx = -1;
    input.removeAttribute('aria-activedescendant');
    optionsBox.innerHTML = '';
    if (list.length === 0) { optionsBox.appendChild(el('div', 'ag-option-empty', 'No accent matches that.')); return; }
    let optId = 0;
    for (const grp of GROUP_ORDER) {
      const inGroup = list.filter(a => GUESS_CONTINENT[a] === grp);
      if (!inGroup.length) continue;
      optionsBox.appendChild(el('div', 'ag-opt-group', grp));
      inGroup.forEach(a => {
        visibleOpts.push(a);
        const b = el('button', 'ag-option' + (roundState.wrong.includes(a) ? ' is-taken' : ''));
        b.type = 'button'; b.setAttribute('role', 'option');
        b.id = `ag-opt-${optId++}`;
        b.dataset.answer = a;
        b.disabled = roundState.wrong.includes(a);
        b.appendChild(el('span', 'ag-opt-place', PLACE[a] || a));
        b.appendChild(el('span', 'ag-opt-label', a === PLACE[a] ? 'Accent label' : `${a} accent`));
        b.onmousedown = (e) => { e.preventDefault(); choose(a); };
        optionsBox.appendChild(b);
      });
    }
  };
  input.addEventListener('input', openOptions);
  input.addEventListener('focus', openOptions);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (optionsBox.style.display === 'none') openOptions(); else if (visibleOpts.length) setActive(Math.min(activeIdx + 1, visibleOpts.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (visibleOpts.length) setActive(Math.max(activeIdx - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = activeIdx >= 0 ? visibleOpts[activeIdx] : visibleOpts[0];
      if (pick) choose(pick);
    }
    else if (e.key === 'Escape') closeOptions();
  });
  caret.addEventListener('mousedown', (e) => e.preventDefault());
  caret.addEventListener('click', () => {
    if (input.disabled) return;
    if (optionsBox.style.display === 'none') { input.focus(); openOptions(); } else closeOptions();
  });
  document.addEventListener('click', (e) => { if (!guessWrap.contains(e.target)) closeOptions(); });

  inputWrap.appendChild(input);
  inputWrap.appendChild(caret);
  guessWrap.appendChild(inputWrap);
  guessWrap.appendChild(optionsBox);
  }

  // Quick pick: four written options per voice - the answer plus three
  // distractors - instead of the search box. Taps are locked until the voice
  // has been played.
  if (isQuick) {
    const rndQ = mulberry32(hashStr(`quick:${clip.id}`));
    const distract = shuffleArr(ANSWERS.filter(a => a !== clip.answer), rndQ).slice(0, 3);
    const opts = shuffleArr([clip.answer].concat(distract), rndQ);
    const pickWrap = el('div', 'ag-pick-wrap');
    quickBtns = opts.map((a) => {
      const b = el('button', 'ag-pick');
      b.type = 'button';
      b.disabled = true;
      b.dataset.answer = a;
      b.appendChild(el('span', 'ag-opt-place', PLACE[a] || a));
      b.appendChild(el('span', 'ag-opt-label', a === PLACE[a] ? 'Accent label' : `${a} accent`));
      b.onclick = () => choose(a);
      pickWrap.appendChild(b);
      return b;
    });
    guessWrap.appendChild(pickWrap);
  }

  drawTries();

  const wrongBox = el('div', 'ag-wrong');


  // Distance chip with a subtle count-up animation. Color shows closeness:
  // green = close, orange = mid, grey = far. Rough signal between the places
  // the labels are named after, not the speakers' real locations.
  function makeChip(a) {
    const km = kmOff(a, clip.answer);
    const chip = el('span', 'ag-chip' + (reducedMotion ? '' : ' ag-chip-in'));
    if (km === null) {
      if (clip.continent && GUESS_CONTINENT[a] && GUESS_CONTINENT[a] !== clip.continent) chip.textContent = `${a} · wrong continent`;
      else if (clip.continent && GUESS_CONTINENT[a] === clip.continent) chip.textContent = `${a} · right continent`;
      else chip.textContent = a;
      return chip;
    }
    chip.appendChild(document.createTextNode(`${a} · `));
    const kmSpan = el('span', 'ag-chip-km');
    chip.appendChild(kmSpan);
    if (km < 1500) chip.classList.add('is-close');
    else if (km < 6000) chip.classList.add('is-mid');
    if (reducedMotion) { kmSpan.textContent = `${fmtKm(km)} off`; return chip; }
    const t0 = performance.now(), dur = 700;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      if (p >= 1) { kmSpan.textContent = `${fmtKm(km)} off`; return; }
      kmSpan.textContent = `about ${Math.round(km * eased).toLocaleString('en-US')} km off`;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    return chip;
  }

  function choose(a) {
    if (roundState.over || !roundState.played || roundState.wrong.includes(a)) return;
    if (input) { input.value = ''; closeOptions(); }
    if (a === clip.answer) { roundState.solved = true; roundState.over = true; }
    else {
      roundState.wrong.push(a);
      wrongBox.appendChild(makeChip(a));
      if (quickBtns) { const qb = quickBtns.find((b) => b.dataset.answer === a); if (qb) { qb.disabled = true; qb.classList.add('is-taken'); } }
      if (isHard) {
        // A wrong guess unlocks the next chunk of the same clip; a wrong guess
        // on the full clip ends the round.
        if (roundState.step >= HARD_STEPS.length) roundState.over = true;
        else advanceStep();
      } else {
        if (turnsUsed() >= TURNS) roundState.over = true;
      }
    }
    if (roundState.over) reveal(); else drawTries();
  }

  skipBtn.onclick = () => {
    if (roundState.over || !roundState.played) return;
    if (isHard && roundState.step < HARD_STEPS.length) {
      // Skip unlocks more of the same clip instead of ending the round.
      advanceStep();
      return;
    }
    roundState.skipped = true;
    roundState.over = true;
    reveal();
  };

  function reveal() {
    const points = roundState.solved ? (isHard ? HARD_STEPS.length + 1 - roundState.step : TURNS - turnsUsed()) : 0;
    tools.style.display = 'none'; guessWrap.style.display = 'none';
    const box = el('div', 'ag-reveal' + (roundState.solved ? ' is-right' : ' is-missed'));
    const head = el('div', 'ag-reveal-head');
    head.appendChild(el('span', 'ag-reveal-country', PLACE[clip.answer] || clip.answer));
    head.appendChild(el('span', 'ag-reveal-pts', roundState.solved ? `+${points}` : '0'));
    box.appendChild(head);
    box.appendChild(buildMap(clip.answer, roundState.wrong));
    box.appendChild(el('p', 'ag-reveal-cap', `The map highlights ${PLACE[clip.answer] || clip.answer} - the place this accent label is named after, not where the speaker is from.`));
    const meta = el('div', 'ag-reveal-meta');
    meta.appendChild(el('span', null, `Accent: ${clip.region}`));
    box.appendChild(meta);
    if (!roundState.solved) box.appendChild(el('p', 'ag-reveal-note', (roundState.skipped ? 'Gave up. ' : '') + `The answer was ${clip.answer}.`));
    const last = state.index + 1 >= total;
    const nextLabel = isRun ? (roundState.solved ? 'Next voice' : 'See run results') : (last ? 'See results' : 'Next voice');
    const next = el('button', 'ag-btn is-primary', nextLabel);
    next.onclick = () => {
      state.rounds.push({ answer: clip.answer, region: clip.region, points, skipped: !!roundState.skipped, wrong: roundState.wrong.slice() });
      if (roundState.solved) state.cleared += 1;
      if (isRun) {
        if (roundState.solved && state.index + 1 < total) { state.index += 1; render(); }
        else finishRun();
      } else if (!last) { state.index += 1; render(); }
      else finishRun();
    };
    box.appendChild(next);
    round.appendChild(box);
  }

  round.appendChild(tools);
  round.appendChild(guessWrap);
  round.appendChild(wrongBox);
  round.appendChild(hints);
  app.appendChild(round);
}

function finishRun() {
  if (state.mode === 'daily') {
    const today = todayStr();
    const score = state.rounds.reduce((s, r) => s + r.points, 0);
    const y = new Date(); y.setUTCDate(y.getUTCDate() - 1);
    const yesterday = `${y.getUTCFullYear()}-${pad2(y.getUTCMonth() + 1)}-${pad2(y.getUTCDate())}`;
    state.stats = {
      plays: state.stats.plays + 1,
      best: state.stats.best, // frozen: original 5-voice era (/15), shown as its own legacy stat
      best5: state.stats.best5 || 0, // frozen: 5-guess era (/25), shown as its own legacy stat
      best9: Math.max(state.stats.best9 || 0, score), // current: 3 voices x 3 guesses (/9)
      scale5: false,
      streak: state.stats.lastDaily === yesterday ? state.stats.streak + 1 : 1,
      lastDaily: today,
      lastRounds: state.rounds.slice(),
    };
    store.set('accent-guessr.stats.v1', state.stats);
  }
  if (state.mode === 'endless') {
    state.endless = { best: Math.max(state.endless.best, state.cleared), runs: state.endless.runs + 1 };
    store.set('accent-guessr.endless.v1', state.endless);
  }
  if (state.mode === 'hard') {
    state.hard = { best: Math.max(state.hard.best, state.cleared), runs: state.hard.runs + 1 };
    store.set('accent-guessr.hard.v1', state.hard);
  }
  if (state.mode === 'short') {
    const cur = state.short[state.shortMode] || { best: 0, runs: 0 };
    state.short[state.shortMode] = { best: Math.max(cur.best, state.cleared), runs: cur.runs + 1 };
    store.set('accent-guessr.shorts.v1', state.short);
  }
  if (state.mode === 'quick') {
    state.quick = { best: Math.max(state.quick.best, state.cleared), runs: state.quick.runs + 1 };
    store.set('accent-guessr.quick.v1', state.quick);
  }
  if (window.AGAuth) AGAuth.recordGameEnd();
  state.screen = 'results';
  render();
}

function renderResults() {
  app.appendChild(navBar(null));
  const res = el('div', 'ag-results');
  const isHard = state.mode === 'hard';
  const isShort = state.mode === 'short';
  const isQuick = state.mode === 'quick';
  const isRun = state.mode === 'endless' || isHard || isShort || isQuick;
  const runName = isHard ? 'Hard mode' : isShort ? `${SHORT[state.shortMode].label} mode` : isQuick ? 'Quick pick' : 'Endless';
  const score = state.rounds.reduce((s, r) => s + r.points, 0);
  const max = state.rounds.length * TURNS;

  if (isRun) {
    const sc = el('div', 'ag-score');
    sc.appendChild(el('span', 'ag-score-num', String(state.cleared)));
    sc.appendChild(el('span', 'ag-score-max', state.cleared === 1 ? ' voice' : ' voices'));
    res.appendChild(sc);
    const best = isHard ? state.hard.best : isShort ? (state.short[state.shortMode] || { best: 0 }).best : isQuick ? state.quick.best : state.endless.best;
    res.appendChild(el('p', 'ag-done-score', `${score} points · best ${best}`));
  } else {
    const sc = el('div', 'ag-score');
    sc.appendChild(el('span', 'ag-score-num', String(score)));
    sc.appendChild(el('span', 'ag-score-max', `/ ${max}`));
    res.appendChild(sc);
  }
  const sq = el('div', 'ag-squares');
  state.rounds.forEach(r => sq.appendChild(el('span', null, squares(r.points))));
  res.appendChild(sq);

  const recap = el('div', 'ag-recap');
  state.rounds.forEach(r => {
    const row = el('div', 'ag-recap-row');
    row.appendChild(el('span', 'ag-recap-name', PLACE[r.answer] || r.answer));
    row.appendChild(el('span', 'ag-recap-pts', r.points > 0 ? `+${r.points}` : (r.skipped ? 'gave up' : '0')));
    recap.appendChild(row);
  });
  res.appendChild(recap);

  const actions = el('div', 'ag-actions');
  const copy = el('button', 'ag-btn is-primary', 'Copy result');
  copy.onclick = () => {
    const text = isRun
      ? `Accent Guessr · ${runName}\n${state.cleared} voices in a row · ${score} points\n${state.rounds.map(r => squares(r.points)).join('')}`
      : `Accent Guessr · ${prettyDate()}\n${score}/${max}\n${state.rounds.map(r => squares(r.points)).join('')}`;
    const done = () => { copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy result'; }, 2000); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(done);
    else done();
  };
  actions.appendChild(copy);
  const again = el('button', 'ag-btn is-ghost', isRun ? 'Play again' : 'Practice more');
  again.onclick = isHard ? startHard : isShort ? () => startShort(state.shortMode) : isQuick ? startQuick : (state.mode === 'endless' ? startEndless : startPractice);
  actions.appendChild(again);
  res.appendChild(actions);

  if (window.AGAuth) { const prompt = AGAuth.signupPrompt(state.mode); if (prompt) res.appendChild(prompt); }
  // Sync status must be visible exactly when a save happens: the account
  // chip (with its saving/saved/not-saved note) lives on results too.
  if (window.AGAuth) { const ac = AGAuth.accountControl(); if (ac) res.appendChild(ac); }
  if (ADS.enabled && ADS.client) res.appendChild(el('div', 'ad-slot'));
  if (state.mode === 'daily') res.appendChild(countdownLine());
  const back = el('button', 'ag-linklike', 'Back to start');
  back.onclick = () => { state.screen = 'home'; render(); };
  res.appendChild(back);

  app.appendChild(res);
}

// Boot: load the clip manifest (metadata only) before the first render.
// Without it the game cannot run, so fail with a plain message instead of a
// half-broken page.
async function boot() {
  try {
    const res = await fetch('clips.json?v=1');
    if (!res.ok) throw new Error(`clips.json: HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) throw new Error('clips.json: empty');
    CLIPS = data;
  } catch (e) {
    app.innerHTML = '';
    const box = el('div', 'ag-home');
    box.appendChild(el('h1', 'ag-title', 'Accent Guessr'));
    box.appendChild(el('p', 'ag-done-score', 'The voice library could not be loaded. Check your connection and reload the page.'));
    app.appendChild(box);
    return;
  }
  ANSWERS = Array.from(new Set(CLIPS.map(c => c.answer))).sort((a, b) => a.localeCompare(b));
  if (window.AGAuth) AGAuth.onChange(() => { if (state.screen !== 'play') render(); });
  render();
}
boot();
