import { getCalibrationModel, calibratedConfidence } from "@axona/db";

/**
 * DEMO.6 — the shared shape for "an agent proposed something, with a confidence you
 * can check".
 *
 * Beats #4 (RCA) and #6 (config) each grew their own copy of this: gather evidence →
 * weight each signal → sum to a raw score → correct it through the org's fitted CONF.1
 * map. Four more beats would have meant four more copies of the one rule that actually
 * matters — that the number is DERIVED and never a literal. It lives here now, so a
 * beat declares its evidence and gets the arithmetic for free, and there is a single
 * place to audit whether any screen is inventing a confidence.
 *
 * `#4`/`#6` keep their own local types (their shapes carry extra per-beat fields);
 * this is the seam every NEW surface uses.
 */
export interface AgentSignal {
  /** stable id for the signal (assertable in a verify). */
  key: string;
  /** the fact, in the words the screen shows — a real count, not a category. */
  detail: string;
  /** how much this KIND of evidence counts. The fact had to be found to contribute. */
  weight: number;
}

export interface AgentProposal {
  /** what the agent found. */
  text: string;
  /** what it proposes the human do — what the Confirm control means. */
  action: string;
  /** sum of `signals`, clamped to [0,1]. Never a literal. */
  rawConfidence: number;
  /** the CONF.1-corrected value — what the screen renders. */
  calibrated: number;
  calibratedState: "calibrated" | "uncalibrated";
  signals: AgentSignal[];
  /** the model that emitted it — carried onto the AUDIT.1 entry. */
  model: string;
}

/** The model behind the demo surfaces; recorded on every AUDIT.1 entry. */
export const DEMO_AGENT_MODEL = "claude-sonnet-4-6";

/**
 * Build a proposal from evidence. Returns null when there is NO evidence — a screen
 * with nothing to say must say nothing rather than emit a zero-confidence proposal,
 * which reads as "the agent ran and found nothing" when it actually means "the agent
 * had nothing to run on".
 */
export async function buildAgentProposal(
  orgId: string,
  input: {
    text: string;
    action: string;
    signals: AgentSignal[];
    model?: string;
  },
): Promise<AgentProposal | null> {
  if (input.signals.length === 0) return null;
  const raw = Math.max(
    0,
    Math.min(
      1,
      input.signals.reduce((s, x) => s + x.weight, 0),
    ),
  );
  const cal = calibratedConfidence(raw, await getCalibrationModel(orgId));
  return {
    text: input.text,
    action: input.action,
    rawConfidence: Math.round(raw * 100) / 100,
    calibrated: Math.round(cal.value * 100) / 100,
    calibratedState: cal.state,
    signals: input.signals,
    model: input.model ?? DEMO_AGENT_MODEL,
  };
}
