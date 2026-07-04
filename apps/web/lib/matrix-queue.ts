import type { ConnectionOptions } from "bullmq";
import {
  MATRIX_EXTRACT_QUEUE,
  runColumnExtraction,
  type MatrixExtractJob,
} from "@axona/agents";

// MTX.1 enqueue seam (mirrors FILE.2). Redis → add a `matrix-extract` job
// (apps/worker fans out); no Redis (dev/CI) → run the fan-out in-process,
// non-blocking (the POST already returned the column). Failures are logged.
export function enqueueMatrixExtract(job: MatrixExtractJob): void {
  const url = process.env.REDIS_URL;
  if (url) {
    void (async () => {
      const { Queue } = await import("bullmq");
      const { default: IORedis } = await import("ioredis");
      const connection = new IORedis(url, { maxRetriesPerRequest: null });
      const queue = new Queue(MATRIX_EXTRACT_QUEUE, {
        connection: connection as unknown as ConnectionOptions,
      });
      await queue.add("extract", job, { jobId: `${job.columnId}` });
      await queue.close();
      await connection.quit();
    })().catch((e) => console.error("[matrix-extract enqueue]", e));
  } else {
    void runColumnExtraction(job).catch((e) =>
      console.error("[matrix-extract in-process]", e),
    );
  }
}
