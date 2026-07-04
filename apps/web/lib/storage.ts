import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// FILE.1 — S3/MinIO blob store (build-spec §3.3/§6). The single storage seam for
// project files: put/get/presign/delete over @aws-sdk/client-s3, path-style for
// MinIO. Config from env; server-only (route handlers) — never a client
// component. Object keys are ORG-PREFIXED (orgId/projectId/uuid.ext) so a
// tenant's blobs are unreachable by another (belt to the route-level org filter).
//
// FILE.2 wires the extract+embed queue job on upload; nothing auto-processes here.

const BUCKET = process.env.S3_BUCKET ?? "axona-files";

/** True when the blob store is configured (verify + upload gate on this). */
export function s3Configured(): boolean {
  return !!process.env.S3_ENDPOINT;
}

let _client: S3Client | null = null;
function client(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: process.env.S3_REGION ?? "us-east-1",
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: true, // MinIO
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? "",
        secretAccessKey: process.env.S3_SECRET_KEY ?? "",
      },
    });
  }
  return _client;
}

export const S3_BUCKET = BUCKET;

/** Create the bucket if it doesn't exist (idempotent). */
export async function ensureBucket(): Promise<void> {
  const c = client();
  try {
    await c.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await c.send(new CreateBucketCommand({ Bucket: BUCKET })).catch(() => {});
  }
}

export async function putObject(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType?: string,
): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** Fetch an object's bytes (used to stream a download response). */
export async function getObjectBytes(key: string): Promise<Buffer> {
  const res = await client().send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
  );
  if (!res.Body) throw new Error("empty object body");
  const bytes = await res.Body.transformToByteArray();
  return Buffer.from(bytes);
}

/** A short-lived presigned GET URL (default 5 min) — the CDN-friendly path. */
export async function presignedGetUrl(
  key: string,
  expiresIn = 300,
): Promise<string> {
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn },
  );
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
