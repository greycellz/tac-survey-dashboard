# Qualitative Extraction SKILL — v1.2.0

You are coding one wildfire-survivor interview transcript for a research study at The After Collective (TAC). Your output is JSON conforming to the schema in this document. Your codes come from a fixed, controlled vocabulary in CODEBOOK.json. Your evidence is verbatim quotes from the participant's speech. **No paraphrasing, no edits, no ellipsis.** A quote that does not appear word-for-word in the participant's flat text will be rejected by an automated validator.

This document has three parts:

1. **Rules** — what counts as evidence, what counts as a code, what to refuse.
2. **The eight categories** — what each category covers and how to tell them apart.
3. **Output schema** — exact JSON shape.

Read all three before you produce output.

---

## 1. Rules

### 1.1 Verbatim quote rule

Every code you produce must be supported by a `quoteVerbatim` string. That string must:

- Be a **literal substring** of the participant's flat text — same characters, same punctuation, same casing as the transcript shows.
- Come from a **single contiguous participant utterance**, not stitched together from multiple cues.
- Contain **no ellipsis, no `[…]`, no edits for clarity, no normalization.** If the participant said "you know, like, the rug had been pulled out from under me", that's the quote. Do not clean it up.
- Be long enough to stand on its own as evidence (typically 8+ words). Do not quote single-word utterances like "Yeah."
- Quote only the **participant's own words**. Never quote the interviewer.

If you cannot find a verbatim quote that supports a code you want to apply, **do not apply the code.** Coding without a clean quote is the failure mode this entire system is built to prevent.

### 1.2 Controlled vocabulary

Every `codeIds` value in your output must be a code `id` that exists in CODEBOOK.json. Codes outside the vocabulary will be rejected. If you observe a pattern that doesn't fit any existing code, do not invent one — **note it in the top-level `uncodedObservations` array** (see schema §3). The research team reviews these and decides whether to add a new code in a future codebook version.

### 1.3 Multi-coding

A single quote can carry multiple codes if the utterance genuinely speaks to multiple themes. Be conservative — if a code applies only loosely, leave it off. Quality over quantity.

### 1.4 Refusal cases

A category that the participant simply did not discuss returns an **empty array** for that category's `codedQuotes`. Empty is the correct answer when the data is absent. Do not stretch other content to fill a category.

### 1.5 Adversarial pass for `mvpFeedback`

Before finalizing the `mvpFeedback` codes, do an **explicit adversarial pass**:

1. Read the back third of the transcript again with the question: *what did the participant criticize, hesitate about, or push back on regarding the MVP?* If you find at least one such moment, code it (`mvp_hesitate_*`).
2. Then read with the inverse question: *what did the participant explicitly endorse?* Code those (`mvp_endorse_*`).
3. Populate `mvpAdversarialAudit` with both `endorsementsAttempted: true` and `hesitationsAttempted: true` once you have actually done both passes. Use the `notes` field to briefly say what you found, including "I could not find any [endorsements/hesitations] in this transcript" if that's the honest answer.

The audit field is your sworn statement that you looked for both polarities. Don't fill it in if you skipped the pass.

### 1.6 Tone

Do not write a literary analysis. Do not guess at the participant's deeper feelings. Code what they said, support it with what they said, and stop.

---

## 2. The eight categories

Each code in CODEBOOK.json belongs to exactly one category. Use the descriptions below to disambiguate when a quote could plausibly fit two categories. Then read **Section 2.1** for explicit boundary rules between attitude/usage/demo codes — those are the most common confusion points.

| Category | What it covers | Distinguishing test |
|---|---|---|
| `lifeAndRoutineChanges` | How daily life, work, school, parenting, household structure changed after the fire. | "Is this about the *shape* of the participant's day?" |
| `emotionalImpact` | Affective experience: grief, hope, dread, distance, intrusion, meaning. | "Is this about how it *felt*, not what they did?" |
| `recoveryChallengesAndPainPoints` | Specific institutional or systemic obstacles. | "Could this be turned into a service-design issue?" |
| `needsOverTime` | What kind of support was needed *at what stage*. | "Is the participant marking a phase (acute / medium / long)?" |
| `technologyForRecovery` | Tools and digital practices the participant **actually used** during recovery. | "Did they describe a specific *use*, with what they did and what happened?" |
| `aiAttitudesAndBeliefs` | General views about AI in recovery, **independent of any specific tool the participant used**. | "Is this an opinion or belief about AI as a category?" |
| `mvpFeedback` | Reactions to the **TAC MVP demo specifically** shown during the interview. **Run the adversarial pass.** | "Is this in direct response to the demo Adrienne or Abhi just showed?" |
| `crossCutting` | Patterns this transcript reinforces about how recovery generally works. | "Is this a meta-observation that crosses categories?" |

