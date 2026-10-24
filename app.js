'use strict';
/* Accent Guessr - daily accent game. Vanilla JS, no dependencies. */

// Monetization wiring: no ad network is connected yet. When an ad account exists,
// set enabled + client/slot ids and the results-screen ad slot goes live.
// Until then nothing renders: no placeholders, no fake ads.
const ADS = { enabled: false, client: '', resultsSlot: '' };

const FLAGS = {
  'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Northern Ireland': '🇬🇧', 'Ireland': '🇮🇪',
  'Australia': '🇦🇺', 'New Zealand': '🇳🇿', 'South Africa': '🇿🇦', 'United States': '🇺🇸', 'Canada': '🇨🇦', 'Jamaica': '🇯🇲',
  'Germany': '🇩🇪', 'Austria': '🇦🇹', 'Liechtenstein': '🇱🇮', 'France': '🇫🇷', 'Spain': '🇪🇸', 'Mexico': '🇲🇽',
  'Argentina': '🇦🇷', 'Colombia': '🇨🇴', 'Cuba': '🇨🇺', 'Peru': '🇵🇪', 'Venezuela': '🇻🇪', 'Italy': '🇮🇹', 'Portugal': '🇵🇹',
  'Brazil': '🇧🇷', 'Netherlands': '🇳🇱', 'Belgium': '🇧🇪', 'Sweden': '🇸🇪', 'Norway': '🇳🇴', 'Denmark': '🇩🇰', 'Finland': '🇫🇮',
  'Poland': '🇵🇱', 'Czech Republic': '🇨🇿', 'Hungary': '🇭🇺', 'Romania': '🇷🇴', 'Russia': '🇷🇺', 'Ukraine': '🇺🇦',
  'Greece': '🇬🇷', 'Turkey': '🇹🇷', 'Egypt': '🇪🇬', 'Morocco': '🇲🇦', 'Saudi Arabia': '🇸🇦', 'Israel': '🇮🇱', 'Iran': '🇮🇷',
  'India': '🇮🇳', 'Pakistan': '🇵🇰', 'Bangladesh': '🇧🇩', 'China': '🇨🇳', 'Hong Kong': '🇭🇰', 'Japan': '🇯🇵',
  'South Korea': '🇰🇷', 'Vietnam': '🇻🇳', 'Thailand': '🇹🇭', 'Indonesia': '🇮🇩', 'Philippines': '🇵🇭', 'Nigeria': '🇳🇬',
  'Ethiopia': '🇪🇹', 'Switzerland': '🇨🇭',
};

const ANSWERS = Array.from(new Set(CLIPS.map(c => c.answer))).sort((a, b) => a.localeCompare(b));
const ALIASES = {
  'usa': ['United States'], 'america': ['United States'], 'united states of america': ['United States'], 'us': ['United States'],
  'uk': ['England', 'Scotland', 'Wales', 'Northern Ireland'], 'united kingdom': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
  'britain': ['England', 'Scotland', 'Wales', 'Northern Ireland'], 'great britain': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
  'british': ['England', 'Scotland', 'Wales', 'Northern Ireland'], 'holland': ['Netherlands'], 'korea': ['South Korea'],
  'czechia': ['Czech Republic'], 'turkiye': ['Turkey'], 'persia': ['Iran'], 'nz': ['New Zealand'],
};

function filterAnswers(q) {
  const query = q.trim().toLowerCase();
  if (!query) return ANSWERS;
  const hits = new Set();
  for (const a of ANSWERS) if (a.toLowerCase().includes(query)) hits.add(a);
  for (const [alias, targets] of Object.entries(ALIASES)) if (alias.includes(query) || query.includes(alias)) targets.forEach(t => hits.add(t));
  return ANSWERS.filter(a => hits.has(a));
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
function pickSet(seed, excludeIds) {
  const rnd = mulberry32(seed);
  const pool = CLIPS.filter(c => !excludeIds.has(c.id));
  const source = pool.length >= 5 ? pool : CLIPS.slice();
  const shuffled = source.slice();
  for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = t; }
  const picked = [], cont = {};
  for (const c of shuffled) {
    if (picked.length >= 5) break;
    if (picked.some(p => p.answer === c.answer)) continue;
    if ((cont[c.continent] || 0) >= 2) continue;
    picked.push(c); cont[c.continent] = (cont[c.continent] || 0) + 1;
  }
  return picked;
}
function pad2(n) { return String(n).padStart(2, '0'); }
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function prettyDate() { return new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }); }
function squares(p) { return p === 3 ? '🟩' : p === 2 ? '🟨' : p === 1 ? '🟧' : '⬛'; }

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} },
};
const EMPTY_STATS = { plays: 0, best: 0, streak: 0, lastDaily: null, lastRounds: [] };

