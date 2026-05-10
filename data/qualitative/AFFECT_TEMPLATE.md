# Per-Transcript Affect Annotation Template

> **Cursor agent:** read this file and execute the steps for the participant ID supplied by the user. Use Sonnet 4.6 or any model the user has selected.

## Step 1 — Read

1. `data/qualitative/SKILL_AFFECT.md` — the rules
2. `data/qualitative/AFFECT_VOCABULARY.json` — the 12 emotions
3. `data/qualitative/extractions/<ID>.validated.json` — the quotes you must annotate

## Step 2 — Annotate every quote

For each quote in `codedQuotes` (across all 8 categories) AND each entry in `uncodedObservationsValidated`:

- Read `quoteVerbatim`, the `codeIds` (if present), and `citation.contextBefore` / `citation.contextAfter`.
- Apply the rules in SKILL_AFFECT.md.
- Compute `quoteId` the same way the dashboard does: `<ID>:cue<cueNumber>:<indexAtCue>`. The per-cue index increments in **global** order: iterate categories in this exact order — `lifeAndRoutineChanges`, `emotionalImpact`, `recoveryChallengesAndPainPoints`, `needsOverTime`, `technologyForRecovery`, `aiAttitudesAndBeliefs`, `mvpFeedback`, `crossCutting` — appending every coded quote in each category in array order, then append `uncodedObservationsValidated` in array order. Verify each quoteId is unique.

## Step 3 — Write the file

Output to `data/qualitative/affect/<ID>.affect.json`:

```json
{
  "participantId": "<ID>",
  "affectSkillVersion": "v1.0.0",
  "affectVocabularyVersion": "v1.0.0",
  "generatedAt": "<ISO timestamp>",
  "annotations": [ /* one entry per quote, schema in SKILL_AFFECT.md §3 */ ]
}
```

## Step 4 — Validate

```bash
npx tsx -e "
  import('./scripts/qualitative/validate-affect-schema').then(async (m) => {
    const fs = await import('node:fs');
    const v = m.loadAffectVocabulary('data/qualitative/AFFECT_VOCABULARY.json');
    const f = JSON.parse(fs.readFileSync('data/qualitative/affect/<ID>.affect.json', 'utf8'));
    const errs = m.validateAffectFile(f, v);
    if (errs.length === 0) console.log('Schema valid.');
    else { console.error('Errors:'); errs.forEach(e => console.error('  ' + e.path + ': ' + e.message)); process.exit(1); }
  });
"
```

If errors, fix in place and re-run.

## Step 5 — Coverage check

```bash
npx tsx scripts/qualitative/validate-affect.ts
```

Must show `0 coverage mismatches` and the right annotation count for `<ID>`.

## Step 6 — Report

Reply with:

- Total annotations
- Distribution: counts per primary emotion across this transcript
- Mean intensity, mean stance
- 2–3 example annotations (quote + emotion + rationale) you found most uncertain — useful for the human reviewer

## Do not

- Do not modify SKILL_AFFECT.md, AFFECT_VOCABULARY.json, validated extractions, transcripts, or any code.
- Do not annotate any other transcript than the supplied ID.
- Do not invent emotions outside the vocabulary.
- Do not skip quotes — every quote in the validated extraction must have exactly one annotation.
