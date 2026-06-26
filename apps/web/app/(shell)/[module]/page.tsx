import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@axona/db";
import { Card } from "@/components/ui";
import { metaFor } from "@/lib/module-meta";

// Shell-wrapped placeholder for any seeded module whose real screen hasn't been
// built yet. Lets a launcher tile route to a token-styled "coming soon" inside
// the re-skinned shell (sidebar + agent pane). Each module's own story replaces
// this with the real screen (a static route wins over this dynamic segment).
export const dynamic = "force-dynamic";

export default async function ModulePlaceholder({
  params,
}: {
  params: { module: string };
}) {
  const mod = await prisma.module.findUnique({ where: { key: params.module } });
  if (!mod) notFound();

  const meta = metaFor(mod.key, mod.name);
  const groupLabel = mod.group.replace(/_/g, " ").toLowerCase();

  return (
    <div className="mx-auto max-w-5xl px-8 py-12">
      <p className="font-mono text-[11px] uppercase tracking-widest text-ink-muted">
        {groupLabel}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-strong">
        {mod.name}
      </h1>
      <p className="mt-2 max-w-xl text-ink-muted">{meta.description}</p>

      <div className="mt-8 max-w-xl">
        <Card
          title="Screen coming soon"
          body={`The ${mod.name} screen lands in its own story. The shell, design tokens, and primitives (DS.1) are already in place.`}
        />
      </div>

      <div className="mt-6">
        <Link
          href="/"
          className="inline-flex items-center rounded-btn border border-line-strong px-4 py-2 text-sm font-medium text-ink transition-colors duration-200 ease-ease hover:border-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          ← Mission Control
        </Link>
      </div>
    </div>
  );
}
