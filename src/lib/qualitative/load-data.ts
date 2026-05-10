import * as fs from "node:fs";
import * as path from "node:path";
import type {
  QualitativeBundle,
  ParticipantId,
  ValidatedExtraction,
  Manifest,
  Codebook,
  AffectFile,
  AffectVocabulary,
} from "@/types/qualitative";
import { parseTranscriptFromFile } from "../../../scripts/qualitative/parse-transcript";

/**
 * Server-only data loader. Reads all qualitative JSON + parses transcripts.
 */
export function loadQualitativeData(): QualitativeBundle {
  const manifest = JSON.parse(
    fs.readFileSync(path.resolve("data/qualitative/manifest.json"), "utf8"),
  ) as Manifest;

  const codebook = JSON.parse(
    fs.readFileSync(path.resolve("data/qualitative/CODEBOOK.json"), "utf8"),
  ) as Codebook;

  const extractions: Partial<Record<ParticipantId, ValidatedExtraction>> = {};
  const transcripts: QualitativeBundle["transcripts"] = {} as QualitativeBundle["transcripts"];

  for (const entry of manifest.entries) {
    const validatedPath = path.resolve(`data/qualitative/extractions/${entry.id}.validated.json`);
    if (fs.existsSync(validatedPath)) {
      extractions[entry.id] = JSON.parse(fs.readFileSync(validatedPath, "utf8")) as ValidatedExtraction;
    }
    const { parsed } = parseTranscriptFromFile(path.resolve(entry.transcriptPath));
    transcripts[entry.id] = parsed;
  }

  const affectVocabulary = JSON.parse(
    fs.readFileSync(path.resolve("data/qualitative/AFFECT_VOCABULARY.json"), "utf8"),
  ) as AffectVocabulary;

  const affect: Partial<Record<ParticipantId, AffectFile>> = {};
  const affectDir = path.resolve("data/qualitative/affect");
  if (fs.existsSync(affectDir)) {
    for (const entry of manifest.entries) {
      const p = path.join(affectDir, `${entry.id}.affect.json`);
      if (fs.existsSync(p)) {
        affect[entry.id] = JSON.parse(fs.readFileSync(p, "utf8")) as AffectFile;
      }
    }
  }

  return { manifest, codebook, extractions, transcripts, affect, affectVocabulary };
}
