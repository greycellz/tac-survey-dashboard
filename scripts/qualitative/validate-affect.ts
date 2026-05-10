import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { AffectFile, ValidatedExtraction } from "../../src/types/qualitative";
import { QUALITATIVE_CATEGORY_KEYS } from "../../src/lib/qualitative/category-keys";
import { loadAffectVocabulary, validateAffectFile } from "./validate-affect-schema";

const VOCAB_PATH = path.resolve("data/qualitative/AFFECT_VOCABULARY.json");
const AFFECT_DIR = path.resolve("data/qualitative/affect");
const EXTRACTIONS_DIR = path.resolve("data/qualitative/extractions");

function loadValidated(participantId: string): ValidatedExtraction | null {
  const p = path.join(EXTRACTIONS_DIR, `${participantId}.validated.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as ValidatedExtraction;
}

function expectedQuoteIds(ext: ValidatedExtraction): Set<string> {
  const ids = new Set<string>();
  const cueCounter = new Map<number, number>();
  for (const cat of QUALITATIVE_CATEGORY_KEYS) {
    for (const q of ext.codedQuotes[cat]) {
      const cue = q.citation.cueNumber;
      const idx = cueCounter.get(cue) ?? 0;
      cueCounter.set(cue, idx + 1);
      ids.add(`${ext.participantId}:cue${cue}:${idx}`);
    }
  }
  for (const obs of ext.uncodedObservationsValidated ?? []) {
    const cue = obs.citation.cueNumber;
    const idx = cueCounter.get(cue) ?? 0;
    cueCounter.set(cue, idx + 1);
    ids.add(`${ext.participantId}:cue${cue}:${idx}`);
  }
  return ids;
}

export function runAffectValidation() {
  const vocab = loadAffectVocabulary(VOCAB_PATH);
  if (!fs.existsSync(AFFECT_DIR)) {
    console.error(`[affect] Affect dir not found: ${AFFECT_DIR}`);
    process.exit(1);
  }
  const files = fs.readdirSync(AFFECT_DIR).filter((f) => /^INT\d+\.affect\.json$/.test(f));
  let totalAnnotations = 0;
  let totalErrors = 0;
  let coverageMisses = 0;

  for (const file of files.sort()) {
    const filePath = path.join(AFFECT_DIR, file);
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as AffectFile;
    const errors = validateAffectFile(raw, vocab);
    if (errors.length > 0) {
      console.error(`[affect] ${file}: ${errors.length} schema error(s)`);
      for (const e of errors.slice(0, 5)) console.error(`  ${e.path}: ${e.message}`);
      totalErrors += errors.length;
      continue;
    }
    const ext = loadValidated(raw.participantId);
    if (!ext) {
      console.warn(`[affect] ${raw.participantId}: no validated extraction found`);
      continue;
    }
    const expected = expectedQuoteIds(ext);
    const got = new Set(raw.annotations.map((a) => a.quoteId));
    const missing = Array.from(expected).filter((id) => !got.has(id));
    const extra = Array.from(got).filter((id) => !expected.has(id));
    if (missing.length > 0 || extra.length > 0) {
      console.warn(
        `[affect] ${raw.participantId}: coverage mismatch — missing ${missing.length}, extra ${extra.length}`,
      );
      coverageMisses++;
    }
    totalAnnotations += raw.annotations.length;
    console.log(`  ${raw.participantId}  annotations=${raw.annotations.length}  expected=${expected.size}`);
  }
  console.log(
    `[affect] Validated ${files.length} file(s), ${totalAnnotations} annotation(s), ${totalErrors} error(s), ${coverageMisses} coverage mismatch(es).`,
  );
  if (totalErrors > 0) process.exit(1);
}

const thisFile = path.resolve(fileURLToPath(import.meta.url));
const entryArg = process.argv[1];
if (entryArg && path.resolve(entryArg) === thisFile) {
  runAffectValidation();
}
