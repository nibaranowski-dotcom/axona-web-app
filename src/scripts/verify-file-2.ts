/**
 * Verify FILE.2 — text-extraction + embedding pipeline (PRD §11). Pure-logic
 * checks always run; the live checks are gated on DATABASE_URL + S3_ENDPOINT (CI
 * has neither). Uses the FakeEmbedder — no provider key. Run: pnpm verify:file-2
 */
import { EMBED_DIM, FakeEmbedder, extractText } from "@axona/db";

let passed = 0;
let failed = 0;
const check = async (
  label: string,
  fn: () => boolean | Promise<boolean>,
): Promise<void> => {
  try {
    const ok = await fn();
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    ok ? passed++ : failed++;
  } catch (e) {
    console.log(`  FAIL ${label} — ${(e as Error).message}`);
    failed++;
  }
};

async function run(): Promise<void> {
  console.log("\nVerifying FILE.2 — text-extraction + embedding pipeline\n");

  // 1) FakeEmbedder: 1536-dim, L2-normalized, deterministic.
  await check(
    "FakeEmbedder → 1536-dim L2-normalized vector, deterministic",
    async () => {
      const fake = new FakeEmbedder();
      const [a] = await fake.embed(["ECO-318 supersede the drive"]);
      const [b] = await fake.embed(["ECO-318 supersede the drive"]);
      const [c] = await fake.embed(["a completely different string"]);
      if (!a || !b || !c) return false;
      const norm = Math.sqrt(a.reduce((n, x) => n + x * x, 0));
      const same = a.every((x, i) => x === b[i]);
      const diff = a.some((x, i) => x !== c[i]);
      return (
        fake.dim === EMBED_DIM &&
        a.length === 1536 &&
        Math.abs(norm - 1) < 1e-6 &&
        same &&
        diff
      );
    },
  );

  // 2) Extraction: text decodes; unknown/binary skipped without throwing.
  await check(
    "extraction: txt/md decode to text; unknown skipped (no throw)",
    async () => {
      const txt = await extractText(Buffer.from("hello ECO-318 world"), "txt");
      const md = await extractText(Buffer.from("# Title\n\nbody"), "md");
      const bin = await extractText(
        Buffer.from([0, 1, 2, 255, 254, 0, 3]),
        "bin",
      );
      return (
        txt.ok &&
        /ECO-318/.test(txt.text) &&
        md.ok &&
        /Title/.test(md.text) &&
        !bin.ok &&
        bin.text === ""
      );
    },
  );

  const liveOff = !process.env.DATABASE_URL || !process.env.S3_ENDPOINT;
  if (liveOff) {
    console.log("  SKIP live checks — DATABASE_URL / S3_ENDPOINT not set");
  } else {
    const { prisma, processFile, semanticSearch, hybridSearch } =
      await import("@axona/db");
    const embedder = new FakeEmbedder();
    const org = await prisma.org.findFirst({
      where: { name: "Axona" },
    });
    // a seeded through-line file (its FILE.1 placeholder blob has bytes)
    const file = org
      ? await prisma.file.findFirst({
          where: { name: { contains: "ECO-318" }, project: { orgId: org.id } },
          select: { id: true, projectId: true },
        })
      : null;

    if (!org || !file) {
      console.log(
        "  FAIL demo org/seeded file missing (run db:seed + db:seed:blobs)",
      );
      failed++;
    } else {
      // 3) processor: File.text + File.embedding + SearchDoc(FILE) embedding; idempotent.
      await check(
        "processor sets File.text + embedding + SearchDoc(FILE); idempotent",
        async () => {
          const r1 = await processFile(
            { fileId: file.id, orgId: org.id },
            { embedder },
          );
          await processFile({ fileId: file.id, orgId: org.id }, { embedder }); // 2nd run
          const f = (await prisma.$queryRawUnsafe(
            `select length(text) tlen, (embedding is not null) has_emb from "File" where id=$1`,
            file.id,
          )) as { tlen: number; has_emb: boolean }[];
          const docs = (await prisma.$queryRawUnsafe(
            `select count(*)::int c, bool_or(embedding is not null) has_emb from "SearchDoc" where type='FILE'::"SearchType" and "refId"=$1`,
            file.id,
          )) as { c: number; has_emb: boolean }[];
          return (
            r1.embedded &&
            (f[0]?.tlen ?? 0) > 0 &&
            f[0]?.has_emb === true &&
            docs[0]?.c === 1 && // idempotent — no dup doc
            docs[0]?.has_emb === true
          );
        },
      );

      // 4) semanticSearch returns the file; cross-org does not.
      await check(
        "semanticSearch returns the seeded file; cross-org blocked",
        async () => {
          const hits = await semanticSearch(org.id, "ECO-318 drive change", {
            embedder,
          });
          const mine = hits.some(
            (h) => h.type === "FILE" && h.refId === file.id,
          );
          const other = await semanticSearch("org_does_not_exist", "ECO-318", {
            embedder,
          });
          return mine && other.length === 0;
        },
      );

      // 5) /api/search hybrid: Procurement MODULE (FTS unbroken) AND a FILE hit.
      await check(
        "hybrid search: Procurement MODULE hit AND a FILE hit",
        async () => {
          const res = await hybridSearch(org.id, "procurement", {
            scope: "ALL",
            limit: 12,
            embedder,
          });
          return (
            res.hits.some(
              (h) => h.type === "MODULE" && /Procurement/i.test(h.title),
            ) && res.hits.some((h) => h.type === "FILE")
          );
        },
      );
    }
    await prisma.$disconnect();
  }

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
