# Accent Guessr accounts - setup runbook

The game ships with accounts **disabled** (`auth-config.js`: `enabled: false`).
In that state there is no sign-in UI, no mode gate, no Supabase script load,
and no data leaves the browser. Follow these steps to turn accounts on.

## 1. Create the Supabase project (free tier is enough to start)

1. At https://supabase.com, sign in and create a new project (any region near
   the players, e.g. EU). The free plan covers this design (500 MB database;
   a game-end row is well under 1 KB).
2. In the SQL editor, run `supabase/schema.sql` from this repo.
3. In Project Settings > API, copy the **project URL** and the **anon public
   key**. The anon key is safe to ship in the browser - row-level security is
   what protects the data.

## 2. Turn on Google sign-in

1. In Google Cloud Console, create an OAuth client (Web application). If
   asked, configure the consent screen first (External, basic app info).
2. Set the authorized redirect URI to
   `https://<project-ref>.supabase.co/auth/v1/callback`
   (Supabase shows the exact value under Authentication > Providers > Google).
3. In Supabase: Authentication > Providers > Google - enable it and paste the
   client ID and secret.
4. In Supabase: Authentication > URL Configuration - set Site URL to the game
   URL (e.g. `https://lukaswall.github.io/accent-guessr/`) and add it to the
   allowed redirect URLs.

## 3. Point the game at the project

In `auth-config.js`, fill in `url` and `anonKey`, set `enabled: true`, commit.
The sign-in prompt, account control and mode gates appear on the next deploy.

## Notes and honest limits

- The mode gate (`gatedModes`) is friction, not security: the game is static
  files and a determined player can bypass a client-side lock. What can be
  genuinely enforced is the *records* side (schema section 2), because those
  writes go through a server-side check. Personal progress sync trusts the
  player's device - that is fine, it is their own progress.
- Google-only sign-in is deliberate: Supabase's built-in email is
  rate-limited for testing, so email/password would need a paid SMTP setup.
- The free Supabase project pauses after about a week with no activity; the
  first real cost (~$25/month Pro) arrives when that pause or the free limits
  actually hurt, not before.
