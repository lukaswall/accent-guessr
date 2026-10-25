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
  'Southern British English': ['GBR'], 'Scottish English': ['GBR'], 'Irish English': ['IRL'],
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
};

// Hard mode: the same clip, revealed progressively. You start with 2 seconds;
// each wrong guess or skip unlocks the next step (3 s, 5 s, then the full
// clip). Solving earlier scores more.
const HARD_STEPS = [2, 3, 5]; // seconds; anything past the last entry = full clip

function kmOff(guess, answer) {
  const g = COORDS[guess], a = COORDS[answer];
  if (!g || !a) return null;
  const rad = Math.PI / 180, dLat = (a[0] - g[0]) * rad, dLon = (a[1] - g[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(g[0] * rad) * Math.cos(a[0] * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)));
}
function fmtKm(km) {
  if (km < 100) return 'under 100 km';
  const rounded = km < 1000 ? Math.round(km / 50) * 50 : Math.round(km / 100) * 100;
  return `about ${rounded.toLocaleString('en-US')} km`;
}

const ANSWERS = Array.from(new Set(CLIPS.map(c => c.answer))).sort((a, b) => a.localeCompare(b));

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
function pickSet(seed, excludeIds) {
  const rnd = mulberry32(seed);
  const pool = CLIPS.filter(c => !excludeIds.has(c.id));
  const source = pool.length >= 5 ? pool : CLIPS.slice();
  const shuffled = shuffleArr(source, rnd);
  const picked = [], cont = {};
  for (const c of shuffled) {
    if (picked.length >= 5) break;
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
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function prettyDate() { return new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }); }
// Daily scores 3/2/1/0; hard mode scores 4/3/2/1/0 (solved from less audio = more).
function squares(p, hard) {
  if (hard) return p >= 4 ? '🟩' : p === 3 ? '🟨' : p === 2 ? '🟧' : p === 1 ? '🟥' : '⬛';
  return p === 3 ? '🟩' : p === 2 ? '🟨' : p === 1 ? '🟧' : '⬛';
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

const state = {
  screen: 'home', // home | play | results
  mode: 'daily',  // daily | practice | endless | hard
  set: [],
  index: 0,
  rounds: [],
  cleared: 0,
  stats: store.get('accent-guessr.stats.v1', EMPTY_STATS),
  endless: store.get('accent-guessr.endless.v1', EMPTY_ENDLESS),
  hard: store.get('accent-guessr.hard.v1', EMPTY_HARD),
  seen: store.get('accent-guessr.practice-seen.v1', []),
};

let audio = null;
function stopAudio() { if (audio) { audio.pause(); audio = null; } }

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
  svg.setAttribute('aria-label', `World map highlighting ${PLACE[answer] || answer}`);
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
  else renderResults();
}

function header() {
  const h = el('header', 'ag-header');
  h.appendChild(el('h1', 'ag-title', 'Accent Guessr'));
  h.appendChild(el('p', 'ag-date', prettyDate()));
  h.appendChild(el('p', 'ag-intro', 'Real voices. Listen, then guess which accent each speaker has.'));
  return h;
}
function about() {
  const g = el('section', 'ag-about-block');
  g.appendChild(el('h2', 'ag-about-title', 'About the voices'));
  const p = el('p', 'ag-about');
  p.innerHTML = 'Every clip is a real person in a recorded conversation, from the <a href="https://huggingface.co/datasets/edinburghcstr/edacc" target="_blank" rel="noopener">EdAcc corpus</a> (University of Edinburgh), shared under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>. These clips are shortened excerpts; this edited set is shared under the same license, with <a href="https://github.com/lukaswall/accent-guessr/blob/main/ATTRIBUTION.md" target="_blank" rel="noopener">per-clip credits and the edited set</a> in the source repository. The answer is the corpus\'s own accent label for that recording, and each reveal also names the speaker\'s first language. An accent label is a description of speech, not a fact about where someone was born or raised, so treat it as that, not a verdict on anyone. The map after each reveal highlights the place a label is named after (country boundaries: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>, public domain) - not where the speaker is from.';
  g.appendChild(p);
  const c = el('p', 'ag-closing', 'Your streaks and scores stay on this device.');
  g.appendChild(c);
  return g;
}

