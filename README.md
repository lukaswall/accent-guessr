# Accent Guessr

A daily accent-guessing game. Five real voices a day: listen, then guess which accent each speaker has. Five turns per voice: each guess or "Next clue" uses one turn and reveals one more clue (world region, then letters of the accent name), then the answer, an endless mode, a practice mode, a quick-pick mode (four written options per voice), fixed-length short modes (2, 3 or 5 seconds of every voice), and a hard mode that starts you with 2 seconds of audio and unlocks more of the same clip (3 s, 5 s, full) as you guess or tap Next clue. The player shows the unlocked time, playback progress, and has play/pause and replay-from-start controls. After each reveal a world map highlights the place the answer label is named after. Streaks and a shareable score.

Play it: https://lukaswall.github.io/accent-guessr/

## How it loads

Clip metadata lives in `clips.json` (~32 KB) and each voice is one small MP3 in `clips/`, fetched only when that round starts (the next voice is preloaded while you guess). First load is the page plus the manifest - about 170 KB - instead of the whole audio library, so adding more voices no longer makes the page heavier.

## Accounts (off by default)

Free sign-in with Google (Supabase Auth) can sync streaks and scores across devices and gate extra modes. It is **disabled** until a Supabase project is configured: with `auth-config.js` set to `enabled: false` there is no sign-in UI, no mode gate and no third-party requests. To turn it on, see `supabase/SETUP.md`; the database schema is `supabase/schema.sql`.

## Audio

All voice clips are edited excerpts from the [EdAcc corpus](https://huggingface.co/datasets/edinburghcstr/edacc) (University of Edinburgh), shared under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The edited clip set in this repository is shared under the same license. See [NOTICE](NOTICE) and [ATTRIBUTION.md](ATTRIBUTION.md).
