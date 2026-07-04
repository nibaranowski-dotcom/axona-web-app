// FILE.1 storage — the implementation moved to @axona/db (FILE.2) so the worker,
// the in-process extract pipeline, and verify all share one storage seam. This
// re-export keeps the FILE.1 route imports (`@/lib/storage`) unchanged.
export {
  s3Configured,
  ensureBucket,
  putObject,
  getObjectBytes,
  presignedGetUrl,
  deleteObject,
  S3_BUCKET,
} from "@axona/db";
