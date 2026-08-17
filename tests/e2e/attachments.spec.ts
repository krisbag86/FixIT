import { test, expect } from "@playwright/test";
import { loginAs, resetDatabase } from "./helpers";

test.beforeEach(() => {
  resetDatabase();
});

test("IT can upload and download a text attachment on an accessible ticket", async ({ page }) => {
  await loginAs(page, "agent@bagietka.pl");
  await page.goto("/tickets/t_001");

  const filename = "e2e-note.txt";
  const uploadResponsePromise = page.waitForResponse((response) => response.url().includes("/api/attachments/ticket/t_001"));
  await page.getByTestId("attachment-input").setInputFiles({
    name: filename,
    mimeType: "text/plain",
    buffer: Buffer.from("Attachment created by Playwright.")
  });
  const uploadResponse = await uploadResponsePromise;
  expect(uploadResponse.status(), await uploadResponse.text()).toBe(200);

  const attachment = page.getByTestId("attachment-item").filter({ hasText: filename });
  await expect(attachment).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await attachment.getByRole("link", { name: filename }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(filename);
});

test("reporter cannot download an attachment on an internal note", async ({ page, context }) => {
  await loginAs(page, "agent@bagietka.pl");
  await page.goto("/admin/tickets/t_001");

  const commentForm = page.getByTestId("comment-form");
  await commentForm.locator('textarea[name="body"]').fill("Attachment authorization note");
  await commentForm.locator('select[name="visibility"]').selectOption("INTERNAL");
  await commentForm.getByRole("button", { name: "Dodaj" }).click();
  const comment = page.getByTestId("comment-item").filter({ hasText: "Attachment authorization note" });
  await expect(comment).toBeVisible();
  const commentId = await comment.getAttribute("data-comment-id");
  expect(commentId).toBeTruthy();

  const upload = await page.request.post("/api/attachments/ticket/t_001", {
    headers: { Origin: "http://localhost:3000" },
    multipart: {
      file: { name: "internal-note.txt", mimeType: "text/plain", buffer: Buffer.from("internal") },
      commentId: commentId ?? ""
    }
  });
  expect(upload.status(), await upload.text()).toBe(200);
  const attachment = (await upload.json()) as { id: string };

  await loginAs(page, "kasjer@bagietka.pl");
  const download = await page.request.get(`/api/attachments/${attachment.id}`);
  expect(download.status(), await download.text()).toBe(403);
  await context.pages()[0].waitForLoadState("domcontentloaded");
});
