import { describe, expect, it } from "vitest";
import {
  ALLOWED_MIME_PREFIXES,
  formatFileSize,
  isAllowedMimeType,
  isValidStorageKey,
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
