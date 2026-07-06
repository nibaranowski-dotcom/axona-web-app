import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@axona/db";

// AUTH.4 — org provisioning core (server-only; shared by the signup action + the
// verify script so there's ONE implementation). PUBLIC + unauthenticated: it mints
// a new tenant + its first ADMIN, so it validates hard (Zod), hashes the password
// (bcrypt), and isolates the org. A duplicate email returns a clean field error —
// never a 500, never a leak of which org owns it.

export const VERTICALS = [
  "Humanoid",
  "Mobility & AVs",
  "Industrial & manufacturing",
  "Defense & aerospace",
  "Logistics & warehouse",
  "Agriculture",
  "Healthcare & surgical",
  "Other",
] as const;

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid work email."),
  password: z.string().min(8, "Use at least 8 characters."),
  orgName: z.string().trim().min(1, "Enter your organization name.").max(120),
  industry: z.enum(VERTICALS).optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;

export type ProvisionResult =
  | { ok: true; orgId: string; userId: string; slug: string }
  | { ok: false; field: "email" | "form"; message: string };

// kebab-case slug from an org name (ascii, collapse runs, trim dashes).
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "workspace";
}

// Find a free slug: base, then base-2, base-3, … (Org.slug is unique).
async function uniqueSlug(base: string): Promise<string> {
  for (let n = 1; n < 1000; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const taken = await prisma.org.findUnique({ where: { slug: candidate } });
    if (!taken) return candidate;
  }
  // Astronomically unlikely; keep it deterministic-ish without Date/random here.
  return `${base}-${base.length}`;
}

/**
 * Provision a new workspace: validate → uniqueness → one-transaction Org + ADMIN
 * (bcrypt password). Returns the ids + slug, or a structured field error. Never
 * throws for expected failures (duplicate email, validation) — those are results.
 */
export async function provisionWorkspace(
  raw: unknown,
): Promise<ProvisionResult> {
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const isEmail = first?.path[0] === "email";
    return {
      ok: false,
      field: isEmail ? "email" : "form",
      message: first?.message ?? "Please check the form and try again.",
    };
  }
  const { name, email, password, orgName, industry } = parsed.data;

  // Email uniqueness — clean field error, no leak.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      ok: false,
      field: "email",
      message: "An account with this email already exists — log in instead.",
    };
  }

  const slug = await uniqueSlug(slugify(orgName));
  const passwordHash = await bcrypt.hash(password, 10);

  // One transaction: the Org + its first ADMIN. If the email raced in between,
  // the unique constraint rejects — surface it as the same clean field error.
  try {
    const { org, user } = await prisma.$transaction(async (tx) => {
      const org = await tx.org.create({
        data: { name: orgName, slug, industry: industry ?? null },
      });
      const user = await tx.user.create({
        data: { orgId: org.id, name, email, role: "ADMIN", passwordHash },
      });
      return { org, user };
    });
    return { ok: true, orgId: org.id, userId: user.id, slug };
  } catch {
    return {
      ok: false,
      field: "email",
      message: "An account with this email already exists — log in instead.",
    };
  }
}
