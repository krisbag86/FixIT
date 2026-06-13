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

/**
 * Magic byte signatures for allowed file types.
 * Used to validate that the actual file content matches the declared MIME type.
 */
const MAGIC_BYTES: Record<string, { signature: number[]; offset: number }[]> = {
  "image/jpeg": [
    { signature: [0xFF, 0xD8, 0xFF], offset: 0 }
  ],
  "image/png": [
    { signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0 }
  ],
  "image/gif": [
    { signature: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], offset: 0 }, // GIF87a
    { signature: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], offset: 0 }  // GIF89a
  ],
  "image/webp": [
    { signature: [0x52, 0x49, 0x46, 0x46], offset: 0 }
  ],
  "application/pdf": [
    { signature: [0x25, 0x50, 0x44, 0x46, 0x2D], offset: 0 } // %PDF-
  ]
};

/**
 * Detect file MIME type by examining magic bytes in the first bytes of the data.
 * Returns the detected MIME type string, or `null` if unknown.
 */
export function detectMimeType(data: Uint8Array): string | null {
  for (const [mimeType, signatures] of Object.entries(MAGIC_BYTES)) {
    for (const { signature, offset } of signatures) {
      if (data.length < offset + signature.length) continue;

      let match = true;
      for (let i = 0; i < signature.length; i++) {
        if (data[offset + i] !== signature[i]) {
          match = false;
          break;
        }
      }

      if (match) {
        // Special handling for WebP: RIFF header + "WEBP" at offset 8
        if (mimeType === "image/webp") {
          if (data.length < 12) continue;
          if (
            data[8] !== 0x57 || // W
            data[9] !== 0x45 || // E
            data[10] !== 0x42 || // B
            data[11] !== 0x50    // P
          ) {
            continue;
          }
        }
        return mimeType;
      }
    }
  }

  return null;
}

/**
 * Validate that the actual content of a file buffer is compatible with
 * the declared MIME type. This provides server-side verification against
 * spoofed Content-Type headers.
 *
 * - image/* and application/pdf: checked via magic bytes
 * - text/*: checked for valid UTF-8 and absence of null bytes (indicating binary)
 * - application/json: checked for valid JSON structure
 */
export function validateContentType(data: Uint8Array, declaredType: string): boolean {
  // For binary types with magic bytes, verify the file signature
  if (declaredType.startsWith("image/") || declaredType === "application/pdf") {
    const detected = detectMimeType(data);
    if (!detected) {
      return false;
    }

    // Cross-reference: the detected type should match the declared category
    if (declaredType === "application/pdf") {
      return detected === "application/pdf";
    }

    // For images, the detected type should be an image (not PDF uploaded as image)
    return detected.startsWith("image/");
  }

  // For text types (no magic bytes), verify it's not binary
  if (declaredType.startsWith("text/")) {
    // Check for null bytes in the first 512 bytes — presence indicates binary content
    const checkLength = Math.min(data.length, 512);
    for (let i = 0; i < checkLength; i++) {
      if (data[i] === 0x00) {
        return false;
      }
    }

    // Verify valid UTF-8 (decoding will replace invalid sequences)
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(data.subarray(0, checkLength));
    } catch {
      return false;
    }

    return true;
  }

  // For JSON, verify it starts with { or [ and can be parsed
  if (declaredType === "application/json") {
    if (data.length === 0) return false;

    const firstByte = data[0];
    // Must start with { (0x7B) or [ (0x5B)
    if (firstByte !== 0x7B && firstByte !== 0x5B) return false;

    try {
      JSON.parse(new TextDecoder("utf-8").decode(data));
      return true;
    } catch {
      return false;
    }
  }

  // Unknown declared type — let the existing isAllowedMimeType filter handle it
  return true;
}
