// Account wiring for Accent Guessr.
//
// Auth is Clerk; progress sync is Supabase (Clerk session token is accepted
// by Supabase as a third-party auth provider - see supabase/SETUP.md).
//
// IMPORTANT: while `enabled` is false (the default), the game behaves exactly
// as if accounts did not exist: no sign-in UI, no mode gates, no third-party
// scripts are loaded, and no data leaves the browser. Do not flip `enabled`
// to true until clerkPublishableKey is filled in and the Clerk <-> Supabase
// connection is verified end-to-end - otherwise the sign-in UI would be fake.
const AG_AUTH = {
  enabled: false,
  // Clerk publishable key (pk_live_... or pk_test_...), safe for browsers.
  clerkPublishableKey: '',
  // Supabase project the progress rows live in (publishable key is safe for
  // browsers; row-level security enforces access).
  supabaseUrl: 'https://moquhqdqabdlurmomtxf.supabase.co',
  supabasePublishableKey: 'sb_publishable_VEZbDJtSpAejpi5KQVVKRw_WMExWw9L',
  // Modes that need a free account once accounts are on. Daily and Practice
  // always stay open to guests. This gate is honest friction, not security:
  // the game is static files, so a determined player can bypass it. Real
  // enforcement, when it matters, is server-side score validation (see
  // supabase/schema.sql), not this list.
  gatedModes: ['endless', 'hard', 'short', 'quick'],
  // How often (at most) the guest-signup prompt reappears after dismissal.
  promptSnoozeDays: 7,
};
