import { describe, expect, it } from "vitest";
import { readRequestBody, RequestBodyTooLargeError } from "@/lib/request-body";

describe("bounded request bodies", () => {
  it("reads bodies that fit within the configured limit", async () => {
    const request = new Request("https://fixit.test/upload", {
      method: "POST",
      body: "bounded"
    });

    const body = await readRequestBody(request, 16);
    expect(new TextDecoder().decode(body)).toBe("bounded");
  });

  it("rejects an oversized declared content length before reading", async () => {
    const request = new Request("https://fixit.test/upload", {
      method: "POST",
      headers: { "content-length": "100" },
      body: "small"
    });

    await expect(readRequestBody(request, 16)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it("rejects chunked bodies once the streamed bytes exceed the limit", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("12345678"));
        controller.enqueue(new TextEncoder().encode("90"));
        controller.close();
      }
    });
    const request = new Request("https://fixit.test/upload", {
      method: "POST",
      body: stream,
      duplex: "half"
    } as RequestInit & { duplex: "half" });

    await expect(readRequestBody(request, 8)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });
});
