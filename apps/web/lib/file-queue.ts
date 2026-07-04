import type { ConnectionOptions } from "bullmq";
import { FILE_EXTRACT_QUEUE, processFile } from "@axona/db";

// FILE.2 enqueue seam (mirrors WF.1's enqueueWorkflowRun). With Redis → add a
// BullMQ `file-extract` job (apps/worker's processor consumes it); without Redis
// (dev/CI) → run the shared processor in-process, non-blocking (the upload has
// already returned 201). Failures are logged, never surfaced to the upload.
export function enqueueFileExtract(fileId: string, orgId: string): void {
  const url = process.env.REDIS_URL;
  if (url) {
    void (async () => {
      const { Queue } = await import("bullmq");
      const { default: IORedis } = await import("ioredis");
      const connection = new IORedis(url, { maxRetriesPerRequest: null });
      const queue = new Queue(FILE_EXTRACT_QUEUE, {
        connection: connection as unknown as ConnectionOptions,
      });
      await queue.add("extract", { fileId, orgId }, { jobId: fileId });
      await queue.close();
      await connection.quit();
    })().catch((e) => console.error("[file-extract enqueue]", e));
  } else {
    // no Redis: process in the background so the upload stays non-blocking.
    void processFile({ fileId, orgId }).catch((e) =>
      console.error("[file-extract in-process]", e),
    );
  }
}
