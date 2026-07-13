import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

const bucket = () => process.env.R2_BUCKET_NAME!;

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
) {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn });
}

export async function getPresignedDownloadUrl(
  key: string,
  expiresIn = 7200
) {
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn });
}

export async function deleteObject(key: string) {
  const client = getR2Client();
  const command = new DeleteObjectCommand({
    Bucket: bucket(),
    Key: key,
  });
  return client.send(command);
}

export async function uploadBuffer(
  key: string,
  body: Buffer,
  contentType: string,
  contentLength?: number
) {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: body,
    ContentType: contentType,
    ...(contentLength ? { ContentLength: contentLength } : {}),
  });
  return client.send(command);
}

export function getPublicUrl(key: string) {
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

/**
 * Fetch an object directly from R2 as a native fetch Response.
 *
 * Used by tenant apps to proxy media through their own domain so the
 * browser never sees the R2 hostname (which contains the bucket name).
 * Preserves Range so browsers can seek within video, and passes through
 * ETag/Last-Modified so caches work.
 */
export async function fetchObject(
  key: string,
  init?: { range?: string; ifNoneMatch?: string; ifModifiedSince?: string }
): Promise<Response> {
  // Presign a short-lived GET, then fetch it — Node's undici streams the
  // body without buffering, so proxying to the client is O(1) memory.
  const url = await getPresignedDownloadUrl(key, 300);
  const headers: Record<string, string> = {};
  if (init?.range) headers["range"] = init.range;
  if (init?.ifNoneMatch) headers["if-none-match"] = init.ifNoneMatch;
  if (init?.ifModifiedSince) headers["if-modified-since"] = init.ifModifiedSince;
  return fetch(url, { headers, cache: "no-store" });
}
