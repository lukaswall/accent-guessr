# EdAcc expansion inventory (verified 2026-10-26)

Method: HF datasets-server statistics + full parquet read of both splits
(speaker/accent/gender columns), cross-referenced with the 40 in-game speaker IDs.

## Dedup (exact, not estimated)

- In game: 40 speakers, all from the **validation** split (62 speakers), 0 from test (60).
- Validation and test share no speakers. Unused: **82 speakers** (22 validation + 60 test).
- Every speaker carries exactly one accent label across all their utterances.

## New labels available (unused speakers only)

| Label (dataset spelling) | Speakers | Notes |
|---|---|---|
| Nigerian English | 5 | test split |
| Latin American | 3 | 1 validation, 2 test; broad label - not a country |
| Kenyan English | 2 | test |
| Lithuanian | 2 | test |
| Ghanain English | 1 | test; misspelled in the dataset itself |
| Romanian | 1 | test |
| Israeli | 1 | test |

Dataset label inconsistencies to normalize explicitly at import (never silently):
`Ghanain English` (test) and `Indonesian` (test, vs `Indonesian English` in
validation and in the current game).

Excluded as too vague (per sourcing research): Don't know (4), European (3), Latin (1).

## Clip quality (audio sampled via datasets-server, 25 utterances per speaker, 84 for C04-A)

Every candidate has at least 3 utterances >= 9 s (enough for the game's 9-13 s
excerpt format without concatenation) plus abundant >= 2 s material; mean silence
ratio 0.03-0.17 (ffmpeg silencedetect -35dB/0.4s). Kenyan C35-A is the most
pause-heavy (0.172) but still yields 5 utterances >= 9 s. Ghanaian C36-B is the
thinnest (3 utterances >= 9 s in sample) and is a single-speaker label.

| Speaker | Label | Gender | Utterances (full) | Sample speech secs | >=9s in sample |
|---|---|---|---|---|---|
| EDACC-C29-A | Nigerian English | f | 551 | 161.8 | 8 |
| EDACC-C29-B | Nigerian English | m | 552 | 115.9 | 3 |
| EDACC-C41-A | Nigerian English | f | 100 | 263.8 | 14 |
| EDACC-C45-A | Nigerian English | m | 76 | 167.5 | 7 |
| EDACC-C45-B | Nigerian English | m | 77 | 93.7 | 4 |
| EDACC-C04-A | Latin American | f | 84 | 452.6 | 24 |
| EDACC-C26-A | Latin American | f | 44 | 226.7 | 11 |
| EDACC-C26-B | Latin American | m | 44 | 276.4 | 9 |
| EDACC-C35-A | Kenyan English | f | 583 | 95.9 | 5 |
| EDACC-C35-B | Kenyan English | m | 574 | 200.2 | 5 |
| EDACC-C38-A | Lithuanian | m | 290 | 144.8 | 6 |
| EDACC-C38-B | Lithuanian | m | 288 | 145.6 | 6 |
| EDACC-C36-B | Ghanain English | f | 357 | 104.5 | 3 |
| EDACC-C05-A | Romanian | f | 272 | 80.8 | 4 |
| EDACC-C57-B | Israeli | m | 267 | 132.4 | 8 |

## Daily-eligibility rule (for future pin generation)

A label needs >= 2 speakers in the manifest before its clips may be pinned into a
Daily set (single-speaker labels leak the answer through voice memorization).
Single-speaker labels remain playable in Endless/Practice/Quick. Existing
single-speaker labels (7) are unchanged - no retroactive edits.
