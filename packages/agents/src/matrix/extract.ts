import { z } from "zod";
import {
  AnthropicModelClient,
  type ModelClient,
  type ModelResponse,
} from "../runtime/model-client";

// MTX.1 — ask-across-files column extraction. One structured-output call over a
// file's text (FILE.2) answers a question, grounded in a quoted span. Each cell
// is an AGENT-DRAFTED PROPOSAL with a citation + calibrated confidence — the
// propose→approve→audit / cite-your-sources moat shape.
// /// CONF.1: `confidence` is calibrated later and gates autonomy.
// /// AUDIT.3: the answer's inputs·output·model·confidence·approver record.
// /// RBAC.4: a human approves an answer. /// MEM.1: answers + approvals feed the
// learning loop. Store the fields here; do not build those surfaces.

export const ColumnAnswer = z.object({
  value: z.string(), // "" / "n/a" when the file doesn't address the question
  citation: z.string(), // a short verbatim span from File.text grounding `value`
  confidence: z.number().min(0).max(1), // low = flag for human review (CONF.1)
});
export type ColumnAnswer = z.infer<typeof ColumnAnswer>;

// A model/parse failure yields this per file — never invents, never aborts the batch.
export const LOW_CONF_FALLBACK: ColumnAnswer = {
  value: "",
  citation: "",
  confidence: 0,
};
// Empty File.text (unprocessed / binary-skipped) → explicit low-confidence n/a.
export const EMPTY_TEXT_ANSWER: ColumnAnswer = {
  value: "n/a",
  citation: "",
  confidence: 0.1,
};

const SYSTEM =
  "You extract a single answer to a question from ONLY the provided document " +
  "text. Quote the exact span you used as `citation`. If the document does not " +
  'address the question, set value to "n/a" with low confidence. Never invent an ' +
  "answer or a source. Respond with strict JSON only: " +
  '{"value":string,"citation":string,"confidence":number between 0 and 1}.';

const INPUT_CAP = 8_000;
const MARKER = "\n\nDOCUMENT:\n";

function buildPrompt(fileText: string, question: string): string {
  return `QUESTION: ${question}${MARKER}${fileText.slice(0, INPUT_CAP)}`;
}

/**
 * Extract one column answer from a file's text via the ModelClient DI. Zod-
 * validated; a model/parse failure → LOW_CONF_FALLBACK (never throws). Deterministic
 * offline via FakeExtractionModel.
 */
export async function extractColumn(
  fileText: string,
  question: string,
  opts?: { model?: ModelClient },
): Promise<ColumnAnswer> {
  const model = opts?.model ?? getExtractionModel();
  try {
    const res = await model.createMessage({
      system: SYSTEM,
      messages: [{ role: "user", content: buildPrompt(fileText, question) }],
      tools: [],
    });
    const parsed = ColumnAnswer.safeParse(JSON.parse(res.text));
    return parsed.success ? parsed.data : LOW_CONF_FALLBACK;
  } catch {
    return LOW_CONF_FALLBACK;
  }
}

/** Real Anthropic when the key is set, else the deterministic offline extractor. */
export function getExtractionModel(): ModelClient {
  return process.env.ANTHROPIC_API_KEY
    ? new AnthropicModelClient()
    : new FakeExtractionModel();
}

// Deterministic offline extractor implementing ModelClient (like FakeModelClient):
// derives a grounded ColumnAnswer from the prompt (question + document). Never
// invents — an empty document returns n/a + low confidence. Stable for CI/verify.
export class FakeExtractionModel implements ModelClient {
  async createMessage(args: {
    system: string;
    messages: { role: string; content: unknown }[];
    tools: unknown[];
  }): Promise<ModelResponse> {
    const prompt = String(args.messages[0]?.content ?? "");
    const i = prompt.indexOf(MARKER);
    const question =
      i >= 0 ? prompt.slice(0, i).replace(/^QUESTION:\s*/, "") : "";
    const doc = i >= 0 ? prompt.slice(i + MARKER.length) : "";
    const answer = deriveAnswer(question.trim(), doc.trim());
    return {
      stopReason: "end_turn",
      text: JSON.stringify(answer),
      toolUses: [],
      model: "fake-extract",
    };
  }
}

function deriveAnswer(question: string, doc: string): ColumnAnswer {
  if (!doc) return { ...EMPTY_TEXT_ANSWER };
  // A grounded "answer": the first substantive line of the document (a real span
  // of File.text) — the citation quotes it, so nothing is invented.
  const span = (doc.split("\n").find((l) => l.trim().length > 8) ?? doc)
    .trim()
    .slice(0, 120);
  // Deterministic confidence: mostly-high with a ~18% low tail (flag for review).
  let h = 2166136261;
  const seed = `${question}|${doc.slice(0, 200)}`;
  for (let k = 0; k < seed.length; k++) {
    h ^= seed.charCodeAt(k);
    h = Math.imul(h, 16777619);
  }
  const r = (h >>> 0) / 0xffffffff;
  const confidence = r < 0.18 ? 0.25 + r : 0.6 + r * 0.38;
  return {
    value: span,
    citation: span.slice(0, 90),
    confidence: Math.round(confidence * 100) / 100,
  };
}
