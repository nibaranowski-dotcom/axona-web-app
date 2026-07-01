import type { QualityCert } from "@/lib/quality";

// Compliance certs (CE / UL / ISO) with audit-ready / expiring flags
// (Quality.dc.html). Status is carried by a dot (green = valid · lime = expiring)
// with ink text — AA-safe (green text on paper fails contrast).
export function CertList({ certs }: { certs: QualityCert[] }) {
  return (
    <div className="rounded-card border border-line bg-paper p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">Certifications</h2>
        <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">
          Audit-ready
        </span>
      </div>
      {certs.length === 0 ? (
        <p className="border-t border-line pt-3 text-sm text-ink-muted">
          No certifications on file.
        </p>
      ) : (
        certs.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-[10px] border-t border-line py-[11px]"
          >
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-ink">
                {c.name}
              </div>
              <div className="mt-px font-mono text-[10px] text-ink-muted">
                {c.scope} · valid to{" "}
                {new Date(c.validTo).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                })}
              </div>
            </div>
            <span className="inline-flex flex-none items-center gap-1.5 text-[11px] font-semibold text-ink">
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-pill ${
                  c.expiring ? "bg-accent" : "bg-success"
                }`}
              />
              {c.expiring ? "Expiring" : "Valid"}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
