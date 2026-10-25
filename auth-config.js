// Account wiring for Accent Guessr.
//
// IMPORTANT: while `enabled` is false (the default), the game behaves exactly
// as if accounts did not exist: no sign-in UI, no mode gates, no third-party
// scripts are loaded, and no data leaves the browser. Do not flip `enabled`
// to true until a real Supabase project exists and its URL + anon key are
// filled in below - otherwise the sign-in UI would be fake. See
// supabase/SETUP.md for the steps.
const AG_AUTH = {
  enabled: false,
  url: '',        // e.g. https://abcdefgh.supabase.co
  anonKey: '',    // the project's public anon key (safe for browsers; RLS enforces access)
  // Modes that need a free account once accounts are on. Daily and Practice
  // always stay open to guests. This gate is honest friction, not security:
  // the game is static files, so a determined player can bypass it. Real
  // enforcement, when it matters, is server-side score validation (see
  // supabase/schema.sql), not this list.
  gatedModes: ['endless', 'hard', 'short', 'quick'],
  // How often (at most) the guest-signup prompt reappears after dismissal.
  promptSnoozeDays: 7,
};
