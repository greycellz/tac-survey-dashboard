import type { SurveyRespondent } from "@/types/survey";
import Papa from "papaparse";

const EXPORT_ROOT_ID = "dashboard-export-root";

/** Resolve the DOM node used for PNG/PDF capture (main column content only). */
export function getDashboardExportRoot(): HTMLElement | null {
  return document.getElementById(EXPORT_ROOT_ID);
}

/**
 * Avoid a wide empty band on the right in PNG/PDF: use visible column width and,
 * when layout is narrower than the scroll box, the rightmost painted descendant edge.
 */
function captureWidthPx(element: HTMLElement): number {
  const rootRect = element.getBoundingClientRect();
  const cap = Math.ceil(rootRect.width) || element.clientWidth || element.offsetWidth;
  if (cap < 16) return Math.max(element.scrollWidth, 320);

  let maxRight = 0;
  const walk = (el: HTMLElement, isRoot: boolean) => {
    const st = window.getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden") return;
    const r = el.getBoundingClientRect();
    if (!isRoot && r.width >= 1 && r.height >= 1) {
      maxRight = Math.max(maxRight, r.right - rootRect.left);
    }
    for (let i = 0; i < el.children.length; i++) {
      const c = el.children[i];
      if (c instanceof HTMLElement) walk(c, false);
    }
  };
  walk(element, true);

  const pad = 16;
  const tight = Math.ceil(maxRight + pad);
  const loose = Math.min(element.scrollWidth, cap);
  const threshold = 48;
  if (tight >= 320 && tight < loose - threshold) {
    return tight;
  }
  return loose;
}

async function renderElementToCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
  const html2canvas = (await import("html2canvas")).default;
  await document.fonts.ready.catch(() => undefined);

  const width = captureWidthPx(element);
  const height = element.scrollHeight;

  return html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    scrollX: 0,
    scrollY: 0,
    backgroundColor: getComputedStyle(document.body).backgroundColor || "#F5F4F1",
  });
}

function triggerDownload(href: string, filename: string): void {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function exportElementAsPng(element: HTMLElement, filename: string): Promise<void> {
  if (element.scrollHeight < 4) {
    throw new Error("Nothing to export.");
  }
  const canvas = await renderElementToCanvas(element);
  triggerDownload(canvas.toDataURL("image/png"), filename);
}

/**
 * One canvas → A4 PDF, multiple pages if the scaled image is taller than one page.
 */
export async function exportElementAsPdf(element: HTMLElement, filename: string): Promise<void> {
  if (element.scrollHeight < 4) {
    throw new Error("Nothing to export.");
  }
  const [{ default: jsPDF }, canvas] = await Promise.all([
    import("jspdf"),
    renderElementToCanvas(element),
  ]);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const usablePageH = pageHeight - 2 * margin;

  const imgWidth = pageWidth - 2 * margin;
  /** Full raster height if scaled to imgWidth (mm). */
  const imgHeightMm = (canvas.height * imgWidth) / canvas.width;
  const mmPerPixelY = imgHeightMm / canvas.height;
  /** Max canvas rows that fit one page without vertical overflow (integer = no stitch gap/overlap). */
  const maxSlicePx = Math.max(1, Math.floor(usablePageH / mmPerPixelY));

  const sliceCanvas = document.createElement("canvas");
  const sliceCtx = sliceCanvas.getContext("2d");
  if (!sliceCtx) {
    throw new Error("Could not create canvas context for PDF export.");
  }

  let py = 0;
  let firstPage = true;
  while (py < canvas.height) {
    if (!firstPage) pdf.addPage();
    firstPage = false;

    const slicePx = Math.min(maxSlicePx, canvas.height - py);
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = slicePx;
    sliceCtx.drawImage(canvas, 0, py, canvas.width, slicePx, 0, 0, canvas.width, slicePx);

    const sliceHeightMm = (slicePx / canvas.height) * imgHeightMm;
    const sliceData = sliceCanvas.toDataURL("image/png");
    pdf.addImage(sliceData, "PNG", margin, margin, imgWidth, sliceHeightMm);
    py += slicePx;
  }

  pdf.save(filename);
}

function respondentToFlatRow(r: SurveyRespondent): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, val] of Object.entries(r)) {
    if (val === undefined || val === null) {
      out[key] = "";
    } else if (Array.isArray(val)) {
      out[key] = val.join("; ");
    } else {
      out[key] = val as string | number | boolean;
    }
  }
  return out;
}

export function exportFilteredRespondentsCsv(rows: SurveyRespondent[], filename: string): void {
  if (rows.length === 0) {
    throw new Error("No rows to export.");
  }
  const csv = Papa.unparse(rows.map(respondentToFlatRow));
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  URL.revokeObjectURL(url);
}
