import { dbForOrg } from "@axona/db";
import { runAgent } from "@axona/agents";
import { getCurrentUser } from "@/lib/session";

// POST /api/agents/:id/chat (build-spec §6) — runs the agent (ART.1/ART.2) and
// streams its trace lines LIVE over SSE as the runtime pushes them, then the
// final message. Persists Chat + user/agent Message; the AgentRun is persisted
// by runAgent. Gated actions surface as a distinct `proposal` event.
//
// Org-scoped via getCurrentUser → dbForOrg (FND.13 stub; TODO AUTH.1). Agent and
// chat lookups are scoped; a miss is a 404 (never leak/continue another org).
//
// SSE event types: trace | proposal | message | done | error.

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  let body: { message?: unknown; chatId?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const chatId = typeof body.chatId === "string" ? body.chatId : undefined;
  if (!message) return new Response("message is required", { status: 400 });

  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  const db = dbForOrg(user.orgId);

  const agent = await db.agent.findFirst({ where: { id: params.id } });
  if (!agent) return new Response("not found", { status: 404 });

  // Resolve the chat before streaming so a cross-org / missing chatId is a real
  // 404, not an in-stream error.
  const chat = chatId
    ? await db.chat.findFirst({ where: { id: chatId } })
    : await db.chat.create({
        data: {
          orgId: user.orgId,
          agentId: agent.id,
          userId: user.id,
          scope: agent.moduleKey,
        },
      });
  if (!chat) return new Response("not found", { status: 404 });

  await db.message.create({
    data: { chatId: chat.id, role: "USER", text: message },
  });

  const encoder = new TextEncoder();
  let aborted = false;
  req.signal.addEventListener("abort", () => {
    aborted = true;
  });

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (aborted) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {
          aborted = true; // client gone — stop enqueuing
        }
      };

      try {
        const result = await runAgent(agent.id, message, {
          orgId: user.orgId,
          userId: user.id,
          // Live sink: each trace line as the runtime pushes it. Gated proposals
          // get their own event type so the UI can show "awaiting approval".
          onTrace: (line) =>
            send(line.kind === "proposal" ? "proposal" : "trace", line),
        });

        // Persist the agent's answer (partial trace is already on the AgentRun).
        await db.message.create({
          data: { chatId: chat.id, role: "AGENT", text: result.text },
        });

        send("message", {
          chatId: chat.id,
          text: result.text,
          status: result.status,
          runId: result.runId,
        });
        send("done", { runId: result.runId });
      } catch (e) {
        send("error", { message: (e as Error).message });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
