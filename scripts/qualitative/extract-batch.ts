import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { Manifest } from "../../src/types/qualitative";
import { parseTranscriptFromFile } from "./parse-transcript";
import { loadCodebook } from "./validate-extraction-schema";

const MANIFEST = path.resolve("data/qualitative/manifest.json");
const SKILL_MD = path.resolve("data/qualitative/SKILL.md");
const CODEBOOK = path.resolve("data/qualitative/CODEBOOK.json");
const DRY_RUN_OUT = path.resolve("data/qualitative/extractions/_dry-run.json");

type DryRunEntry = {
  participantId: string;
  transcriptPath: string;
  transcriptSha256: string;
  flatTextLength: number;
  participantCueCount: number;
  skillVersion: string;
  codebookVersion: string;
  codebookEntryCount: number;
  promptCharacterEstimate: number;
};

export function extractDryRunMain(): void {
  if (!fs.existsSync(MANIFEST)) {
    console.error("[extract] manifest.json not found. Run qualitative:build-manifest first.");
    process.exit(1);
  }
  if (!fs.existsSync(SKILL_MD)) {
    console.error(`[extract] SKILL.md not found at ${SKILL_MD}.`);
    process.exit(1);
  }
  if (!fs.existsSync(CODEBOOK)) {
    console.error(`[extract] CODEBOOK.json not found at ${CODEBOOK}.`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as Manifest;
  const skill = fs.readFileSync(SKILL_MD, "utf8");
  const codebook = loadCodebook(CODEBOOK);

  const skillVersionMatch = skill.match(/v\d+\.\d+\.\d+/);
  const skillVersion = skillVersionMatch ? skillVersionMatch[0] : "v0.0.0-unversioned";

  const dryRun: DryRunEntry[] = [];
  for (const entry of manifest.entries) {
    const { parsed } = parseTranscriptFromFile(path.resolve(entry.transcriptPath));
    const promptChars = skill.length + JSON.stringify(codebook).length + parsed.flatText.length;
    dryRun.push({
      participantId: entry.id,
      transcriptPath: entry.transcriptPath,
      transcriptSha256: entry.transcriptSha256,
      flatTextLength: parsed.flatText.length,
      participantCueCount: parsed.participantCueCount,
      skillVersion,
      codebookVersion: codebook.version,
      codebookEntryCount: codebook.entries.length,
      promptCharacterEstimate: promptChars,
    });
  }

  fs.mkdirSync(path.dirname(DRY_RUN_OUT), { recursive: true });
  fs.writeFileSync(
    DRY_RUN_OUT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        skillVersion,
        codebookVersion: codebook.version,
        entries: dryRun,
      },
      null,
      2,
    ) + "\n",
  );

  console.log(
    `[extract] Dry run for ${dryRun.length} transcripts. SKILL ${skillVersion}, codebook ${codebook.version}.`,
  );
  console.log(`[extract] Codebook has ${codebook.entries.length} codes across 8 categories.`);
  console.log(`[extract] Wrote dry-run summary to ${path.relative(process.cwd(), DRY_RUN_OUT)}`);
  console.log("[extract] Per-transcript prompt size estimates (characters):");
  for (const e of dryRun) {
    console.log(
      `  ${e.participantId}  flat=${e.flatTextLength.toString().padStart(6)}  total≈${e.promptCharacterEstimate}`,
    );
  }
  console.log("[extract] No LLM was called. Wire that up in Prompt 3.");
}

const thisFile = path.resolve(fileURLToPath(import.meta.url));
const entryArg = process.argv[1];
if (entryArg && path.resolve(entryArg) === thisFile) {
  extractDryRunMain();
}
