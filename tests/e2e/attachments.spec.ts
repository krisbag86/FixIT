import { test, expect } from "@playwright/test";
import { loginAs, resetDatabase } from "./helpers";

test.beforeEach(() => {
  resetDatabase();
});

test("reporter can upload and download a text attachment on an accessible ticket", async ({ page }) => {
  await loginAs(page, "kasjer@bagietka.pl");
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
