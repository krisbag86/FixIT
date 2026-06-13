import { describe, expect, it } from "vitest";
import {
  ALLOWED_MIME_PREFIXES,
  detectMimeType,
  formatFileSize,
  isAllowedMimeType,
  isValidStorageKey,
  validateContentType,
  UploadValidationError
} from "@/lib/storage-utils";

describe("attachment storage", () => {
  describe("isValidStorageKey", () => {
    it("accepts uuid-like hex strings", () => {
      expect(isValidStorageKey("abcdef01-2345-6789-abcd-ef0123456789")).toBe(true);
      expect(isValidStorageKey("0123456789abcdef0123456789abcdef")).toBe(true);
    });

    it("rejects path traversal attempts", () => {
      expect(isValidStorageKey("..")).toBe(false);
      expect(isValidStorageKey("abc/../etc")).toBe(false);
      expect(isValidStorageKey("path/with/slashes")).toBe(false);
      expect(isValidStorageKey("")).toBe(false);
      expect(isValidStorageKey("short")).toBe(false);
    });

    it("rejects non-hex characters", () => {
      expect(isValidStorageKey("xyz-not-allowed-here-but-long")).toBe(false);
    });

    it("rejects overly long keys", () => {
      const long = "a".repeat(65);
      expect(isValidStorageKey(long)).toBe(false);
    });
  });

  describe("isAllowedMimeType", () => {
    it("allows image, text, and pdf types", () => {
      expect(isAllowedMimeType("image/png")).toBe(true);
      expect(isAllowedMimeType("text/plain")).toBe(true);
      expect(isAllowedMimeType("application/pdf")).toBe(true);
    });

    it("rejects binary streams and unknown types", () => {
      expect(isAllowedMimeType("application/octet-stream")).toBe(false);
      expect(isAllowedMimeType("application/x-msdownload")).toBe(false);
    });
  });

  describe("UploadValidationError", () => {
    it("is a subclass of Error and exposes 400 status", () => {
      const err = new UploadValidationError("test");
      expect(err).toBeInstanceOf(Error);
      expect(err.status).toBe(400);
      expect(err.message).toBe("test");
    });
  });

  describe("ALLOWED_MIME_PREFIXES", () => {
    it("includes image, text, and pdf types", () => {
      expect(ALLOWED_MIME_PREFIXES).toContain("image/");
      expect(ALLOWED_MIME_PREFIXES).toContain("application/pdf");
    });
  });

  describe("detectMimeType", () => {
    it("detects JPEG from magic bytes", () => {
      const jpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
      expect(detectMimeType(jpeg)).toBe("image/jpeg");
    });

    it("detects PNG from magic bytes", () => {
      const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
      expect(detectMimeType(png)).toBe("image/png");
    });

    it("detects GIF87a from magic bytes", () => {
      const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x00, 0x00]);
      expect(detectMimeType(gif)).toBe("image/gif");
    });

    it("detects GIF89a from magic bytes", () => {
      const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00]);
      expect(detectMimeType(gif)).toBe("image/gif");
    });

    it("detects WebP from RIFF+WEBP magic bytes", () => {
      const webp = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // file size placeholder
        0x57, 0x45, 0x42, 0x50  // WEBP
      ]);
      expect(detectMimeType(webp)).toBe("image/webp");
    });

    it("detects PDF from magic bytes", () => {
      const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]); // %PDF-1.4
      expect(detectMimeType(pdf)).toBe("application/pdf");
    });

    it("returns null for unknown content", () => {
      const unknown = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(detectMimeType(unknown)).toBeNull();
    });

    it("returns null for empty data", () => {
      expect(detectMimeType(new Uint8Array([]))).toBeNull();
    });
  });

  describe("validateContentType", () => {
    it("accepts JPEG data with image/jpeg declaration", () => {
      const data = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
      expect(validateContentType(data, "image/jpeg")).toBe(true);
    });

    it("rejects PDF data declared as image", () => {
      const data = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
      expect(validateContentType(data, "image/png")).toBe(false);
    });

    it("accepts text/plain without null bytes", () => {
      const data = new TextEncoder().encode("Hello, world!");
      expect(validateContentType(data, "text/plain")).toBe(true);
    });

    it("rejects text/plain with null bytes", () => {
      const data = new Uint8Array([0x48, 0x00, 0x65, 0x6C, 0x6C, 0x6F]); // H\0ello
      expect(validateContentType(data, "text/plain")).toBe(false);
    });

    it("rejects binary content declared as text", () => {
      const data = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
      expect(validateContentType(data, "text/plain")).toBe(false);
    });

    it("accepts valid JSON", () => {
      const data = new TextEncoder().encode('{"key": "value"}');
      expect(validateContentType(data, "application/json")).toBe(true);
    });

    it("rejects invalid JSON", () => {
      const data = new TextEncoder().encode("{invalid json}");
      expect(validateContentType(data, "application/json")).toBe(false);
    });

    it("rejects JSON that doesn't start with { or [", () => {
      const data = new TextEncoder().encode("true");
      expect(validateContentType(data, "application/json")).toBe(false);
    });

    it("rejects unknown binary content declared as PDF", () => {
      const data = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      expect(validateContentType(data, "application/pdf")).toBe(false);
    });
  });

  describe("formatFileSize", () => {
    it("formats bytes", () => {
      expect(formatFileSize(500)).toBe("500 B");
    });

    it("formats kilobytes", () => {
      expect(formatFileSize(2048)).toBe("2.0 KB");
    });

    it("formats megabytes", () => {
      expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
    });
  });
});
