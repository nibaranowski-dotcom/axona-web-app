import type { PeopleTech } from "@/lib/people";

// People display helpers (PPL.2). Cert-cell tones — certified = green (valid/live),
// expiring < 30d = ink (critical), in-training = lime, not-held = skeleton. No
// invented reds; brand palette only.

// PROSPECT.2a — only the GENERIC, cross-tenant cert labels are curated here; any
// product-specific cert key (e.g. a Shoebox Picker service cert) is humanized from
// its key, so no tenant's product name is hardcoded into the label registry.
export const CERT_META: Record<string, { label: string; order: number }> = {
  hvBattery: { label: "HV / batt", order: 2 },
  safetyLoto: { label: "Safety LOTO", order: 3 },
  commissioning: { label: "Commission", order: 4 },
};

/** Humanize a cert key: "shoebox_picker" → "Shoebox picker"; "hx2Service" → "Hx2 service". */
function humanizeCert(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

export function certLabel(key: string): string {
  return CERT_META[key]?.label ?? humanizeCert(key);
}

export function sortCertKeys(keys: string[]): string[] {
  return [...keys].sort(
    (a, b) =>
      (CERT_META[a]?.order ?? 99) - (CERT_META[b]?.order ?? 99) ||
      a.localeCompare(b),
  );
}

export type CertCellState = "certified" | "expiring" | "training" | "none";

export function certCell(
  tech: PeopleTech,
  key: string,
): { state: CertCellState; label: string } {
  const c = tech.certs.find((x) => x.key === key);
  if (!c) return { state: "none", label: "—" };
  const s = c.state.toUpperCase();
  if (s === "EXPIRING" || c.expiring) {
    const days = c.expiresAt
      ? Math.max(
          0,
          Math.ceil(
            (new Date(c.expiresAt).getTime() - Date.now()) / 86_400_000,
          ),
        )
      : null;
    return { state: "expiring", label: days != null ? `${days}d` : "Exp" };
  }
  if (s === "TRAINING" || s === "IN_TRAINING")
    return { state: "training", label: "Trng" };
  return { state: "certified", label: "OK" };
}

export const CELL_DOT: Record<CertCellState, string> = {
  certified: "bg-success",
  expiring: "bg-ink-strong",
  training: "bg-accent",
  none: "bg-skeleton",
};

/** Cert compliance = held certs that are current (VALID, not expiring) / all held. */
export function certCompliance(technicians: PeopleTech[]): number {
  let held = 0;
  let current = 0;
  for (const t of technicians) {
    for (const c of t.certs) {
      held++;
      if (!c.expiring && c.state.toUpperCase() === "VALID") current++;
    }
  }
  return held ? Math.round((current / held) * 100) : 0;
}
