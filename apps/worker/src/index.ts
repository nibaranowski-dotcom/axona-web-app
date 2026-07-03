/**
 * @axona/worker — long-lived Node process running the BullMQ workflow-run engine.
 *
 * WF.1: consumes the "workflow-runs" queue (FND.3 Redis) and executes each job
 * through the shared DAG engine (`runWorkflow` in @axona/agents) — the same engine
 * the enqueue API runs in-process when there is no Redis. Guardrail gates propose-
 * not-execute (park AWAITING_APPROVAL); every DB touch is org-scoped. Agent + ART.3
 * event routing layer on later; this is the run spine.
 */
import { Worker, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";
import {
  WORKFLOW_QUEUE,
  runWorkflow,
  type WorkflowRunJob,
} from "@axona/agents";

type Job = WorkflowRunJob & { runId: string };

function main(): void {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.log(
      "[axona-worker] no REDIS_URL — idle (WF.1 runs in-process via the enqueue API)",
    );
    return;
  }
  // ioredis instance as the BullMQ connection (cast bridges the bundled-vs-app
  // ioredis type skew — same runtime object).
  const connection = new IORedis(url, {
    maxRetriesPerRequest: null,
  }) as unknown as ConnectionOptions;
  const worker = new Worker<Job>(
    WORKFLOW_QUEUE,
    async (job) => {
      const status = await runWorkflow(job.data);
      return { runId: job.data.runId, status };
    },
    { connection },
  );
  worker.on("completed", (job) =>
    console.log(`[axona-worker] run ${job.data.runId} → done`),
  );
  worker.on("failed", (job, err) =>
    console.error(`[axona-worker] run ${job?.data.runId} failed:`, err.message),
  );
  console.log(`[axona-worker] ${WORKFLOW_QUEUE} worker online`);
}

main();