const state = {
  screen: 'home', // home | play | results
  mode: 'daily',
  set: [],
  index: 0,
  rounds: [],
  stats: store.get('accent-guessr.stats.v1', EMPTY_STATS),
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
  h.appendChild(el('p', 'ag-intro', 'Five real voices a day. Listen, then guess where each speaker is from.'));
  return h;
}
function about() {
  const g = el('section', 'ag-about-block');
  g.appendChild(el('h2', 'ag-about-title', 'About the voices'));
  const p = el('p', 'ag-about');
  p.innerHTML = 'Every clip is a real person reading the same short paragraph, recorded for the <a href="https://accent.gmu.edu/" target="_blank" rel="noopener">Speech Accent Archive</a> at George Mason University. Clips are shortened excerpts shared under <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a>. The answer is the speaker\'s birthplace, and each reveal also names their first language. An accent is shaped by more than a birthplace, so treat it as the speaker\'s origin, not a verdict on how anyone sounds.';
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
    b.onclick = () => { state.mode = 'daily'; state.set = pickSet(hashStr(`accent-guessr:${today}`), new Set()); state.index = 0; state.rounds = []; state.screen = 'play'; render(); };
    home.appendChild(b);
  }
  const p = el('button', 'ag-btn is-ghost is-big', 'Practice');
  p.onclick = () => {
    const excl = new Set(state.seen);
    const set = pickSet(hashStr(`practice:${Date.now()}`), excl);
    state.seen = state.seen.concat(set.map(c => c.id));
    if (state.seen.length >= CLIPS.length - 4) state.seen = [];
    store.set('accent-guessr.practice-seen.v1', state.seen);
    state.mode = 'practice'; state.set = set; state.index = 0; state.rounds = []; state.screen = 'play'; render();
  };
  home.appendChild(p);
  const stats = el('div', 'ag-stats');
  [['day streak', state.stats.streak], ['days played', state.stats.plays], ['best score', state.stats.best]].forEach(([label, num]) => {
    const d = el('div');
    d.appendChild(el('span', 'ag-stat-num', String(num)));
    d.appendChild(el('span', 'ag-stat-label', label));
    stats.appendChild(d);
  });
  home.appendChild(stats);
  app.appendChild(home);
  app.appendChild(about());
}

let roundState = null; // { played, wrong[], over, solved }

