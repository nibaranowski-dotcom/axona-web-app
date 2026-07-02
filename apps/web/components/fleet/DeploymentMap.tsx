import type { FleetRobot } from "@/lib/fleet";

// Deployment map (Fleet.dc.html) — the Fleet signature artifact: a schematic
// dot-grid panel with one marker per site, positioned by projecting the site's
// lat/lng into the panel, colored by its worst-status unit (SN-2196's Site-3 /
// Osaka reads lime = attention). Critical = ink, attention = lime, else green.
//
// Note: `city` isn't a Robot field — this is a small display map for the three
// known sites (see FLEET.2 notes).
const CITY: Record<string, string> = {
  "Site-1": "Detroit",
  "Site-2": "Rotterdam",
  "Site-3": "Osaka",
};

const WORST_RANK: Record<string, number> = {
  FAULT: 3,
  WATCH: 2,
  OFFLINE: 1,
  ACTIVE: 0,
};
const MARKER: Record<string, { dot: string; glow: string }> = {
  FAULT: { dot: "bg-ink-strong", glow: "rgba(10, 10, 10, 0.15)" },
  WATCH: { dot: "bg-accent", glow: "rgba(198, 242, 79, 0.32)" },
  OFFLINE: { dot: "bg-line-strong", glow: "rgba(0, 0, 0, 0.06)" },
  ACTIVE: { dot: "bg-success", glow: "rgba(31, 158, 111, 0.18)" },
};

interface SiteMarker {
  site: string;
  count: number;
  worst: string;
  x: number;
  y: number;
}

function buildSites(robots: FleetRobot[]): SiteMarker[] {
  const geo = robots.filter((r) => r.lat != null && r.lng != null);
  const bySite = new Map<
    string,
    { count: number; worst: string; lat: number; lng: number }
  >();
  for (const r of geo) {
    const s = bySite.get(r.site) ?? {
      count: 0,
      worst: "ACTIVE",
      lat: r.lat!,
      lng: r.lng!,
    };
    s.count += 1;
    if ((WORST_RANK[r.status] ?? 0) > (WORST_RANK[s.worst] ?? 0))
      s.worst = r.status;
    bySite.set(r.site, s);
  }
  const entries = [...bySite.entries()];
  const lats = entries.map(([, s]) => s.lat);
  const lngs = entries.map(([, s]) => s.lng);
  const span = (v: number, min: number, max: number) =>
    max === min ? 50 : 10 + (80 * (v - min)) / (max - min);
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
  const [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)];
  return entries
    .map(([site, s]) => ({
      site,
      count: s.count,
      worst: s.worst,
      x: span(s.lng, minLng, maxLng),
      y: 100 - span(s.lat, minLat, maxLat), // north = up
    }))
    .sort((a, b) => a.site.localeCompare(b.site));
}

export function DeploymentMap({ robots }: { robots: FleetRobot[] }) {
  const sites = buildSites(robots);
  return (
    <div className="rounded-card border border-line bg-paper p-5">
      <div className="mb-[14px] flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">Deployment map</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          {sites.length} sites
        </span>
      </div>
      <div
        role="img"
        aria-label={`Deployment map — ${sites
          .map((s) => `${s.site} ${CITY[s.site] ?? ""} ${s.count} units`.trim())
          .join(", ")}`}
        className="bg-dotted-grid relative h-[236px] rounded-[10px] bg-panel"
      >
        {sites.map((s) => {
          const m = MARKER[s.worst] ?? MARKER.ACTIVE!;
          return (
            <span
              key={s.site}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
            >
              <span
                aria-hidden
                className={`block h-[13px] w-[13px] rounded-pill ${m.dot}`}
                style={{ boxShadow: `0 0 0 5px ${m.glow}` }}
              />
              <span className="absolute left-[14px] top-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[9.5px] text-ink-muted">
                {s.site} · {CITY[s.site] ?? ""} · {s.count}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
