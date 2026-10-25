-- Accent Guessr - Supabase schema (run once in the Supabase SQL editor).
-- Auth provider: Clerk (https://clerk.com), connected as a Supabase
-- "third-party auth" provider. The game never uses Supabase Auth users;
-- the player identity is the Clerk user id from the session JWT
-- (auth.jwt() ->> 'sub', e.g. "user_2abc...").
--
-- PREREQUISITE (see supabase/SETUP.md): Clerk must be activated as a
-- third-party auth provider in Authentication -> Sign In / Up ->
-- Third Party Auth, or every request with a Clerk token is rejected.
--
-- Design: one JSONB progress row per user, written only when a game ends.
-- Row-level security: every user reads and writes only their own rows.
--
-- NOTE: this file drops and recreates the earlier Supabase-Auth variant of
-- these objects. That variant was applied to this project before any user
-- data existed, so the drops lose nothing.

drop function if exists public.submit_daily_result(jsonb, integer);
drop table if exists public.game_results;
drop table if exists public.progress;

-- ---------------------------------------------------------------------------
-- 1. Progress sync (used by auth.js today)
-- ---------------------------------------------------------------------------
create table public.progress (
  user_id text primary key default auth.jwt()->>'sub',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

create policy "progress: read own" on public.progress
  for select to authenticated
  using ((select auth.jwt()->>'sub') = user_id);
create policy "progress: insert own" on public.progress
  for insert to authenticated
  with check ((select auth.jwt()->>'sub') = user_id);
create policy "progress: update own" on public.progress
  for update to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

-- ---------------------------------------------------------------------------
-- 2. Game results + validated daily scores (phase 3: leaderboards)
--    Not called by the game yet. This is the honest-score foundation:
--    personal progress (table above) is whatever the player's device says;
--    leaderboard-worthy records go through submit_daily_result, which
--    re-checks the score arithmetic and rejects impossible timing.
-- ---------------------------------------------------------------------------
create table public.game_results (
  id bigint generated always as identity primary key,
  user_id text not null default auth.jwt()->>'sub',
  mode text not null check (mode in ('daily', 'endless', 'hard', 'short', 'quick')),
  played_on date not null default current_date,
  score integer not null,
  cleared integer not null default 0,
  rounds jsonb not null,
  elapsed_ms integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, mode, played_on)
);

alter table public.game_results enable row level security;

create policy "results: read own" on public.game_results
  for select to authenticated
  using ((select auth.jwt()->>'sub') = user_id);
-- No direct insert/update/delete policies: writes go only through the
-- security-definer function below, which validates before inserting.

-- Recompute the daily score from the submitted rounds and reject impossible
-- submissions. Limits of this check (be honest about them): the answers ship
-- in clips.json, so a determined cheater can always fabricate plausible
-- rounds. This raises the bar to "must fake carefully", it cannot prevent
-- cheating entirely.
create function public.submit_daily_result(
  p_rounds jsonb,
  p_elapsed_ms integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user text := auth.jwt()->>'sub';
  v_score integer := 0;
  v_round jsonb;
  v_points integer;
  v_min_ms integer;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  if jsonb_typeof(p_rounds) <> 'array' or jsonb_array_length(p_rounds) <> 5 then
    raise exception 'a daily result must have exactly 5 rounds';
  end if;
  for v_round in select * from jsonb_array_elements(p_rounds) loop
    v_points := coalesce((v_round ->> 'points')::integer, -1);
    if v_points < 0 or v_points > 5 then
      raise exception 'round points out of range';
    end if;
    v_score := v_score + v_points;
  end loop;
  -- Five clips are ~10-13 s each; a real play-through cannot be faster.
  v_min_ms := 5 * 8000;
  if p_elapsed_ms < v_min_ms then
    raise exception 'impossible timing';
  end if;

  insert into public.game_results (user_id, mode, score, cleared, rounds, elapsed_ms)
  values (v_user, 'daily', v_score, 0, p_rounds, p_elapsed_ms)
  on conflict (user_id, mode, played_on) do nothing;

  return jsonb_build_object('accepted', true, 'score', v_score);
end;
$$;
