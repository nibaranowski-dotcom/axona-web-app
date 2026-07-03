// Shared technician-cert parsing (used by FIELD.1 field-service + PPL.1 people).
// A cert is "expiring" when its state is EXPIRING or its expiry falls within the
// window — this is the signal that gates field dispatch (M. Osei's HV/battery).

export const CERT_WINDOW_MS = 30 * 24 * 3600 * 1000; // cert-expiring window (30d)

export interface TechCert {
  key: string;
  state: string;
  expiresAt: Date | null;
  expiring: boolean; // state EXPIRING or within the cert window
}

/** Parse a Technician.certs JSON blob ({certKey: {state, expiresAt}}) → TechCert[]. */
export function parseCerts(certs: unknown): TechCert[] {
  if (!certs || typeof certs !== "object") return [];
  const now = Date.now();
  return Object.entries(
    certs as Record<string, { state?: string; expiresAt?: string }>,
  ).map(([key, v]) => {
    const expiresAt = v?.expiresAt ? new Date(v.expiresAt) : null;
    const expiring =
      (v?.state ?? "").toUpperCase() === "EXPIRING" ||
      (!!expiresAt && expiresAt.getTime() - now <= CERT_WINDOW_MS);
    return { key, state: v?.state ?? "UNKNOWN", expiresAt, expiring };
  });
}
