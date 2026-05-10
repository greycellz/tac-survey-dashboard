# Affect Annotation SKILL — v1.0.0

You are annotating one wildfire-survivor interview quote with a small structured affect description. Your output is a JSON object conforming to the schema below. Your emotion labels come from a fixed vocabulary in `AFFECT_VOCABULARY.json`. You will receive: (1) the quote text, (2) the codes already applied to it, (3) ~120 characters of context before and after.

This document has three parts:

1. **Rules** — what counts as evidence for an affect label.
2. **The twelve emotions** — definitions and disambiguation tests.
3. **Output schema** — exact JSON shape.

Read all three before producing output.

---

## 1. Rules

### 1.1 Read the quote, not the code

The codes applied to a quote describe its *content* (e.g., `insurance_adversarial`, `delayed_processing`). Do not infer affect from the code. A quote coded `insurance_adversarial` could carry anger, weariness, resignation, or even darkly amused detachment. Read the actual words.

### 1.2 Twelve emotions, no inventions

Every `primaryEmotion` and `secondaryEmotion` value must be one of the twelve emotion IDs in the vocabulary. If the quote feels affectively mixed, use `secondaryEmotion`. Never use both for the same emotion.

### 1.3 Intensity is independent of valence

Intensity (0–1) measures how strongly the emotion is expressed, regardless of whether the emotion is positive or negative. A quietly devastating sentence about loss can be high-intensity grief (0.85). A casual mention of hope can be low-intensity hope (0.25). Do not let your sense of "negative things deserve high intensity" bias the score.

Calibration anchors:
- 0.0–0.2 — affectively flat or descriptive, emotion is implicit but not foregrounded
- 0.2–0.5 — present and audible but not dominant
- 0.5–0.8 — clearly the dominant register of the utterance
- 0.8–1.0 — overwhelming, identity-claiming, or spilling over into how the sentence is constructed

### 1.4 Stance is the speaker's evaluative posture toward the *thing being discussed*

Stance is **separate from emotion**. It captures whether the speaker is for/against/neutral toward whatever the quote is about. Examples:

- "I had no idea what any of this meant" → primary: `weariness`, stance ≈ -0.5 (against the *process* being discussed)
- "ChatGPT helped me draft a really good letter" → primary: `relief` or `pride`, stance ≈ +0.7 (toward AI as a tool)
- "I'm just inventorying everything I ever owned" → primary: `grief` or `weariness`, stance ≈ -0.4 (toward the inventory task)
- "My therapist has been a lifeline" → primary: `gratitude`, stance ≈ +0.9 (toward therapy)
- A purely descriptive utterance with no evaluative posture → stance ≈ 0

### 1.5 Confidence

Use confidence to signal genuine uncertainty. A quote with clear, unambiguous emotion gets confidence 0.85–0.95. A quote where the speaker is masking or where the affect could plausibly be two different emotions gets 0.5–0.7. Do not over-claim.

### 1.6 Neutral is a valid answer

Some quotes are genuinely procedural ("I called the FEMA line and they put me on hold"). The correct annotation is `primaryEmotion: "neutral"`, intensity ≤ 0.2. Do not force an emotion onto a quote that doesn't carry one.

---

## 2. The twelve emotions (with disambiguation tests)

Use these tests when a quote could plausibly fit two emotions. Pick the one whose test is most sharply triggered.

| Emotion | Trigger test |
|---|---|
| **grief** | Is there a specific named loss being mourned? (Object, person, place, identity, routine.) |
| **fear** | Is the speaker oriented toward a *future* harm or recurrence? |
| **anger** | Is there energized opposition — toward an institution, person, or system? |
| **weariness** | Is the dominant register *exhaustion* — flat, depleted, time-accumulated? |
| **hope** | Is there forward-looking positive expectation, even if hedged? |
| **relief** | Has acute pressure just been removed or eased? |
| **numbness** | Is the affect *absent* rather than depleted? Dissociation, detachment, "going through motions"? |
| **resignation** | Has the speaker accepted something without endorsing it? "This is just how it is." |
| **defiance** | Is there active refusal — "I'm not going to let this defeat me"? |
| **gratitude** | Is there thankfulness directed *at* a person, institution, or circumstance? |
| **pride** | Is there self- or identity-directed positive evaluation? Often around competence under hardship. |
| **neutral** | Is the utterance genuinely descriptive/procedural, with no foregrounded affect? |

### Common ambiguities

- **weariness vs. resignation**: weariness is somatic ("I'm tired"); resignation is cognitive ("there's no point fighting it"). They co-occur; pick the dominant one for primary, the other for secondary.
- **anger vs. defiance**: anger is reactive; defiance is identity-claiming. "How dare they" → anger. "I refuse to let them win" → defiance.
- **grief vs. weariness**: grief is loss-oriented (specific absence); weariness is process-oriented (cumulative effort). "I'll never see those things again" → grief. "I'm just so tired of dealing with this" → weariness.
- **relief vs. gratitude**: relief is self-experienced (pressure released); gratitude is other-directed (toward someone or something). "I can finally sleep" → relief. "My neighbor saved me" → gratitude.

---

## 3. Output schema

Return exactly this JSON shape, no prose around it, no markdown fences:

```json
{
  "quoteId": "<INT###:cueN:K>",
  "participantId": "<INT###>",
  "primaryEmotion": "<one of the 12 emotion IDs>",
  "secondaryEmotion": "<emotion ID or null>",
  "intensity": 0.0,
  "stance": 0.0,
  "confidence": 0.0,
  "rationale": "<≤200 chars, optional>"
}
```

Numbers must be in their stated ranges:
- `intensity`: 0.0 ≤ x ≤ 1.0
- `stance`: -1.0 ≤ x ≤ 1.0
- `confidence`: 0.0 ≤ x ≤ 1.0

`secondaryEmotion` may be `null` (most common — many quotes have a single dominant emotion). It must not equal `primaryEmotion`.

---

End of SKILL — v1.0.0.
