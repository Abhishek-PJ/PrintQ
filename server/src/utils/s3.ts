import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import { s3Client } from "../config/s3";
import { env } from "../config/env";

export const uploadToS3 = async (
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<{ fileKey: string; fileUrl: string }> => {
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext).replace(/\s+/g, "-").toLowerCase();
  const fileKey = `orders/${Date.now()}-${base}${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.awsS3Bucket,
      Key: fileKey,
      Body: buffer,
      ContentType: mimeType
    })
  );

  const fileUrl = env.awsCloudfrontDomain
    ? `https://${env.awsCloudfrontDomain}/${fileKey}`
    : `https://${env.awsS3Bucket}.s3.${env.awsRegion}.amazonaws.com/${fileKey}`;

  return { fileKey, fileUrl };
};

export const deleteFromS3 = async (fileKey: string): Promise<void> => {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: env.awsS3Bucket,
      Key: fileKey
    })
  );
};

export const getSignedDownloadUrl = async (fileKey: string, fileName: string): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: env.awsS3Bucket,
    Key: fileKey,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`
  });
  // URL expires in 15 minutes
  return getSignedUrl(s3Client, command, { expiresIn: 900 });
};
