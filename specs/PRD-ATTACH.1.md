# PRD — ATTACH.1 · Universal attachments + versioning (on FILE.1)

**Story:** ATTACH.1 — a **horizontal** "Attachments" panel on every entity detail view: attach files to **any**
record (not just projects), with **versioning** (re-upload supersedes; old versions retained). It completes the
hub trio on every detail view — **Connected objects (LINK.1) · History (HIST.1) · Attachments** — and it's
moat-aligned: an attachment flows through the **FILE.2 extraction pipeline**, so it feeds search + MTX.1 + memory
(the loop). Generalizes FILE.1; does **not** add a second file model or blob store.
**Spec ref:** `specs/horizontal-prd-candidates.md` (Tier 1). **Pri/size:** P1 · M. **Track:** platform-horizontal
(rides the FILE.1/FILE.2 spine). **Depth:** Full CPRD (has an additive schema change + upload flow). **Deps:**
FILE.1 `File` model + `putObject`/`presignedGetUrl` (`packages/db/src/storage.ts`), FILE.2 extraction pipeline
(`extractText` + the extract queue), RBAC (upload/delete), LINK.1/HIST.1 (sibling rails).

## What exists (the starting point)

`File` = `projectId (required) · name · ext · sizeBytes · blobKey · type · linkedTo (String? free-text) · text
(extracted) · extracted (Json, MTX.1)`. Blob keys are **org-prefixed** (`orgId/projectId/uuid.ext`). Files today
attach only to **projects**; `linkedTo` is a display hint, not a real reference; there's no versioning.

## Non-negotiable — BUILD ON FILE.1 (do not reinvent)

Same discipline as IO.1 / LINK.1 / HIST.1:
1. **Extend the `File` model, don't fork it.** Add **nullable** structured attach fields `targetType` +
   `targetId` (the entity a file is attached to), make **`projectId` nullable** (a file is attached to a project
   *or* an entity *or* the org), and add versioning (`version Int` + a `supersedesId`/group key self-relation) —
   all **additive nullable** via `migrate dev` (never `db push`). Existing project files keep working unchanged.
2. **Reuse the storage seam** — `putObject` (upload) + `presignedGetUrl` (download). **No new blob store / no
   `@aws-sdk` client** outside `storage.ts`.
3. **Reuse the FILE.2 extraction pipeline** — an uploaded attachment enqueues the same extract job so its `text`
   is extracted (search body + MTX.1 + memory capture). No new extraction path.
A reviewer must see ATTACH.1 = the `File` model extended + `putObject`/`presignedGetUrl` + FILE.2 extraction — not
a new file subsystem.

## Scope

- **Attach to any entity:** an attachment carries `{ targetType, targetId }` (or `projectId`, or org-level).
- **Versioning:** re-uploading to the same attach point creates a **new version**; prior versions are **retained**
  (soft-superseded), not overwritten. The panel shows the current version with a "N versions" affordance.
- **A shared `<Attachments>` panel:** upload (→ `putObject`, org-prefixed key) · list (name · type · size ·
  version · who/when) · download (→ `presignedGetUrl`) · version history · delete (RBAC-gated, soft). Extracted
  text availability surfaced (feeds search/MTX). Empty state.
- **Surface on the same detail views as LINK.1/HIST.1** (the 3rd secondary rail): Unit · NCR/RCA · Change order
  (ECO) · Configuration · Test run · PO/Procurement · Part/Inventory. Match the existing layout; don't disturb the
  signature artifact or the sibling rails.
- v2 tokens · no emoji · Lucide thin icons · a11y (labeled upload + list, keyboard).

## Guardrails

Org-scoped (blob keys stay org-prefixed) · **RBAC on upload/delete** (writes) · **reuse `putObject`/
`presignedGetUrl` + FILE.2 extraction** (no new blob store/model/extractor) · **additive nullable migration only**
(`migrate dev`; existing `File.projectId` path + project-files behavior unchanged) · versioning **retains** old
versions (never hard-overwrites) · one shared panel · pairs with LINK.1/HIST.1 rails · attachments feed the
existing extraction→search/MTX/memory loop (don't bypass it).

## Verify + gate (`src/scripts/verify-attach-1.ts`)

1. **Build-on-top proof:** ATTACH.1 uses `putObject`/`presignedGetUrl` + the FILE.2 extract path (assert no new
   blob client / `@aws-sdk` outside `storage.ts`, no second file model, no new extraction path); `File` is
   extended (nullable additive), **not** forked; existing `verify:file-1/2` stay green (project-files unchanged).
2. **Attach to an entity:** a file attached with `{ targetType, targetId }` lists on that entity's panel;
   org-scoped (a 2nd org → 0); download resolves a presigned URL.
3. **Versioning:** re-upload → version 2 current, version 1 **retained** and retrievable; the panel shows the
   version chain.
4. **Extraction reuse:** an uploaded attachment enqueues the FILE.2 extract job (its `text` gets extracted) — same
   pipeline, no bypass.
5. **RBAC:** upload/delete gated; a viewer can't upload/delete.
6. a11y 0 on the touched routes; migrate status clean (additive nullable only); existing FILE/PLM verifies green.
CI gate: install --frozen-lockfile · lint · turbo typecheck · verify:all · pnpm eval (offline) · pnpm build ·
migrate clean; commit + push; Actions green.

## Review gate

Stop after ATTACH.1; show: the `<Attachments>` panel on Unit/NCR/ECO (as the 3rd rail beside Connected objects +
History) — upload, a 2-version file with version-1 retained, download via presigned URL; org-scoped isolation;
extraction firing on upload (FILE.2); and confirmation it reuses `putObject`/`presignedGetUrl`/FILE.2 with the
`File` model extended (not a new store), `verify:file-*` green, migrate additive-only.
