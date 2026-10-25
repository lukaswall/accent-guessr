# Hosting migration runbook (GitHub Pages -> Cloudflare Pages)

The game is plain static files, so the move is configuration, not code. Do
this only with the account owner's go-ahead (it touches their Cloudflare
account and later a paid domain).

## Why move

- Cloudflare Pages free tier: unlimited static requests and bandwidth
  (https://pages.cloudflare.com/), so audio traffic stops counting against
  GitHub Pages' soft 100 GB/month limit
  (https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
- GitHub Pages terms restrict commercial use; if ads ever go live, being on
  Cloudflare removes that grey area.

## Steps

1. In Cloudflare: Workers & Pages > Create > Pages > Connect to Git, pick
   `lukaswall/accent-guessr`, framework preset "None", build command empty,
   output directory `/` (repo root). Every push to `main` deploys.
2. Smoke-test the `*.pages.dev` URL: home loads, a round plays, results save.
3. Custom domain (optional, ~$10-15/year, needs a purchase OK): add it in
   Pages > Custom domains. A registrable domain also makes AdSense's Sites
   list simple if ads ever happen, and makes `ads.txt` possible.
4. Only after the pages.dev site verifies: stop relying on the GitHub Pages
   URL. Keep the repo public (attribution and the CC BY-SA clip set live
   there); GitHub Pages can stay on as a fallback or be turned off in repo
   Settings > Pages.

## Notes

- Audio can stay in the repo (120 clips ~= 6 MB). R2 object storage is an
  option at much larger libraries (free tier 10 GB, zero egress fees:
  https://developers.cloudflare.com/r2/pricing/) but is not needed now.
- Supabase redirect URLs (supabase/SETUP.md step 2.4) must be updated to the
  final domain when it changes.
