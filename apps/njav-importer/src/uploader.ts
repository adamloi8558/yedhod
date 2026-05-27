import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import fs from "fs";

function s3() {
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

export async function uploadFile(
  key: string,
  filePath: string,
  contentType: string
) {
  const client = s3();
  const stream = fs.createReadStream(filePath);
  const upload = new Upload({
    client,
    params: {
      Bucket: bucket(),
      Key: key,
      Body: stream,
      ContentType: contentType,
    },
    queueSize: 4,
    partSize: 32 * 1024 * 1024,
    leavePartsOnError: false,
  });
  await upload.done();
}
