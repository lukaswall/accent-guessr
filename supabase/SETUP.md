# Accent Guessr accounts - setup runbook

The game ships with accounts **disabled** (`auth-config.js`: `enabled: false`).
In that state there is no sign-in UI, no mode gate, no Clerk or Supabase
script load, and no data leaves the browser. Follow these steps to turn
accounts on.

Architecture: **Clerk** handles sign-in (free Hobby plan, 50k monthly
retained users included). **Supabase** stores progress rows and accepts the
Clerk session token as a third-party auth provider, so there is no server to
run and no second login system.

## 1. Supabase project (already done for accent-guessr)

1. Project `accent-guessr` (ref `moquhqdqabdlurmomtxf`, EU Ireland, free
   tier) exists in the owner's Supabase account. The free plan covers this
   design (500 MB database; a game-end row is well under 1 KB).
2. Run `supabase/schema.sql` in the project's SQL editor. (Done once; the
   file is safe to re-run - it drops and recreates the game objects.)
3. The project URL and publishable key are already in `auth-config.js`.
   The publishable key is safe to ship in the browser - row-level security
   is what protects the data.

## 2. Clerk application

1. At https://dashboard.clerk.com, sign in and open (or create) the
   application for the game. A production instance on the free Hobby plan
   is enough.
2. Under User & Authentication settings, enable the sign-in methods you
   want (e.g. Google and/or email). No paid features are needed.
3. Activate the Supabase integration: Clerk Dashboard > Integrations >
   Supabase (https://dashboard.clerk.com/setup/supabase), choose the
   options and click **Activate Supabase integration**. Copy the revealed
   **Clerk domain**.
4. In the Supabase dashboard: Authentication > Sign In / Up > Third Party
   Auth > Add provider > **Clerk**, paste the Clerk domain. From this point
   Supabase accepts Clerk session tokens and `auth.jwt()->>'sub'` is the
   Clerk user id in RLS policies.
5. Copy the Clerk **publishable key** (pk_live_...) from Clerk Dashboard >
   API keys. It is safe for browsers.

## 3. Point the game at Clerk

In `auth-config.js`, fill in `clerkPublishableKey`, set `enabled: true`,
commit, deploy. The sign-in prompt, account control and mode gates appear
on the next deploy.

## Notes and honest limits

- The mode gate (`gatedModes`) is friction, not security: the game is static
  files and a determined player can bypass a client-side lock. What can be
  genuinely enforced is the *records* side (schema section 2), because those
  writes go through a server-side check. Personal progress sync trusts the
  player's device by design (it's their own data).
- `submit_daily_result` recomputes daily scores server-side and rejects
  impossible timing, but the answers ship in `clips.json`, so a careful
  cheater can still fabricate plausible rounds. It raises the bar; it is
  not cheat-proof.
- Free-tier ceilings to keep an eye on: Clerk Hobby 50k monthly retained
  users; Supabase free 500 MB database / 5 GB egress. Both are far above
  what this design uses.
