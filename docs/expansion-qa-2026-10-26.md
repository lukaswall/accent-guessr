# Expansion QA state (2026-10-26, end of run)

Staging: 103 candidate clips in staging/ (gitignored), scripts/ingest-edacc.mjs
(filter API -> 9-14s natural or silence-bounded windows, never hard-cut, MP3
32kHz mono 32kbps, sha256 of source bytes + output, HF revision d9ae7bd recorded,
origin_status=hf_mirror, deposit-equivalence explicitly unknown).

QA method (limits stated): platform transcription of every candidate +
automated scans (meta-speech, place-name spoilers, accent-talk, sparse speech) +
manual transcript eyeball. NOT audible human review: overlapping voices and
subtle intelligibility cannot be fully excluded computationally.

Result: 45-clip first selection (staging/final-selection.json, 15 speakers x 3);
42/45 passed. 3 known rejects to re-select before publish:
- ghanaian-english-edacc-c36-b-0: names a child ("George") - privacy avoid
- ghanaian-english-edacc-c36-b-2: "I've also been to London" - place-name spoiler
- lithuanian-edacc-c38-b-0: "My number is FC25P2" participant-ID prefix evaded scan

Notable true positives the scan caught: "the education system is ... distinct
from that of Nigeria" (self-identification), "I think British accent is cool",
"I love New York", participant-number utterances, "Yeah."-only utterances.

Kenyan C35-A-2 quotes a cartoon line ("Stupid dog. You made me look bad" -
Courage the Cowardly Dog quote, kept, harmless in context).

Next run: re-select the 3 rejects (C38-B replacement already staged; C36-B
needs one more clean window - several candidates returned empty transcripts,
investigate), then publish: move 45 clips to clips/, extend clips.json
(honoring schema + validator), wire 7 new labels in app.js (PLACE/COORDS/
GUESS_CONTINENT/SEARCH_TERMS/MAP_ISO + MAP_REGION ellipse for Latin American),
regenerate ATTRIBUTION.md, verify live. Daily untouched (pins through Dec 31
unchanged; new labels need >=2 speakers for future pins per inventory rule).
