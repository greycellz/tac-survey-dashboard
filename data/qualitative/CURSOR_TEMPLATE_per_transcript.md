# Qualitative Extraction Template

> **Purpose:** this file is the canonical extraction procedure for the qualitative interview corpus. A Cursor agent reads it and executes the steps for a single participant whose ID is supplied in the chat ("Run this template for INT###"). One agent, one transcript, one fresh Cursor chat.
>
> **Reproducibility note for the paper:** extractions in `data/qualitative/extractions/` were produced by Cursor agents (Claude Sonnet 4.6) following this template against the SKILL and CODEBOOK versions stamped in each output JSON.

---

## What you (the agent) are doing

You are coding **one** wildfire-survivor interview transcript. The participant ID you must use is the one the user named in the chat message that referenced this template — typically `INT002`, `INT003`, etc. Every reference to `<ID>` below means that same participant ID.

The rules of coding are in `data/qualitative/SKILL.md` and the controlled vocabulary is in `data/qualitative/CODEBOOK.json`. Read both end to end before producing any output. Do not skip files. Do not improvise on the schema.

You are coding **only one** transcript. Do not touch any other transcript, any other extraction file, or any code in the repo.

---

## Step 1 — Read the spec, codebook, and transcript

In this exact order:

1. `data/qualitative/SKILL.md` — the prompt you must follow.
2. `data/qualitative/CODEBOOK.json` — the only valid set of code IDs.
3. `data/qualitative/transcripts/<ID>.md` — the source data you will code.

Internalize the verbatim quote rule and Boundary Rules A, B, C from SKILL.md §2.1 before coding. Quote only the participant; never the interviewer.

## Step 2 — Pin metadata

Open `data/qualitative/manifest.json`. Find the entry where `id === "<ID>"`. Capture:

- `transcriptSha256` (the long hex string)
- `id`

These go into your JSON verbatim. Do not recompute the sha256.

## Step 3 — Produce the extraction

Follow SKILL.md §3 to produce a JSON object. All 8 categories must be present in `codedQuotes` (use `[]` for empty), every quote must be a verbatim participant substring, every codeId must exist in CODEBOOK.json.

Stamp the version fields with the **current** versions in the files you just read:

- `skillVersion`: read from the title line of `data/qualitative/SKILL.md` (e.g. `v1.2.0`)
- `codebookVersion`: read from the `version` field in `data/qualitative/CODEBOOK.json`

Do not hardcode versions; read them from the files. This is what guarantees reproducibility — every extraction is stamped against the exact SKILL and CODEBOOK that produced it.

The `mvpAdversarialAudit` must be populated honestly. Actually run both polarity passes on the demo section (typically the back third of the transcript), then write a `notes` field describing what you found. If you find no endorsements, say so. If you find no hesitations, say so. Never fabricate, never pad.

`summary` ≤ 500 words, prose only, no quotes, no codes.

`uncodedObservations` is optional but valuable — log any pattern you observe that doesn't fit a code, with a verbatim quote anchor and a brief note.

Be conservative on coding. 30–60 quotes total is healthy. 100+ usually means over-coding. A code that applies only loosely is a code that should not be applied.

## Step 4 — Write output

Write the JSON to `data/qualitative/extractions/<ID>.json` with 2-space indentation and a trailing newline. Do not write any other files.

## Step 5 — Schema validation

Run from the repo root:

```bash
npx tsx -e "
  import('./scripts/qualitative/validate-extraction-schema').then(async (m) => {
    const fs = await import('node:fs');
    const cb = m.loadCodebook('data/qualitative/CODEBOOK.json');
    const ext = JSON.parse(fs.readFileSync('data/qualitative/extractions/<ID>.json', 'utf8'));
    const errs = m.validateExtractionSchema(ext, cb);
    if (errs.length === 0) {
      console.log('Schema valid.');
    } else {
      console.error('Schema errors:');
      for (const e of errs) console.error('  ' + e.path + ': ' + e.message);
      process.exit(1);
    }
  });
"
```

Replace `<ID>` with the actual participant ID. If the validator prints errors, fix the JSON in place and re-run. Do not skip this step.

## Step 6 — Five-quote spot check

```bash
npx tsx -e "
  import('./scripts/qualitative/parse-transcript').then(async (m) => {
    const { parsed } = m.parseTranscriptFromFile('data/qualitative/transcripts/<ID>.md');
    const ext = JSON.parse(require('node:fs').readFileSync('data/qualitative/extractions/<ID>.json', 'utf8'));
    const allQuotes = Object.values(ext.codedQuotes).flat().map(q => q.quoteVerbatim);
    const sample = allQuotes.slice(0, 5);
    for (const q of sample) {
      const idx = parsed.flatText.indexOf(q);
      const inParticipant = idx > -1 && parsed.speakerSpans.some(
        s => s.speakerRole === 'participant' && s.flatCharStart <= idx && idx + q.length <= s.flatCharEnd
      );
      console.log((inParticipant ? '[OK]' : '[FAIL]'), q.slice(0, 80) + (q.length > 80 ? '…' : ''));
    }
  });
"
```

Replace `<ID>` with the actual participant ID. All five lines must be `[OK]`. If any are `[FAIL]`, fix the offending quote in the JSON (find a real verbatim quote that supports the same code, or remove the code) and re-run.

## Step 7 — Report back in chat

Reply with this exact structure:

### Counts
- Total coded quotes:
- Per-category counts (8 lines, e.g. `lifeAndRoutineChanges: 7`)
- Number of `uncodedObservations`:
- mvpAdversarialAudit: endorsements found / hesitations found / model's notes (verbatim)

### Smoke check
- Schema validation: ✅/❌
- Five-quote spot check: ✅/❌

### Sample output
- The full `summary` field
- First two coded quotes from `recoveryChallengesAndPainPoints` (or any non-empty category if RCPP is empty)
- The full `mvpFeedback` array

### Observations
- Codes that felt forced or borderline (with the cue / quote)
- Patterns without a clean code (i.e., what's in `uncodedObservations` and why)
- Anything ambiguous about Boundary Rules A/B/C from SKILL.md §2.1 in practice

The Observations section is the most important part of the report — the human reviewer uses it to decide whether the codebook needs revision.

---

## What you must NOT do

- Do not modify SKILL.md, CODEBOOK.json, or any code in the repo
- Do not extract any transcript other than the one ID supplied by the user
- Do not invent code IDs (use `uncodedObservations` for codebook gaps)
- Do not write a separate markdown summary or "narrative" file
- Do not include comments inside the JSON (no `//`, no extra fields)
- Do not paraphrase, edit, or "clean up" quotes — verbatim only
- Do not concatenate quotes across cues

## Acceptance criteria

This task is complete when:

1. `data/qualitative/extractions/<ID>.json` exists
2. Schema validation passes
3. Five-quote spot check is 5/5
4. Report-back chat message contains all four sections

Stop after acceptance. Do not proceed to any other transcript.