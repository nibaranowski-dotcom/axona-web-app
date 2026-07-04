/**
 * @axona/worker — long-lived Node process running the BullMQ job engines.
 *
 * WF.1: the "workflow-runs" queue → the shared DAG engine (`runWorkflow`).
 * FILE.2: the "file-extract" queue → the shared extract-embed processor
 *   (`processFile` in @axona/db) — the same processor the upload route runs
 *   in-process when there is no Redis. Every DB touch is org-scoped.
 */
import { Worker, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";
import {
  WORKFLOW_QUEUE,
  runWorkflow,
  type WorkflowRunJob,
  MATRIX_EXTRACT_QUEUE,
  runColumnExtraction,
  type MatrixExtractJob,
} from "@axona/agents";
import {
  FILE_EXTRACT_QUEUE,
  processFile,
  type FileExtractJob,
} from "@axona/db";

type RunJob = WorkflowRunJob & { runId: string };

function main(): void {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.log(
      "[axona-worker] no REDIS_URL — idle (jobs run in-process via the API/upload path)",
    );
    return;
  }
  // ioredis instance as the BullMQ connection (cast bridges the bundled-vs-app
  // ioredis type skew — same runtime object).
  const connection = new IORedis(url, {
    maxRetriesPerRequest: null,
  }) as unknown as ConnectionOptions;

  const runs = new Worker<RunJob>(
    WORKFLOW_QUEUE,
    async (job) => {
      const status = await runWorkflow(job.data);
      return { runId: job.data.runId, status };
    },
    { connection },
  );
  runs.on("failed", (job, err) =>
    console.error(`[axona-worker] run ${job?.data.runId} failed:`, err.message),
  );

  const extract = new Worker<FileExtractJob>(
    FILE_EXTRACT_QUEUE,
    async (job) => processFile(job.data),
    { connection },
  );
  extract.on("failed", (job, err) =>
    console.error(
      `[axona-worker] extract ${job?.data.fileId} failed:`,
      err.message,
    ),
  );

  const matrix = new Worker<MatrixExtractJob>(
    MATRIX_EXTRACT_QUEUE,
    async (job) => runColumnExtraction(job.data),
    { connection },
  );
  matrix.on("failed", (job, err) =>
    console.error(
      `[axona-worker] matrix ${job?.data.columnId} failed:`,
      err.message,
    ),
  );

  console.log(
    `[axona-worker] online — ${WORKFLOW_QUEUE} + ${FILE_EXTRACT_QUEUE} + ${MATRIX_EXTRACT_QUEUE}`,
  );
}

main();
