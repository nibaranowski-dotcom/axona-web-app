import { createHash } from "node:crypto";
import { prisma, type LeadStatus } from "@axona/db";

// LEAD.1 — the Lead read/write model. AXONA-INTERNAL: every function here uses the
// BARE `prisma` client (never `dbForOrg`) because Lead has no orgId and must never be
// part of tenant scoping. The public endpoint only ever calls `createLead`; the
// in-app Leads view (RBAC-gated) calls `listLeads` / `updateLeadStatus`.

/** Field length caps — enforced by the zod schema at the endpoint; repeated here as
 *  the storage contract (defense in depth). */
export const LEAD_LIMITS = {
  name: 120,
  workEmail: 200,
  company: 160,
  role: 80,
  fleetSize: 40,
  useCase: 80,
  message: 4000,
  source: 60,
} as const;

/** Window within which a repeat (same email+company) UPDATES rather than duplicates. */
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface CreateLeadInput {
  name: string;
  workEmail: string;
  company: string;
  role?: string | null;
  fleetSize?: string | null;
  useCase?: string | null;
  message?: string | null;
  consent?: boolean;
  source: string;
  /** Raw IP — hashed here, NEVER stored raw. */
  ip?: string | null;
}

/** SHA-256 of the IP (+ a fixed app salt) — abuse forensics only, never the raw IP. */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`axona-lead:${ip}`).digest("hex");
}

export interface CreateLeadResult {
  id: string;
  deduped: boolean;
}

/**
 * Create (or, within the dedupe window, update) a Lead. Returns the id + whether it
 * was a dedupe-update. The caller returns an IDENTICAL generic response either way
 * (never leak whether an email is already known). Org-free — Axona-internal.
 */
export async function createLead(
  input: CreateLeadInput,
): Promise<CreateLeadResult> {
  const ipHash = hashIp(input.ip);
  const data = {
    name: input.name,
    workEmail: input.workEmail,
    company: input.company,
    role: input.role ?? null,
    fleetSize: input.fleetSize ?? null,
    useCase: input.useCase ?? null,
    message: input.message ?? null,
    consent: input.consent ?? false,
    source: input.source,
    ipHash,
  };

  // Dedupe: a recent lead with the same email+company → update it (keeps one row,
  // refreshes the fields + updatedAt) instead of creating a duplicate.
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
  const existing = await prisma.lead.findFirst({
    where: {
      workEmail: input.workEmail,
      company: input.company,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (existing) {
    await prisma.lead.update({ where: { id: existing.id }, data });
    return { id: existing.id, deduped: true };
  }

  const created = await prisma.lead.create({
    data: { ...data, status: "NEW" },
    select: { id: true },
  });
  return { id: created.id, deduped: false };
}

export interface LeadRow {
  id: string;
  createdAt: Date;
  name: string;
  workEmail: string;
  company: string;
  role: string | null;
  fleetSize: string | null;
  useCase: string | null;
  message: string | null;
  consent: boolean;
  source: string;
  status: LeadStatus;
  owner: string | null;
  note: string | null;
}

export interface LeadsSummary {
  total: number;
  byStatus: Record<LeadStatus, number>;
}

export interface LeadsResult {
  rows: LeadRow[];
  summary: LeadsSummary;
}

const EMPTY_STATUS: Record<LeadStatus, number> = {
  NEW: 0,
  CONTACTED: 0,
  QUALIFIED: 0,
  CLOSED: 0,
};

/** All leads, newest first, + counts by status. Internal — no org scoping. */
export async function listLeads(): Promise<LeadsResult> {
  const rows = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      name: true,
      workEmail: true,
      company: true,
      role: true,
      fleetSize: true,
      useCase: true,
      message: true,
      consent: true,
      source: true,
      status: true,
      owner: true,
      note: true,
    },
  });
  const byStatus = { ...EMPTY_STATUS };
  for (const r of rows) byStatus[r.status]++;
  return { rows, summary: { total: rows.length, byStatus } };
}

export const LEAD_STATUSES: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "CLOSED",
];

/** Advance/set a lead's triage status. Internal — caller must be RBAC-gated. */
export async function updateLeadStatus(
  id: string,
  status: LeadStatus,
): Promise<void> {
  await prisma.lead.update({ where: { id }, data: { status } });
}
