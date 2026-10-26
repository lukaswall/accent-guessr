# Expansion staging - review status (2026-10-26)

## State: BLOCKED on listening review (not publishable)

## Audio-inspection capability check (one-time, per gate)
Available inspection capabilities in this environment:
- platform transcription (`read` tool) - content/spoiler/intelligibility-proxy only
- waveform + duration metadata, ffmpeg signal stats (energy, silencedetect)
- spectrogram images (visual inspection)

None of these directly assesses perceived sound quality, speaker overlap, or
natural-boundary quality as a listener would experience it. No human/audible
audition capability exists here. Conclusion: the QA dimensions
"intelligibility (as heard)" and "speaker overlap" CANNOT be settled with
available tooling. Staging remains blocked on listening review.

## What IS established (documented, qualified checks)
- Source/license evidence: HF mirror revision d9ae7bd, CC BY-SA 4.0, deposit
  relationship explicitly unknown (deposit_equivalence: unknown). Recorded per clip.
- Deterministic regeneration: all 44 final-selected clips were regenerated from
  the HF parquet shards (row indices recorded in each clip's source block).
  44/44 extracted source WAV bytes match recorded source_sha256; 44/44
  re-encoded MP3s match recorded output_sha256 byte-identically
  (regeneration-verification.json). The previously lost staged MP3s are
  provably reproduced, not approximated.
- Transcript review of every candidate: meta-speech, place-spoiler,
  accent-talk, sparse-content scans + eyeball review. Rejects recorded in
  qa-scan.json and selection notes (participant-ID utterances, place-misleads
  incl. "going to Nigeria?"/"United States"/"been to London", "Yeah."-only,
  persistently untranscribable candidates).
- Privacy: child first-name clip excluded (uncertain context; exclusion chosen).
- Window policy: whole utterances 9-14s or silence-gap cuts only; no hard cuts,
  no concatenation; boundary_uncertain candidates skipped at ingest.
- Daily schedule: pinned data/schedule.json unchanged; expansion clips would
  enter Endless/Practice/Quick only. Ghanaian/Romanian/Israeli single-speaker
  labels are not Daily-eligible.

## What is NOT established (blocking)
- Audible intelligibility and absence of overlapping voices for the 44 selected
  clips. Transcription success + signal stats are necessary but not sufficient
  evidence. Clips stay staged (staging/clips/, gitignored; manifest here)
  until a listening review passes or the user accepts the documented limits.

## Selection counts
- 44 clips / 15 speakers / 7 labels. C36-B (Ghanaian) contributes 2 clips
  (smaller clean batch; remaining candidates untranscribable or rejected).
- All other speakers contribute 3.