function renderRound() {
  const clip = state.set[state.index];
  const total = state.set.length;
  roundState = { played: false, wrong: [], over: false, solved: false };

  app.appendChild(header());
  const round = el('div', 'ag-round');

  const prog = el('div', 'ag-progress');
  for (let i = 0; i < total; i++) prog.appendChild(el('span', 'ag-dot' + (i === state.index ? ' is-now' : i < state.index ? ' is-done' : '')));
  prog.appendChild(el('span', 'ag-round-no', `${state.mode === 'daily' ? 'Daily' : 'Practice'} · ${state.index + 1} of ${total}`));
  round.appendChild(prog);

  // Player
  const player = el('button', 'ag-player');
  player.type = 'button';
  player.setAttribute('aria-label', 'Play voice');
  const ring = el('span', 'ag-player-ring');
  const core = el('span', 'ag-player-core');
  core.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4.8v14.4c0 .9 1 1.5 1.8 1L19 13a1.2 1.2 0 0 0 0-2L7.8 3.9c-.8-.5-1.8 0-1.8.9Z"/></svg>';
  ring.appendChild(core);
  player.appendChild(ring);
  const playerLabel = el('span', 'ag-player-label', 'Play the voice');
  player.appendChild(playerLabel);
  player.appendChild(el('span', 'ag-player-hint', 'Replay as much as you like'));

  audio = new Audio(clip.src);
  audio.preload = 'auto';
  audio.addEventListener('timeupdate', () => {
    const pct = audio.duration ? Math.round((audio.currentTime / audio.duration) * 360) : 0;
    ring.style.background = `conic-gradient(var(--ag-acc) ${pct}deg, var(--ds-hairline) 0deg)`;
  });
  audio.addEventListener('play', () => {
    roundState.played = true;
    player.classList.add('is-playing');
    playerLabel.textContent = 'Listening…';
    player.setAttribute('aria-label', 'Pause voice');
    core.innerHTML = '<span class="ag-eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';
    input.disabled = false;
    input.placeholder = 'Type a country…';
  });
  const stopped = () => {
    player.classList.remove('is-playing');
    playerLabel.textContent = 'Play the voice';
    player.setAttribute('aria-label', 'Play voice');
    core.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4.8v14.4c0 .9 1 1.5 1.8 1L19 13a1.2 1.2 0 0 0 0-2L7.8 3.9c-.8-.5-1.8 0-1.8.9Z"/></svg>';
  };
  audio.addEventListener('pause', stopped);
  audio.addEventListener('ended', () => { stopped(); ring.style.background = ''; });
  player.onclick = () => { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); };
  round.appendChild(player);

  round.appendChild(el('p', 'ag-question', 'Where is this speaker from?'));

  const tries = el('div', 'ag-tries');
  const guessWrap = el('div', 'ag-guess');
  const input = el('input', 'ag-input');
  input.type = 'text'; input.placeholder = 'Play the voice first'; input.disabled = true;
  input.autocomplete = 'off'; input.autocapitalize = 'off'; input.spellcheck = false;
  const optionsBox = el('div', 'ag-options');
  optionsBox.setAttribute('role', 'listbox');
  optionsBox.style.display = 'none';

  const drawTries = () => {
    tries.innerHTML = '';
    const left = 3 - roundState.wrong.length;
    for (let i = 0; i < 3; i++) tries.appendChild(el('span', 'ag-try' + (i < left ? ' is-left' : '')));
    tries.appendChild(el('span', null, `${left} ${left === 1 ? 'guess' : 'guesses'} left`));
  };
  drawTries();

  const drawOptions = () => {
    const opts = filterAnswers(input.value);
    optionsBox.innerHTML = '';
    if (opts.length === 0) optionsBox.appendChild(el('div', 'ag-option-empty', 'No country matches that.'));
    opts.forEach(a => {
      const b = el('button', 'ag-option' + (roundState.wrong.includes(a) ? ' is-taken' : ''));
      b.type = 'button'; b.setAttribute('role', 'option');
      b.disabled = roundState.wrong.includes(a);
      if (FLAGS[a]) { const f = el('span', 'ag-flag', FLAGS[a]); b.appendChild(f); }
      b.appendChild(document.createTextNode(a));
      b.onmousedown = (e) => { e.preventDefault(); choose(a); };
      optionsBox.appendChild(b);
    });
  };
  input.addEventListener('input', () => { optionsBox.style.display = ''; drawOptions(); });
  input.addEventListener('focus', () => { optionsBox.style.display = ''; drawOptions(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); const opts = filterAnswers(input.value); if (opts.length) choose(opts[0]); }
  });
  document.addEventListener('click', (e) => { if (!guessWrap.contains(e.target)) optionsBox.style.display = 'none'; });

  guessWrap.appendChild(input);
  guessWrap.appendChild(optionsBox);

  const wrongBox = el('div', 'ag-wrong');
  const hints = el('div', 'ag-hints');

  function choose(a) {
    if (roundState.over || !roundState.played || roundState.wrong.includes(a)) return;
    input.value = ''; optionsBox.style.display = 'none';
    if (a === clip.answer) { roundState.solved = true; roundState.over = true; }
    else {
      roundState.wrong.push(a);
      const chip = el('span', 'ag-chip', a); wrongBox.appendChild(chip);
      if (roundState.wrong.length >= 1 && !hints.querySelector('.h1')) { const h = el('span', 'ag-hint h1', `Continent: ${clip.continent}`); hints.appendChild(h); }
      if (roundState.wrong.length >= 2) { const h = el('span', 'ag-hint h2', `First language: ${clip.language}`); hints.appendChild(h); }
      if (roundState.wrong.length >= 3) roundState.over = true;
    }
    if (roundState.over) reveal(); else drawTries();
  }

  function reveal() {
    const points = roundState.solved ? 3 - roundState.wrong.length : 0;
    tries.style.display = 'none'; guessWrap.style.display = 'none';
    const box = el('div', 'ag-reveal' + (roundState.solved ? ' is-right' : ' is-missed'));
    const head = el('div', 'ag-reveal-head');
    head.appendChild(el('span', 'ag-reveal-flag', FLAGS[clip.answer] || ''));
    head.appendChild(el('span', 'ag-reveal-country', clip.answer));
    head.appendChild(el('span', 'ag-reveal-pts', roundState.solved ? `+${points}` : '0'));
    box.appendChild(head);
    const meta = el('div', 'ag-reveal-meta');
    meta.appendChild(el('span', null, clip.city));
    meta.appendChild(el('span', null, clip.language === 'English' ? 'Native English speaker' : `First language: ${clip.language}`));
    meta.appendChild(el('span', null, `Speaker: ${clip.agesex}`));
    box.appendChild(meta);
    if (!roundState.solved) box.appendChild(el('p', 'ag-reveal-note', `The answer was ${clip.answer}.`));
    const next = el('button', 'ag-btn is-primary', state.index + 1 < total ? 'Next voice' : 'See results');
    next.onclick = () => {
      state.rounds.push({ answer: clip.answer, city: clip.city, flag: FLAGS[clip.answer] || '', points, wrong: roundState.wrong.slice() });
      if (state.index + 1 < total) { state.index += 1; render(); }
      else { finishRun(); }
    };
    box.appendChild(next);
    round.appendChild(box);
  }

  round.appendChild(tries);
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
  state.screen = 'results';
  render();
}

