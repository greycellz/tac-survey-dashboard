import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import type { Manifest, ManifestEntry, ParticipantId, Demographics } from "../../src/types/qualitative";
import { parseTranscriptFromFile, participantIdFromFilename } from "./parse-transcript";
import { loadResearcherNotes } from "./load-notes";

const TRANSCRIPTS_DIR = path.resolve("data/qualitative/transcripts");
const NOTES_CSV = path.resolve("data/qualitative/notes.csv");
const MANIFEST_OUT = path.resolve("data/qualitative/manifest.json");

function sha256OfFile(absPath: string): string {
  const buf = fs.readFileSync(absPath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function listTranscriptFiles(): string[] {
  if (!fs.existsSync(TRANSCRIPTS_DIR)) {
    throw new Error(
      `Transcripts directory not found: ${TRANSCRIPTS_DIR}\n` +
        `Create it and add INT###.md files before running this script.`,
    );
  }
  return fs
    .readdirSync(TRANSCRIPTS_DIR)
    .filter((f) => /^INT\d{3,}\.md$/.test(f))
    .sort();
}

export function buildManifest(): Manifest {
  const files = listTranscriptFiles();
  if (files.length === 0) {
    console.warn(`[manifest] No transcripts found in ${TRANSCRIPTS_DIR}`);
  }

  // Notes are optional — script must succeed even if notes.csv is missing.
  const notesById: Record<ParticipantId, { demographics: Demographics } | undefined> = {};
  if (fs.existsSync(NOTES_CSV)) {
    const notes = loadResearcherNotes(NOTES_CSV);
    for (const n of notes) notesById[n.id] = { demographics: n.demographics };
  } else {
    console.warn(`[manifest] notes.csv not found at ${NOTES_CSV} — demographics will be null.`);
  }

  const entries: ManifestEntry[] = [];
  for (const filename of files) {
    const absPath = path.join(TRANSCRIPTS_DIR, filename);
    const id = participantIdFromFilename(filename);
    const { parsed, warnings } = parseTranscriptFromFile(absPath);
    if (warnings.length > 0) {
      console.warn(`[manifest] ${id} parse warnings:\n  ${warnings.join("\n  ")}`);
    }
    entries.push({
      id,
      transcriptFilename: filename,
      transcriptPath: path.relative(process.cwd(), absPath),
      transcriptSha256: sha256OfFile(absPath),
      cueCount: parsed.cues.length,
      participantUtteranceCount: parsed.participantUtteranceCount,
      interviewerUtteranceCount: parsed.interviewerUtteranceCount,
      demographics: notesById[id]?.demographics ?? null,
      builtAt: new Date().toISOString(),
    });
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    entries,
  };
}

function main() {
  const manifest = buildManifest();
  fs.writeFileSync(MANIFEST_OUT, JSON.stringify(manifest, null, 2) + "\n");
  console.log(
    `[manifest] Wrote ${manifest.entries.length} entries to ${path.relative(
      process.cwd(),
      MANIFEST_OUT,
    )}`,
  );
  // One-line summary per entry for quick eyeballing
  for (const e of manifest.entries) {
    console.log(
      `  ${e.id}  cues=${e.cueCount}  participant=${e.participantUtteranceCount}  interviewer=${e.interviewerUtteranceCount}  demo=${e.demographics ? "yes" : "—"}`,
    );
  }
}

const thisFile = path.resolve(fileURLToPath(import.meta.url));
const entryArg = process.argv[1];
if (entryArg && path.resolve(entryArg) === thisFile) {
  main();
}
