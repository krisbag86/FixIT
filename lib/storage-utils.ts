export const ALLOWED_MIME_PREFIXES = ["image/", "text/", "application/pdf", "application/json"];
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export class UploadValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

export function isValidStorageKey(key: string): boolean {
  return /^[a-f0-9-]+$/i.test(key) && key.length >= 8 && key.length <= 64 && !key.includes("..") && !key.includes("/");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function isAllowedMimeType(mimeType: string): boolean {
  if (mimeType === "application/octet-stream") {
    return false;
  }
  return ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
}

export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "file";
  return base.slice(0, 255);
}
