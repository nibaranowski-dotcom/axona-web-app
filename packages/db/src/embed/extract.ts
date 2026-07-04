// FILE.2 — type-aware text extraction from a file's blob bytes. Text formats
// decode directly; pdf/docx via lazily-imported parsers (kept out of hot paths);
// unknown/binary → skip with a reason (empty text, still marked processed).
// Never throws on a single bad file — the caller catches; we return "".

const MAX_TEXT = 20_000; // bounded stored text (search body + MTX.1 Q&A)

function normalize(s: string): string {
  return s
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface ExtractResult {
  text: string;
  ok: boolean;
  reason?: string;
}

const TEXT_EXTS = new Set([
  "txt",
  "md",
  "json",
  "csv",
  "log",
  "yaml",
  "yml",
  "html",
  "xml",
]);

// Does the buffer look like real UTF-8 text (not a binary blob)? Used as a safe
// fallback when a pdf/docx parser fails on bytes that are actually plain text
// (e.g. the FILE.1 seed placeholders): no NUL bytes + mostly printable.
function looksLikeText(bytes: Buffer): boolean {
  const n = Math.min(bytes.length, 2048);
  if (n === 0) return false;
  let printable = 0;
  for (let i = 0; i < n; i++) {
    const c = bytes[i]!;
    if (c === 0) return false;
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c < 127) || c >= 160)
      printable++;
  }
  return printable / n > 0.85;
}

export async function extractText(
  bytes: Buffer,
  ext: string,
): Promise<ExtractResult> {
  const e = (ext || "").toLowerCase();
  try {
    if (TEXT_EXTS.has(e)) {
      return {
        text: normalize(bytes.toString("utf8")).slice(0, MAX_TEXT),
        ok: true,
      };
    }
    if (e === "pdf") {
      // Only invoke pdf-parse on a real PDF (%PDF magic) — text placeholders
      // (FILE.1 seed) go straight to the text fallback (no parser warnings).
      if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") {
        try {
          const pdfParse = (await import("pdf-parse")).default;
          const parsed = await pdfParse(bytes);
          return { text: normalize(parsed.text).slice(0, MAX_TEXT), ok: true };
        } catch (err) {
          return {
            text: "",
            ok: false,
            reason: `pdf: ${(err as Error).message}`,
          };
        }
      }
      if (looksLikeText(bytes))
        return {
          text: normalize(bytes.toString("utf8")).slice(0, MAX_TEXT),
          ok: true,
        };
      return { text: "", ok: false, reason: "pdf: not a PDF" };
    }
    if (e === "docx") {
      // A real .docx is a zip (PK magic); otherwise fall back to text.
      if (bytes.subarray(0, 2).toString("latin1") === "PK") {
        try {
          const mammoth = await import("mammoth");
          const { value } = await mammoth.extractRawText({ buffer: bytes });
          return { text: normalize(value).slice(0, MAX_TEXT), ok: true };
        } catch (err) {
          return {
            text: "",
            ok: false,
            reason: `docx: ${(err as Error).message}`,
          };
        }
      }
      if (looksLikeText(bytes))
        return {
          text: normalize(bytes.toString("utf8")).slice(0, MAX_TEXT),
          ok: true,
        };
      return { text: "", ok: false, reason: "docx: not a docx" };
    }
    // unknown ext → extract if it's plain text, else skip cleanly.
    if (looksLikeText(bytes))
      return {
        text: normalize(bytes.toString("utf8")).slice(0, MAX_TEXT),
        ok: true,
      };
    return { text: "", ok: false, reason: `unsupported ext "${e}"` };
  } catch (err) {
    return { text: "", ok: false, reason: (err as Error).message };
  }
}
