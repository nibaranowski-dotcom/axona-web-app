import type { ConnectionOptions } from "bullmq";
import {
  WORKFLOW_QUEUE,
  createWorkflowRun,
  runWorkflow,
  type WorkflowRunJob,
} from "@axona/agents";

// WF.1 enqueue seam. Create the WorkflowRun up front (so the API returns a runId
// immediately), then dispatch: with Redis → add a BullMQ job (the apps/worker
// engine consumes it); without Redis (dev / CI) → run the shared engine in-process.
// Either way the caller gets a runId and the run is org-scoped end-to-end. The
// jobId is keyed on the runId so a re-enqueue never double-runs (idempotency).
export async function enqueueWorkflowRun(job: WorkflowRunJob): Promise<string> {
  const runId = await createWorkflowRun(job);
  const url = process.env.REDIS_URL;

  if (url) {
    const { Queue } = await import("bullmq");
    const { default: IORedis } = await import("ioredis");
    const connection = new IORedis(url, { maxRetriesPerRequest: null });
    const queue = new Queue(WORKFLOW_QUEUE, {
      connection: connection as unknown as ConnectionOptions,
    });
    await queue.add("run", { ...job, runId }, { jobId: runId });
    await queue.close();
    await connection.quit();
  } else {
    await runWorkflow({ ...job, runId });
  }
  return runId;
}
