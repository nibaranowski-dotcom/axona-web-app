import { dbForOrg, prisma, agentTrustLadder } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { AgentsView, type AgentGroup } from "@/components/agents/AgentsView";

// /agents (build-spec §4.4) — the roster of every module's agents, grouped by
// module, each opening a live chat (ART.4). Org-scoped via getCurrentUser →
// dbForOrg. Static route → takes precedence over the (shell)/[module] catch-all.
export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const user = await getCurrentUser();
  if (!user) return <AgentsView groups={[]} trust={[]} />;

  const db = dbForOrg(user.orgId);
  const [agents, modules, trust] = await Promise.all([
    db.agent.findMany({ orderBy: [{ moduleKey: "asc" }, { code: "asc" }] }),
    prisma.module.findMany({ orderBy: { orderIndex: "asc" } }), // Module is global
    // TRUST.1 — the earned-autonomy ladder, computed on read from AUDIT.1, org-scoped.
    agentTrustLadder(db, user.orgId),
  ]);

  const byModule = new Map<string, typeof agents>();
  for (const a of agents) {
    const list = byModule.get(a.moduleKey) ?? [];
    list.push(a);
    byModule.set(a.moduleKey, list);
  }

  const groups: AgentGroup[] = modules
    .map((m) => ({
      key: m.key,
      name: m.name,
      group: m.group,
      agents: (byModule.get(m.key) ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        code: a.code,
        role: a.role,
        description: a.description,
        state: a.state,
        moduleKey: a.moduleKey,
      })),
    }))
    .filter((g) => g.agents.length > 0);

  return <AgentsView groups={groups} trust={trust} />;
}