### 2.1 Boundary rules (read these — they prevent double-coding)

These are the three boundaries the codebook can be most easily confused on. Apply them strictly.

**Rule A — `technologyForRecovery` vs `aiAttitudesAndBeliefs`**

A `tech_*` code attaches to a *use*: a description of having actually run, used, or deployed a tool, with at least an implicit account of what happened.
- ✅ "We ran our inventory through ChatGPT to put it in insurance language" → `tech_ai_advocacy`.
- ✅ "I asked ChatGPT what the best time to buy appliances was" → `tech_ai_inventory` (or similar usage code).

An `ai_*` code attaches to an *attitude or belief* about AI in general, **independent of a specific use moment**.
- ✅ "I think AI is helpful for synthesis but I don't trust it for emotional stuff" → `ai_practical_yes` + `ai_emotional_skeptical`.
- ❌ Don't double-code a single utterance with both a `tech_*` and an `ai_*` code unless the participant clearly does both (describes a use *and* generalizes from it). Prefer the more specific one.

**Rule B — `aiAttitudesAndBeliefs` vs `mvpFeedback`**

`mvp_*` codes are **reserved for reactions to the demo**. The MVP demo happens partway through every interview (typically the back third). If the participant says something AI-skeptical *before* or *unrelated to* the demo, that's `aiAttitudesAndBeliefs`, not `mvpFeedback`.
- ✅ "I'm worried about hallucinations" said in a general AI-trust discussion → `ai_hallucination_concern`.
- ✅ "I'm worried this thing you just showed me would hallucinate" → `mvp_hesitate_accuracy`.
- The two can co-occur in one transcript (general concern earlier + specific concern about the demo later); never code the same quote with both.

**Rule C — `crossCutting` is for the participant's own meta-observations**

If the participant themselves makes a generalization ("survivors don't need more information, they need the right information at the right time"), that's `crossCutting`. Do not use `crossCutting` to record *your own* observations as the coder. Coder observations that don't fit any code go in `uncodedObservations` instead.

**Note on demo timing.** In some interviews the interviewer describes MVP features verbally *before* sharing a screen. Treat the **first concrete feature description by the interviewer** as the start of the demo, not the screen share. The participant's reactions from that point forward are `mvpFeedback`. AI commentary *before* the first feature description belongs in `aiAttitudesAndBeliefs`. Use your judgment when the interviewer mixes general AI discussion with feature description — the rule of thumb is "did the participant respond to a specific TAC feature?"

Categories are ordered roughly chronologically by where they appear in the interview, but **content can appear anywhere** — a participant might mention insurance pain in the opening minute. Code by content, not by location.

---

## 3. Output schema

Return exactly this JSON shape. No prose around it. No markdown fences. The `<...>` placeholders show types, not literal text.

```json
{
  "participantId": "<INT001>",
  "transcriptSha256": "<sha from manifest>",
  "skillVersion": "v1.2.0",
  "codebookVersion": "v1.2.0",
  "generatedAt": "<ISO timestamp>",
  "summary": "<≤500 words: a tight summary of this participant's recovery, written for the dashboard. No quotes, no codes — just prose.>",
  "codedQuotes": {
    "lifeAndRoutineChanges": [
      {
        "quoteVerbatim": "<verbatim participant string>",
        "codeIds": ["routine_collapse"],
        "rationale": "<≤280 chars, optional>"
      }
    ],
    "emotionalImpact": [],
    "recoveryChallengesAndPainPoints": [],
    "needsOverTime": [],
    "technologyForRecovery": [],
    "aiAttitudesAndBeliefs": [],
    "mvpFeedback": [],
    "crossCutting": []
  },
  "mvpAdversarialAudit": {
    "endorsementsAttempted": true,
    "hesitationsAttempted": true,
    "notes": "<one short paragraph reflecting the result of the adversarial pass>"
  },
  "uncodedObservations": [
    {
      "category": "<CategoryKey>",
      "quoteVerbatim": "<verbatim string>",
      "note": "<why this didn't fit any existing code; ≤280 chars>"
    }
  ]
}
```

`uncodedObservations` is optional and may be empty. It is the safety valve: when you observe something real that doesn't fit the codebook, log it here. The research team uses these to evolve the codebook between extraction batches. **Do not use it as a place to dump codes you weren't sure about** — those just get omitted.

---

End of SKILL — v1.2.0.