function countdownLine() {
  const p = el('p', 'ag-countdown');
  const tick = () => {
    const now = new Date(); const mid = new Date(now); mid.setHours(24, 0, 0, 0);
    const s = Math.max(0, Math.floor((mid - now) / 1000));
    p.textContent = `New voices in ${Math.floor(s / 3600)}h ${pad2(Math.floor((s % 3600) / 60))}m ${pad2(s % 60)}s`;
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

function renderHome() {
  app.appendChild(header());
  const home = el('div', 'ag-home');
  const today = todayStr();
  if (state.stats.lastDaily === today) {
    const done = el('div', 'ag-done');
    const sq = el('div', 'ag-squares');
    state.stats.lastRounds.forEach(r => sq.appendChild(el('span', null, squares(r.points))));
    done.appendChild(sq);
    done.appendChild(el('p', 'ag-done-score', `Today: ${state.stats.lastRounds.reduce((s, r) => s + r.points, 0)} / 15`));
    done.appendChild(countdownLine());
    home.appendChild(done);
  } else {
    const b = el('button', 'ag-btn is-primary is-big', "Play today's set");
    b.onclick = () => { state.mode = 'daily'; state.set = pickSet(hashStr(`accent-guessr:${today}`), new Set()); state.index = 0; state.rounds = []; state.cleared = 0; state.screen = 'play'; render(); };
    home.appendChild(b);
  }
  const hd = el('button', 'ag-btn is-primary is-big', 'Hard mode · 2-second start');
  hd.onclick = startHard;
  home.appendChild(hd);
  const e = el('button', 'ag-btn is-primary is-big', 'Endless');
  e.onclick = startEndless;
  home.appendChild(e);
  const p = el('button', 'ag-btn is-ghost is-big', 'Practice');
  p.onclick = startPractice;
  home.appendChild(p);
  const stats = el('div', 'ag-stats');
  [['day streak', state.stats.streak], ['days played', state.stats.plays], ['best daily', state.stats.best], ['best endless', state.endless.best], ['best hard', state.hard.best]].forEach(([label, num]) => {
    const d = el('div');
    d.appendChild(el('span', 'ag-stat-num', String(num)));
    d.appendChild(el('span', 'ag-stat-label', label));
    stats.appendChild(d);
  });
  home.appendChild(stats);
  app.appendChild(home);
  app.appendChild(about());
}

let roundState = null; // { played, wrong[], over, solved, skipped, step }

function renderRound() {
  const clip = state.set[state.index];
  const total = state.set.length;
  const isHard = state.mode === 'hard';
  const isRun = state.mode === 'endless' || isHard;
  roundState = { played: false, wrong: [], over: false, solved: false, skipped: false, step: 0 };

  app.appendChild(header());
  const round = el('div', 'ag-round');

  const prog = el('div', 'ag-progress');
  if (isRun) {
    prog.appendChild(el('span', 'ag-round-no', `${isHard ? 'Hard' : 'Endless'} · voice ${state.index + 1} · streak ${state.cleared}`));
  } else {
    for (let i = 0; i < total; i++) prog.appendChild(el('span', 'ag-dot' + (i === state.index ? ' is-now' : i < state.index ? ' is-done' : '')));
    prog.appendChild(el('span', 'ag-round-no', `${state.mode === 'daily' ? 'Daily' : 'Practice'} · ${state.index + 1} of ${total}`));
  }
  round.appendChild(prog);

  // In hard mode the audio is capped at the current step; the cap lifts as the
  // player guesses or skips. Replay always restarts from 0 and stops at the cap.
  const audioLimit = () => (isHard && roundState.step < HARD_STEPS.length) ? HARD_STEPS[roundState.step] : Infinity;
  const hintText = () => {
    if (!isHard) return 'Replay as much as you like';
    const lim = audioLimit();
    return isFinite(lim) ? `First ${lim} seconds only` : 'Full clip unlocked';
  };

  // Player
  const player = el('button', 'ag-player');
  player.type = 'button';
  player.setAttribute('aria-label', 'Play voice');
  const ring = el('span', 'ag-player-ring');
  const core = el('span', 'ag-player-core');
  const playSvg = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4.8v14.4c0 .9 1 1.5 1.8 1L19 13a1.2 1.2 0 0 0 0-2L7.8 3.9c-.8-.5-1.8 0-1.8.9Z"/></svg>';
  core.innerHTML = playSvg;
  ring.appendChild(core);
  player.appendChild(ring);
  const playerLabel = el('span', 'ag-player-label', 'Play the voice');
  player.appendChild(playerLabel);
  const playerHint = el('span', 'ag-player-hint', hintText());
  player.appendChild(playerHint);

  audio = new Audio(clip.src);
  audio.preload = 'auto';
  audio.addEventListener('timeupdate', () => {
    const lim = audioLimit();
    if (audio.currentTime >= lim) {
      audio.pause();
      audio.currentTime = 0;
      ring.style.background = '';
      return;
    }
    const base = isFinite(lim) ? lim : audio.duration;
    const pct = base ? Math.round((audio.currentTime / base) * 360) : 0;
    ring.style.background = `conic-gradient(var(--ag-acc) ${pct}deg, var(--ds-hairline) 0deg)`;
  });
  audio.addEventListener('play', () => {
    roundState.played = true;
    player.classList.add('is-playing');
    playerLabel.textContent = 'Listening…';
    player.setAttribute('aria-label', 'Pause voice');
    core.innerHTML = '<span class="ag-eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';
    input.disabled = false;
    input.placeholder = 'Search accents or countries…';
    skipBtn.disabled = false;
  });
  const stopped = () => {
    player.classList.remove('is-playing');
    playerLabel.textContent = 'Play the voice';
    player.setAttribute('aria-label', 'Play voice');
    core.innerHTML = playSvg;
  };
  audio.addEventListener('pause', stopped);
  audio.addEventListener('ended', () => { stopped(); ring.style.background = ''; });
  player.onclick = () => { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); };
  round.appendChild(player);

  round.appendChild(el('p', 'ag-question', 'Which accent is this?'));

  const tries = el('div', 'ag-tries');
  const tools = el('div', 'ag-tools');
  const skipBtn = el('button', 'ag-skip', 'Skip');
  skipBtn.type = 'button';
  skipBtn.disabled = true;
  tools.appendChild(tries);
  tools.appendChild(skipBtn);

  const guessWrap = el('div', 'ag-guess');
  const inputWrap = el('div', 'ag-input-wrap');
  const input = el('input', 'ag-input');
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
      ['2 s', '3 s', '5 s', 'Full'].forEach((lab, i) => {
        tries.appendChild(el('span', 'ag-step' + (i < roundState.step ? ' is-done' : i === roundState.step ? ' is-now' : ''), lab));
      });
      updateSkipLabel();
      return;
    }
    const left = 3 - roundState.wrong.length;
    for (let i = 0; i < 3; i++) tries.appendChild(el('span', 'ag-try' + (i < left ? ' is-left' : '')));
    tries.appendChild(el('span', null, `${left} ${left === 1 ? 'guess' : 'guesses'} left`));
  };
  drawTries();

  const advanceStep = () => {
    roundState.step += 1;
    playerHint.textContent = hintText();
    drawTries();
  };

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
  const closeOptions = () => { optionsBox.style.display = 'none'; input.setAttribute('aria-expanded', 'false'); };

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

  const wrongBox = el('div', 'ag-wrong');
  const hints = el('div', 'ag-hints');

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
    input.value = ''; closeOptions();
    if (a === clip.answer) { roundState.solved = true; roundState.over = true; }
    else {
      roundState.wrong.push(a);
      wrongBox.appendChild(makeChip(a));
      if (isHard) {
        // A wrong guess unlocks the next chunk of the same clip; a wrong guess
        // on the full clip ends the round.
        if (roundState.step >= HARD_STEPS.length) roundState.over = true;
        else advanceStep();
      } else {
        if (roundState.wrong.length >= 1 && !hints.querySelector('.h1')) { const h = el('span', 'ag-hint h1', `Continent: ${clip.continent}`); hints.appendChild(h); }
        if (roundState.wrong.length >= 2) { const h = el('span', 'ag-hint h2', clip.language === 'English' ? 'Native English speaker' : `First language: ${clip.language}`); hints.appendChild(h); }
        if (roundState.wrong.length >= 3) roundState.over = true;
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
    const points = roundState.solved ? (isHard ? 4 - roundState.step : 3 - roundState.wrong.length) : 0;
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
    meta.appendChild(el('span', null, clip.language === 'English' ? 'Native English speaker' : `First language: ${clip.language}`));
    if (clip.gender) meta.appendChild(el('span', null, `Speaker: ${clip.gender}`));
    box.appendChild(meta);
    if (!roundState.solved) box.appendChild(el('p', 'ag-reveal-note', (roundState.skipped ? 'Skipped. ' : '') + `The answer was ${clip.answer}.`));
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
  app.appendChild(about());
}

function finishRun() {
  if (state.mode === 'daily') {
    const today = todayStr();
    const score = state.rounds.reduce((s, r) => s + r.points, 0);
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yesterday = `${y.getFullYear()}-${pad2(y.getMonth() + 1)}-${pad2(y.getDate())}`;
    state.stats = {
      plays: state.stats.plays + 1,
      best: Math.max(state.stats.best, score),
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
  state.screen = 'results';
  render();
}

function renderResults() {
  app.appendChild(header());
  const res = el('div', 'ag-results');
  const isHard = state.mode === 'hard';
  const isRun = state.mode === 'endless' || isHard;
  const score = state.rounds.reduce((s, r) => s + r.points, 0);
  const max = state.rounds.length * 3;

  if (isRun) {
    const sc = el('div', 'ag-score');
    sc.appendChild(el('span', 'ag-score-num', String(state.cleared)));
    sc.appendChild(el('span', 'ag-score-max', state.cleared === 1 ? ' voice' : ' voices'));
    res.appendChild(sc);
    const best = isHard ? state.hard.best : state.endless.best;
    res.appendChild(el('p', 'ag-done-score', `${score} points · best ${best}`));
  } else {
    const sc = el('div', 'ag-score');
    sc.appendChild(el('span', 'ag-score-num', String(score)));
    sc.appendChild(el('span', 'ag-score-max', `/ ${max}`));
    res.appendChild(sc);
  }
  const sq = el('div', 'ag-squares');
  state.rounds.forEach(r => sq.appendChild(el('span', null, squares(r.points, isHard))));
  res.appendChild(sq);

  const recap = el('div', 'ag-recap');
  state.rounds.forEach(r => {
    const row = el('div', 'ag-recap-row');
    row.appendChild(el('span', 'ag-recap-name', PLACE[r.answer] || r.answer));
    row.appendChild(el('span', 'ag-recap-pts', r.points > 0 ? `+${r.points}` : (r.skipped ? 'skipped' : '0')));
    recap.appendChild(row);
  });
  res.appendChild(recap);

  const actions = el('div', 'ag-actions');
  const copy = el('button', 'ag-btn is-primary', 'Copy result');
  copy.onclick = () => {
    const text = isRun
      ? `Accent Guessr · ${isHard ? 'Hard mode' : 'Endless'}\n${state.cleared} voices in a row · ${score} points\n${state.rounds.map(r => squares(r.points, isHard)).join('')}`
      : `Accent Guessr · ${prettyDate()}\n${score}/${max}\n${state.rounds.map(r => squares(r.points)).join('')}`;
    const done = () => { copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy result'; }, 2000); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(done);
    else done();
  };
  actions.appendChild(copy);
  const again = el('button', 'ag-btn is-ghost', isRun ? 'Play again' : 'Practice more');
  again.onclick = isHard ? startHard : (state.mode === 'endless' ? startEndless : startPractice);
  actions.appendChild(again);
  res.appendChild(actions);

  if (ADS.enabled && ADS.client) res.appendChild(el('div', 'ad-slot'));
  if (state.mode === 'daily') res.appendChild(countdownLine());
  const back = el('button', 'ag-linklike', 'Back to start');
  back.onclick = () => { state.screen = 'home'; render(); };
  res.appendChild(back);

  app.appendChild(res);
  app.appendChild(about());
}

render();
