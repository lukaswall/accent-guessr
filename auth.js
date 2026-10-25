'use strict';
/* Accent Guessr accounts: free sign-in (Clerk), one-time guest progress
 * merge, then save-once-per-game sync to Supabase. Everything in this file
 * is inert unless AG_AUTH.enabled is true and configured (see auth-config.js).
 * When disabled, nothing here runs and no network requests are made. */
window.AGAuth = (() => {
  const cfg = typeof AG_AUTH !== 'undefined' ? AG_AUTH : { enabled: false, gatedModes: [] };
  const on = !!(cfg.enabled && cfg.clerkPublishableKey && cfg.supabaseUrl && cfg.supabasePublishableKey && typeof window !== 'undefined');
  let db = null;          // supabase-js client, created lazily
  let merged = false;     // guest progress already merged this session
  let readyPromise = null;
  const listeners = [];

  const LS = {
    stats: 'accent-guessr.stats.v1',
    endless: 'accent-guessr.endless.v1',
    hard: 'accent-guessr.hard.v1',
    short: 'accent-guessr.shorts.v1',
    quick: 'accent-guessr.quick.v1',
    seen: 'accent-guessr.practice-seen.v1',
    // Which account the local progress belongs to. Absent means genuine
    // guest progress (never signed in, or signed out since). Used to stop a
    // shared device from importing account A's synced progress into
    // unrelated account B as if it were B's guest progress.
    account: 'accent-guessr.account.v1',
    promptDismissed: 'accent-guessr.auth-prompt-dismissed.v1',
  };

  function getLS(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function setLS(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  function removeLS(key) { try { localStorage.removeItem(key); } catch (e) {} }
  // Drop all locally stored progress. Called when the owning account signs
  // out (or when another account signs in over stale leftovers), so one
  // account's progress never leaks into the next account or guest session
  // on a shared device. Server-side progress is unaffected.
  function clearLocalProgress() {
    for (const k of ['stats', 'endless', 'hard', 'short', 'quick', 'seen', 'account']) removeLS(LS[k]);
  }

  // Load clerk-js and supabase-js from CDNs only when accounts are actually on.
  function loadScript(src, label, attrs) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      if (attrs) for (const k in attrs) s.setAttribute(k, attrs[k]);
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(label + ' failed to load'));
      document.head.appendChild(s);
    });
  }
  async function loadLibs() {
    const jobs = [];
    if (!(window.supabase && window.supabase.createClient))
      jobs.push(loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js', 'supabase-js'));
    if (!window.Clerk)
      // clerk-js v5 only creates window.Clerk when the publishable key rides
      // on the script tag; without the attribute the bundle stays inert.
      jobs.push(loadScript('https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js', 'clerk-js', { 'data-clerk-publishable-key': cfg.clerkPublishableKey }));
    await Promise.all(jobs);
  }

  async function init() {
    if (!on) return;
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      await loadLibs();
      if (!window.Clerk.loaded) {
        try { await window.Clerk.load({ publishableKey: cfg.clerkPublishableKey }); }
        catch (e) { /* tag-attr bootstrap may already be loading with the same key */ }
      }
      // Supabase client that authenticates every request with the Clerk
      // session token (Clerk is registered as a third-party auth provider in
      // the Supabase project; see supabase/SETUP.md).
      db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
        accessToken: async () => {
          try { return (await window.Clerk.session?.getToken()) ?? null; } catch (e) { return null; }
        },
      });
      let wasSignedIn = !!window.Clerk.user;
      window.Clerk.addListener(({ user }) => {
        const isSignedIn = !!user;
        if (isSignedIn && !wasSignedIn) syncAfterLogin();
        if (!isSignedIn && wasSignedIn) {
          // Sign-out (or expired session): remove this account's progress
          // from the device and reload so the UI, module state and the
          // one-merge-per-session flag all start clean for whoever is next.
          clearLocalProgress();
          location.reload();
          return;
        }
        wasSignedIn = isSignedIn;
        listeners.forEach((fn) => { try { fn(); } catch (e) {} });
      });
      if (window.Clerk.user) syncAfterLogin();
    })().catch((e) => { console.warn('AGAuth init failed:', e); });
    return readyPromise;
  }

  function user() { return on && window.Clerk && window.Clerk.user ? window.Clerk.user : null; }
  function userEmail() {
    const u = user();
    return (u && u.primaryEmailAddress && u.primaryEmailAddress.emailAddress) || '';
  }
  function isGated(mode) { return on && cfg.gatedModes.includes(mode); }
  function needsLogin(mode) { return isGated(mode) && !user(); }

  function signIn() {
    if (!on || !window.Clerk) return;
    window.Clerk.openSignIn();
  }
  function signOut() {
    if (!on || !window.Clerk) return;
    window.Clerk.signOut();
  }

  // --- Progress sync -------------------------------------------------------
  // One JSONB row per user. Writes happen only when a game ends (and once at
  // first login). Nothing phones home while playing.
  function localProgress() {
    return {
      stats: getLS(LS.stats, null),
      endless: getLS(LS.endless, null),
      hard: getLS(LS.hard, null),
      short: getLS(LS.short, null),
      quick: getLS(LS.quick, null),
      seen: getLS(LS.seen, null),
    };
  }
  // Casual-game merge: bests take the max, play counts take the max (the same
  // games can exist on both sides, so summing would double-count), the daily
  // record with the more recent date wins, seen lists are unioned.
  function mergeProgress(local, remote) {
    const out = {};
    for (const k of ['endless', 'hard', 'quick']) {
      const l = local[k] || { best: 0, runs: 0 }, r = (remote && remote[k]) || { best: 0, runs: 0 };
      out[k] = { best: Math.max(l.best || 0, r.best || 0), runs: Math.max(l.runs || 0, r.runs || 0) };
    }
    {
      const l = local.short || {}, r = (remote && remote.short) || {};
      out.short = {};
      for (const key of new Set([...Object.keys(l), ...Object.keys(r), 's2', 's3', 's5'])) {
        const a = l[key] || { best: 0, runs: 0 }, b = r[key] || { best: 0, runs: 0 };
        out.short[key] = { best: Math.max(a.best || 0, b.best || 0), runs: Math.max(a.runs || 0, b.runs || 0) };
      }
    }
    {
      const l = local.stats || {}, r = (remote && remote.stats) || {};
      const newer = String(r.lastDaily || '') > String(l.lastDaily || '') ? r : l;
      out.stats = {
        ...newer,
        plays: Math.max(l.plays || 0, r.plays || 0),
        best: Math.max(l.best || 0, r.best || 0),
        best5: Math.max(l.best5 || 0, r.best5 || 0),
      };
    }
    {
      const l = local.seen || [], r = (remote && remote.seen) || [];
      out.seen = Array.from(new Set([...l, ...r])).slice(-120);
    }
    return out;
  }
  function applyMerged(m) {
    setLS(LS.stats, m.stats); setLS(LS.endless, m.endless); setLS(LS.hard, m.hard);
    setLS(LS.short, m.short); setLS(LS.quick, m.quick); setLS(LS.seen, m.seen);
    if (typeof state === 'object' && state) {
      state.stats = m.stats; state.endless = m.endless; state.hard = m.hard;
      state.short = m.short; state.quick = m.quick; state.seen = m.seen;
    }
    listeners.forEach((fn) => { try { fn(); } catch (e) {} });
  }
  async function pushProgress() {
    if (!on || !db || !user()) return;
    setLS(LS.account, user().id);
    try {
      await db.from('progress').upsert({ user_id: user().id, data: localProgress(), updated_at: new Date().toISOString() });
    } catch (e) { console.warn('AGAuth sync failed (kept locally):', e); }
  }
  async function syncAfterLogin() {
    if (merged || !user()) return;
    merged = true;
    try {
      // Shared-device guard: local progress marked as belonging to a
      // DIFFERENT account is not guest data - never import it into this
      // account. Genuine guest progress (no marker) still merges as before.
      const owner = getLS(LS.account, null);
      if (owner && owner !== user().id) clearLocalProgress();
      setLS(LS.account, user().id);
      const { data } = await db.from('progress').select('data').eq('user_id', user().id).maybeSingle();
      const remote = data && data.data;
      if (!remote) { await pushProgress(); return; } // first-ever login: upload guest progress as is
      const mergedData = mergeProgress(localProgress(), remote);
      applyMerged(mergedData);
      await db.from('progress').upsert({ user_id: user().id, data: mergedData, updated_at: new Date().toISOString() });
    } catch (e) { console.warn('AGAuth merge failed (local progress kept):', e); }
  }
  // Called by app.js (finishRun) when a game ends.
  function recordGameEnd() { if (on && user()) pushProgress(); }

  // --- UI ------------------------------------------------------------------
  function accountControl() {
    if (!on) return null;
    const wrap = document.createElement('span');
    const renderChip = () => {
      wrap.innerHTML = '';
      const b = document.createElement('button');
      b.className = 'ag-linklike';
      b.type = 'button';
      if (user()) {
        b.textContent = `Signed in · sign out`;
        b.title = userEmail();
        b.onclick = signOut;
      } else {
        b.textContent = 'Sign in (free)';
        b.onclick = signIn;
      }
      wrap.appendChild(b);
    };
    renderChip();
    listeners.push(renderChip);
    return wrap;
  }

  // Signup prompt on the results screen: shown once after the first finished
  // game, then snoozed. Returns null when not applicable.
  function signupPrompt(mode) {
    if (!on || user()) return null;
    const dismissed = getLS(LS.promptDismissed, 0);
    if (Date.now() - dismissed < (cfg.promptSnoozeDays || 7) * 864e5) return null;
    const box = document.createElement('div');
    box.className = 'ag-auth-prompt';
    const txt = document.createElement('p');
    txt.textContent = 'Keep your streak across devices and unlock extra modes with a free account.';
    const row = document.createElement('div');
    row.className = 'ag-actions';
    const go = document.createElement('button');
    go.className = 'ag-btn is-primary';
    go.type = 'button';
    go.textContent = 'Sign up free';
    go.onclick = signIn;
    const no = document.createElement('button');
    no.className = 'ag-btn is-ghost';
    no.type = 'button';
    no.textContent = 'Not now';
    no.onclick = () => { setLS(LS.promptDismissed, Date.now()); box.remove(); };
    row.appendChild(go); row.appendChild(no);
    box.appendChild(txt); box.appendChild(row);
    return box;
  }

  // Login wall shown when a guest taps a gated mode. Returns true when the
  // tap was intercepted (caller should not start the mode).
  function gateInterception(mode) {
    if (!needsLogin(mode)) return false;
    const overlay = document.createElement('div');
    overlay.className = 'ag-auth-gate';
    const card = document.createElement('div');
    card.className = 'ag-auth-gate-card';
    const t = document.createElement('p');
    t.textContent = 'This mode is part of the free account. Sign in to play it - your scores stay in sync.';
    const go = document.createElement('button');
    go.className = 'ag-btn is-primary';
    go.type = 'button';
    go.textContent = 'Sign in (free)';
    go.onclick = signIn;
    const no = document.createElement('button');
    no.className = 'ag-btn is-ghost';
    no.type = 'button';
    no.textContent = 'Back';
    no.onclick = () => overlay.remove();
    card.appendChild(t); card.appendChild(go); card.appendChild(no);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    return true;
  }

  if (on) init();
  return { on, init, user, userEmail, isGated, needsLogin, signIn, signOut, recordGameEnd, accountControl, signupPrompt, gateInterception, onChange: (fn) => listeners.push(fn) };
})();
