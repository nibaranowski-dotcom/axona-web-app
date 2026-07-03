import type { PostureBucket } from "@/lib/security";
import { postureBar } from "./format";

// Fleet endpoint posture (Security.dc.html) — every deployed robot is a networked
// OT endpoint; this is the security posture spread over the fleet (hardened =
// green · needs-patch = lime · degraded = ink) derived over the FLEET.1 robots.
// Brand palette only.
//
// Note: the design's specific controls (signed-firmware / TLS-cert / OT-segmented
// attestation) need an endpoint-attestation model the schema lacks → this renders
// the derivable firmware-posture spread (see SEC.2 notes).
export function PosturePanel({ posture }: { posture: PostureBucket[] }) {
  const total = posture.reduce((n, b) => n + b.count, 0) || 1;
  return (
    <div className="rounded-card border border-line bg-paper p-5">
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">
          Fleet endpoint posture
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          {total} robots · OT endpoints
        </span>
      </div>
      <p className="mb-4 text-[12px] text-ink-muted">
        Every deployed robot is a networked OT endpoint. These are the controls
        that keep one from being commandeered.
      </p>
      {posture.map((b) => {
        const pct = Math.round((b.count / total) * 100);
        return (
          <div key={b.bucket} className="mb-[13px]">
            <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
              <span className="text-ink">{b.bucket}</span>
              <span className="font-mono text-[12px] font-semibold text-ink">
                {b.count}/{total}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-[5px] bg-skeleton">
              <span
                className={`block h-2 ${postureBar(b.bucket)}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
