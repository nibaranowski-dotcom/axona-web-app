# Manual checks

One entry per story. Each lists the automated verify command plus any human-eye
checks that can't be scripted.

---

## FND.1 — Scaffold pnpm + Turborepo monorepo

**Automated**
- `pnpm install` — resolves the workspace (apps/web, apps/worker, packages/db, packages/agents, packages/config).
- `pnpm verify:fnd-1` — asserts all scaffold paths exist.
- `pnpm typecheck` — `tsc --noEmit` clean across every workspace package.

**Manual**
- [ ] `pnpm-workspace.yaml` lists `apps/*` and `packages/*`; `pnpm install` links the three `@axona/*` workspace deps (no registry fetch for them).
- [ ] `turbo.json` defines `dev` / `build` / `lint` / `typecheck` / `verify` tasks.
- [ ] `apps/web` is Next.js 14 App Router (`app/layout.tsx` + `app/page.tsx`); `transpilePackages` includes the three internal packages.
- [ ] `apps/worker` is a standalone Node process stub (BullMQ deps present; queues land in WF.1).
- [ ] `packages/db/prisma/schema.prisma` has the Postgres datasource + pgvector extension; models land in FND.5–FND.10.
- [ ] Shared TS base lives in `packages/config/tsconfig/base.json` and every package extends it.
- [ ] No design tokens / Tailwind yet — that is FND.2 (next story).

---

## FND.2 — Design tokens → Tailwind + self-hosted fonts

**Automated**
- `pnpm verify:fnd-2` — tokens.css has all variables + only allowed hex; fonts wired; Tailwind maps tokens 1:1; no raw hex outside tokens.css.
- `pnpm typecheck` — `tsc --noEmit` clean across the workspace.

**Manual (run `pnpm --filter @axona/web dev`, open `/`)**
- [ ] Body text renders in **Archivo**; mono labels (uppercase chips, surface names) render in **JetBrains Mono** — both self-hosted (Network tab shows no requests to fonts.googleapis.com).
- [ ] StatusBadge tones read correctly: **Live** = green on tint, **Working** = lime signal, **Critical** = ink (NOT red), **Offline** = muted on panel.
- [ ] Primary button is lime with `--accent-ink` text; secondary is paper with a hairline border.
- [ ] Header shows the **dotted-grid** motif; surface swatches (paper/panel/panel-2/skeleton) step in warmth.
- [ ] No emoji; no shadows (hairlines only); nothing reads "all lime."

**Notes**
- Single source of truth: `packages/config/styles/tokens.css`. Tailwind palette is **replaced** (not extended) via `@axona/config` → only semantic utilities compile (`bg-red-500` won't).
- `next build` verified once: **compiled successfully, 4 static pages** — next/font fetched Archivo + JetBrains Mono at build time (self-hosted into the bundle). If a future build runs offline and font fetch is blocked, the dev-server check above still covers the font wiring.
