import "server-only";

import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import {
  isAllowedMimeType,
  MAX_FILE_SIZE,
  sanitizeFilename,
  UploadValidationError,
  isValidStorageKey
} from "@/lib/storage-utils";

function getS3Config() {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION ?? "auto";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const bucket = process.env.S3_BUCKET;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  return { endpoint, region, accessKeyId, secretAccessKey, bucket };
}

let s3Client: S3Client | null = null;

function getS3Client(config: NonNullable<ReturnType<typeof getS3Config>>): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      },
      forcePathStyle: true
    });
  }
  return s3Client;
}

export function isS3Configured(): boolean {
  return getS3Config() !== null;
}

export async function saveAttachmentFileS3(
  data: Uint8Array,
  filename: string,
  mimeType: string
): Promise<{ storageKey: string; size: number; filename: string; mimeType: string }> {
  if (!filename || filename.length > 255) {
    throw new UploadValidationError("Nieprawidłowa nazwa pliku.");
  }
  if (data.byteLength === 0) {
    throw new UploadValidationError("Plik jest pusty.");
  }
  if (data.byteLength > MAX_FILE_SIZE) {
    throw new UploadValidationError(`Plik przekracza limit ${MAX_FILE_SIZE / 1024 / 1024} MB.`);
  }
  if (!isAllowedMimeType(mimeType)) {
    throw new UploadValidationError(`Typ pliku ${mimeType} nie jest dozwolony.`);
  }

  const config = getS3Config();
  if (!config) {
    throw new Error("S3 nie jest skonfigurowane.");
  }

  const safeName = sanitizeFilename(filename);
  const storageKey = randomUUID();
  const client = getS3Client(config);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
      Body: data,
      ContentType: mimeType,
      ContentLength: data.byteLength
    })
  );

  return { storageKey, size: data.byteLength, filename: safeName, mimeType };
}

export async function readAttachmentFileS3(storageKey: string): Promise<Buffer> {
  if (!isValidStorageKey(storageKey)) {
    throw new UploadValidationError("Nieprawidłowy klucz pliku.");
  }

  const config = getS3Config();
  if (!config) {
    throw new Error("S3 nie jest skonfigurowane.");
  }

  const client = getS3Client(config);
  const response = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: storageKey
    })
  );

  if (!response.Body) {
    throw new UploadValidationError("Nie znaleziono pliku.");
  }

  const body = await response.Body.transformToByteArray();
  return Buffer.from(body);
}

export async function deleteAttachmentFileS3(storageKey: string): Promise<void> {
  if (!isValidStorageKey(storageKey)) {
    return;
  }

  const config = getS3Config();
  if (!config) {
    return;
  }

  const client = getS3Client(config);
  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: storageKey
      })
    );
  } catch (error) {
    // Ignore if file doesn't exist
    if ((error as { name?: string }).name !== "NoSuchKey") {
      throw error;
    }
  }
}
