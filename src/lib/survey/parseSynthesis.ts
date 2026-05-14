/**
 * Parse SURVEY_OPEN_RESPONSES_SYNTHESIS.md into structured data for the dashboard.
 */

export interface SynthesisQuote {
  submissionId: string;
  text: string;
  ageNote?: string;
}

export interface QuestionSynthesis {
  questionNumber: number;
  questionText: string;
  coverageLine: string;
  synthesisHtml: string;
  quotes: SynthesisQuote[];
}

export interface CrossQuestionSynthesis {
  bodyHtml: string;
  closingQuote: SynthesisQuote;
}

export interface FullSynthesis {
  questions: QuestionSynthesis[];
  crossQuestion: CrossQuestionSynthesis;
  generatedDate: string;
  sourceNote: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Bold **segments** and preserve line structure for simple lists */
function inlineMdToHtml(s: string): string {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts
    .map((p) => {
      const m = p.match(/^\*\*([^*]+)\*\*$/);
      if (m) return `<strong>${escapeHtml(m[1])}</strong>`;
      return escapeHtml(p);
    })
    .join("");
}

/**
 * Prose + markdown lists (leading `- ` or `N. `) → HTML.
 * Consecutive lines starting with `- ` become one <ul>; consecutive `1.` … lines become one <ol>.
 * Paragraphs are runs of other lines, joined on blank-line boundaries.
 */
export function mdProseToHtml(md: string): string {
  const trimmed = md.trim();
  if (!trimmed) return "";

  const lines = trimmed.split("\n");
  const out: string[] = [];
  let i = 0;

  const flushParagraph = (buf: string[]) => {
    const text = buf.join(" ").replace(/\s+/g, " ").trim();
    if (text) out.push(`<p class="mb-3 leading-relaxed">${inlineMdToHtml(text)}</p>`);
  };

  let paraBuf: string[] = [];

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();
    const t = line.trim();

    if (t === "") {
      flushParagraph(paraBuf);
      paraBuf = [];
      i++;
      continue;
    }

    if (/^-\s+/.test(t)) {
      flushParagraph(paraBuf);
      paraBuf = [];
      const listLines: string[] = [];
      while (i < lines.length) {
        const L = lines[i].trimEnd().trim();
        if (/^-\s+/.test(L)) {
          listLines.push(L.replace(/^-\s+/, ""));
          i++;
        } else break;
      }
      out.push(
        '<ul class="list-disc pl-5 space-y-1 my-2">' +
          listLines.map((l) => `<li>${inlineMdToHtml(l)}</li>`).join("") +
          "</ul>",
      );
      continue;
    }

    if (/^\d+\.\s+/.test(t)) {
      flushParagraph(paraBuf);
      paraBuf = [];
      const listLines: string[] = [];
      while (i < lines.length) {
        const L = lines[i].trimEnd().trim();
        if (/^\d+\.\s+/.test(L)) {
          listLines.push(L.replace(/^\d+\.\s+/, ""));
          i++;
        } else break;
      }
      out.push(
        '<ol class="list-decimal pl-5 space-y-1 my-2">' +
          listLines.map((l) => `<li>${inlineMdToHtml(l)}</li>`).join("") +
          "</ol>",
      );
      continue;
    }

    paraBuf.push(t);
    i++;
  }

  flushParagraph(paraBuf);
  return out.join("");
}

