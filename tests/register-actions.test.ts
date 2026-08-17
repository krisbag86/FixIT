import { describe, expect, it } from "vitest";

describe("registration", () => {
  it("does not create accounts without verified email ownership", async () => {
    const { registerAction } = await import("@/app/register/actions");
    const formData = new FormData();
    formData.set("name", "Jan Kowalski");
    formData.set("email", "jan.kowalski@bagietka.pl");
    formData.set("password", "StrongPassword123!");
    formData.set("confirmPassword", "StrongPassword123!");

    await expect(registerAction(undefined, formData)).resolves.toContain("Rejestracja jest wyłączona");
  });
});
