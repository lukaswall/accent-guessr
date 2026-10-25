-- Accent Guessr - Supabase schema (run once in the Supabase SQL editor).
-- Design: one JSONB progress row per user, written only when a game ends.
-- Row-level security: every user reads and writes only their own rows.

-- ---------------------------------------------------------------------------
-- 1. Progress sync (used by auth.js today)
-- ---------------------------------------------------------------------------
create table if not exists public.progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

create policy "progress: read own" on public.progress
  for select using (auth.uid() = user_id);
create policy "progress: insert own" on public.progress
  for insert with check (auth.uid() = user_id);
create policy "progress: update own" on public.progress
  for update using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. Game results + validated daily scores (phase 3: leaderboards)
--    Not called by the game yet. This is the honest-score foundation:
--    personal progress (table above) is whatever the player's device says;
--    leaderboard-worthy records go through submit_daily_result, which
--    re-checks the score arithmetic and rejects impossible timing.
-- ---------------------------------------------------------------------------
create table if not exists public.game_results (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
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
  for select using (auth.uid() = user_id);
-- No direct insert/update/delete policies: writes go only through the
-- security-definer function below, which validates before inserting.

-- Recompute the daily score from the submitted rounds and reject impossible
-- submissions. Limits of this check (be honest about them): the answers ship
-- in clips.json, so a determined cheater can always fabricate plausible
-- rounds. This raises the bar to "must fake carefully", it cannot prevent
-- cheating entirely.
create or replace function public.submit_daily_result(
  p_rounds jsonb,
  p_elapsed_ms integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_score integer := 0;
  v_round jsonb;
  v_points integer;
  v_min_ms integer;
begin
  if auth.uid() is null then
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
  values (auth.uid(), 'daily', v_score, 0, p_rounds, p_elapsed_ms)
  on conflict (user_id, mode, played_on) do nothing;

  return jsonb_build_object('accepted', true, 'score', v_score);
end;
$$;