const QUOTE_RE = /> "([\s\S]*?)"\s*—\s*\*\*\[#(\d+)(?:,\s*([^\]]+?))?\]\*\*/g;

function parseQuotablesSection(section: string): SynthesisQuote[] {
  const quotes: SynthesisQuote[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(QUOTE_RE.source, QUOTE_RE.flags);
  while ((m = re.exec(section)) !== null) {
    const text = m[1].trim().replace(/\s+/g, " ");
    const submissionId = m[2];
    const tail = m[3]?.trim();
    const ageNote = tail && /^age\s+/i.test(tail) ? tail : undefined;
    quotes.push({ text, submissionId, ...(ageNote ? { ageNote } : {}) });
  }
  return quotes;
}

function extractMeta(raw: string): { generatedDate: string; sourceNote: string } {
  const gen = raw.match(/\*\*Generated:\*\*\s*([^\n]+)/);
  const src = raw.match(/\*\*Source:\*\*\s*([^\n]+)/);
  return {
    generatedDate: gen?.[1]?.trim() ?? "",
    sourceNote: src?.[1]?.trim() ?? "",
  };
}

function parseCrossQuestion(block: string): CrossQuestionSynthesis {
  const withoutHeader = block.replace(/^## Cross-question synthesis[^\n]*\n+/m, "").trim();

  const closingIdx = withoutHeader.search(/^A line from Submission #\d+/m);
  let bodyMd = withoutHeader;
  let closingLine = "";

  if (closingIdx >= 0) {
    bodyMd = withoutHeader.slice(0, closingIdx).trim();
    closingLine =
      withoutHeader.slice(closingIdx).split(/\n---\s*\n## Notes/)[0]?.trim() ?? withoutHeader.slice(closingIdx).trim();
  }

  const subMatch = closingLine.match(/Submission #(\d+)[\s\S]*?:\s*\*"([^"]+)"\*/);
  const closingQuote: SynthesisQuote = subMatch
    ? { submissionId: subMatch[1], text: subMatch[2].trim() }
    : { submissionId: "", text: "" };

  return {
    bodyHtml: mdProseToHtml(bodyMd),
    closingQuote,
  };
}

function parseQuestionBlock(headerLine: string, body: string): QuestionSynthesis {
  const hm = headerLine.match(/^## Question (\d+) — (.+)$/);
  const questionNumber = hm ? parseInt(hm[1], 10) : 0;
  const questionText = hm?.[2]?.trim() ?? "";

  const cov = body.match(/\*\*Coverage:\*\*\s*([^\n]+)/);
  const coverageLine = cov?.[1]?.trim() ?? "";

  const synMatch = body.match(/### Synthesis\s*\n+([\s\S]*?)(?=\n### Quotable verbatims\b)/);
  const synthesisMd = synMatch?.[1]?.trim() ?? "";
  const synthesisHtml = mdProseToHtml(synthesisMd);

  const quotMatch = body.match(/### Quotable verbatims\s*\n+([\s\S]*?)(?=\n---|\n## |\s*$)/);
  const quotSection = quotMatch?.[1] ?? "";
  const quotes = parseQuotablesSection(quotSection);

  return {
    questionNumber,
    questionText,
    coverageLine,
    synthesisHtml,
    quotes,
  };
}

export function parseSynthesis(raw: string): FullSynthesis {
  const { generatedDate, sourceNote } = extractMeta(raw);

  const qHeaders: RegExpExecArray[] = [];
  {
    const re = /^## Question (\d+) — .+$/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) qHeaders.push(m);
  }
  const crossIdx = raw.search(/^## Cross-question synthesis/m);

  const questions: QuestionSynthesis[] = [];

  for (let i = 0; i < qHeaders.length; i++) {
    const m = qHeaders[i];
    const start = m.index ?? 0;
    const end =
      i + 1 < qHeaders.length
        ? (qHeaders[i + 1].index ?? raw.length)
        : crossIdx >= 0
          ? crossIdx
          : raw.length;
    const block = raw.slice(start, end);
    const firstNl = block.indexOf("\n");
    const headerLine = firstNl >= 0 ? block.slice(0, firstNl) : block;
    const body = firstNl >= 0 ? block.slice(firstNl + 1) : "";
    questions.push(parseQuestionBlock(headerLine, body));
  }

  let crossQuestion: CrossQuestionSynthesis = { bodyHtml: "", closingQuote: { submissionId: "", text: "" } };
  if (crossIdx >= 0) {
    const afterCross = raw.slice(crossIdx);
    const notesIdx = afterCross.search(/\n---\s*\n## Notes on this synthesis/);
    const crossBlock = notesIdx >= 0 ? afterCross.slice(0, notesIdx) : afterCross;
    crossQuestion = parseCrossQuestion(crossBlock);
  }

  questions.sort((a, b) => a.questionNumber - b.questionNumber);

  return {
    questions,
    crossQuestion,
    generatedDate,
    sourceNote,
  };
}