function renderResults() {
  app.appendChild(header());
  const res = el('div', 'ag-results');
  const score = state.rounds.reduce((s, r) => s + r.points, 0);
  const max = state.rounds.length * 3;

  const sc = el('div', 'ag-score');
  sc.appendChild(el('span', 'ag-score-num', String(score)));
  sc.appendChild(el('span', 'ag-score-max', `/ ${max}`));
  res.appendChild(sc);
  const sq = el('div', 'ag-squares');
  state.rounds.forEach(r => sq.appendChild(el('span', null, squares(r.points))));
  res.appendChild(sq);

  const recap = el('div', 'ag-recap');
  state.rounds.forEach(r => {
    const row = el('div', 'ag-recap-row');
    row.appendChild(el('span', 'ag-recap-flag', r.flag));
    row.appendChild(el('span', 'ag-recap-name', r.answer));
    row.appendChild(el('span', 'ag-recap-pts', r.points > 0 ? `+${r.points}` : '0'));
    recap.appendChild(row);
  });
  res.appendChild(recap);

  const actions = el('div', 'ag-actions');
  const copy = el('button', 'ag-btn is-primary', 'Copy result');
  copy.onclick = () => {
    const text = `Accent Guessr · ${prettyDate()}\n${score}/${max}\n${state.rounds.map(r => squares(r.points)).join('')}`;
    const done = () => { copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy result'; }, 2000); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(done);
    else done();
  };
  actions.appendChild(copy);
  const prac = el('button', 'ag-btn is-ghost', 'Practice more');
  prac.onclick = () => {
    const excl = new Set(state.seen);
    const set = pickSet(hashStr(`practice:${Date.now()}`), excl);
    state.seen = state.seen.concat(set.map(c => c.id));
    if (state.seen.length >= CLIPS.length - 4) state.seen = [];
    store.set('accent-guessr.practice-seen.v1', state.seen);
    state.mode = 'practice'; state.set = set; state.index = 0; state.rounds = []; state.screen = 'play'; render();
  };
  actions.appendChild(prac);
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
