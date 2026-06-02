import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  isAllowedMimeType,
  MAX_FILE_SIZE,
  sanitizeFilename,
  UploadValidationError
} from "@/lib/storage-utils";

const storageRoot = path.join(process.cwd(), ".data", "attachments");

export {
  ALLOWED_MIME_PREFIXES,
  formatFileSize,
  isValidStorageKey,
  UploadValidationError
} from "@/lib/storage-utils";

export async function saveAttachmentFile(
  data: Uint8Array,
  filename: string,
  mimeType: string
): Promise<{ storageKey: string; size: number; filename: string; mimeType: string }> {
  if (!filename || filename.length > 255) {
    throw new UploadValidationError("Nieprawidlowa nazwa pliku.");
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

  const safeName = sanitizeFilename(filename);
  const id = randomUUID();
  const storageKey = id;
  const fullPath = path.join(storageRoot, storageKey);

  await mkdir(storageRoot, { recursive: true });
  await writeFile(fullPath, data);

  return { storageKey, size: data.byteLength, filename: safeName, mimeType };
}

export async function readAttachmentFile(storageKey: string): Promise<Buffer> {
  const { isValidStorageKey } = await import("@/lib/storage-utils");
  if (!isValidStorageKey(storageKey)) {
    throw new UploadValidationError("Nieprawidlowy klucz pliku.");
  }
  const fullPath = path.join(storageRoot, storageKey);
  return readFile(fullPath);
}

export async function deleteAttachmentFile(storageKey: string): Promise<void> {
  const { isValidStorageKey } = await import("@/lib/storage-utils");
  if (!isValidStorageKey(storageKey)) {
    return;
  }
  const fullPath = path.join(storageRoot, storageKey);
  try {
    await unlink(fullPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
