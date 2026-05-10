import * as fs from "node:fs";
import * as path from "node:path";
import type {
  QualitativeBundle,
  ParticipantId,
  ValidatedExtraction,
  Manifest,
  Codebook,
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

  return { manifest, codebook, extractions, transcripts };
}
