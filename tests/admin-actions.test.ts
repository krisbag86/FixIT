import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/lib/types";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

const adminUser: User = {
  id: "usr_admin",
  name: "Admin",
  email: "admin@bagietka.pl",
  role: "ADMIN",
  isActive: true
};

const invitedUser: User = {
  id: "usr_new",
  name: "Nowy Technik",
  email: "technik@bagietka.pl",
  role: "AGENT",
  isActive: true,
  passwordHash: "hash:TempPass123!",
  mustChangePassword: true
};

function makeCreateUserForm(): FormData {
  const formData = new FormData();
  formData.set("name", invitedUser.name);
  formData.set("email", invitedUser.email);
  formData.set("role", invitedUser.role);
  formData.set("isActive", "on");
  formData.set("sendInvite", "on");
  return formData;
}

function installActionMocks(sendResult: { ok: boolean; error?: string }, existingUser: User | undefined = invitedUser) {
  const dataStoreMock = {
    createCategoryAdmin: vi.fn(),
    createStoreAdmin: vi.fn(),
    createUser: vi.fn(async (input: Partial<User>) => ({
      ...invitedUser,
      ...input,
      id: invitedUser.id
    })),
    deleteCategoryAdmin: vi.fn(),
    deleteStoreAdmin: vi.fn(),
    updateCategoryAdmin: vi.fn(),
    updateStoreAdmin: vi.fn(),
    updateUserAdmin: vi.fn(),
    deleteUserAdmin: vi.fn(async () => true),
    createTemplate: vi.fn(),
    createMacro: vi.fn(),
    deleteTemplate: vi.fn(),
    deleteMacro: vi.fn(),
    updateTemplate: vi.fn(),
    updateMacro: vi.fn(),
    listStoresAdmin: vi.fn(async () => []),
    findUserById: vi.fn(async () => existingUser)
  };
  const sendEmailWithResult = vi.fn(async () => sendResult);
  const createSetupToken = vi.fn(async () => "setup-token");

  vi.doMock("@/lib/auth", () => ({
    requireUser: vi.fn(async () => adminUser)
  }));
  vi.doMock("@/lib/data-store", () => dataStoreMock);
  vi.doMock("@/lib/email", () => ({
    sendEmailWithResult
  }));
  vi.doMock("@/lib/setup-token", () => ({
    createSetupToken
  }));
  vi.doMock("@/lib/password", () => ({
    generateTemporaryPassword: () => "TempPass123!",
    hashPassword: (password: string) => `hash:${password}`
  }));

  return { dataStoreMock, sendEmailWithResult, createSetupToken };
}

describe("admin user invitation actions", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.APP_URL = "https://fixit.example";
  });

  afterEach(() => {
    vi.doUnmock("@/lib/auth");
    vi.doUnmock("@/lib/data-store");
    vi.doUnmock("@/lib/email");
    vi.doUnmock("@/lib/setup-token");
    vi.doUnmock("@/lib/password");
    delete process.env.APP_URL;
  });

  it("returns a fallback activation link when the create-user invite email fails", async () => {
    const { sendEmailWithResult } = installActionMocks({
      ok: false,
      error: "SMTP configuration incomplete"
    });
    const { createUserAdminAction } = await import("@/app/admin/actions");

    const result = await createUserAdminAction({ status: "idle" }, makeCreateUserForm());

    expect(result.status).toBe("success");
    expect(result.inviteSent).toBe(false);
    expect(result.inviteError).toBe("SMTP configuration incomplete");
    expect(result.activationLink).toBe("https://fixit.example/setup/setup-token");
    expect(sendEmailWithResult).toHaveBeenCalledWith(
      expect.objectContaining({
        to: invitedUser.email,
        subject: expect.stringContaining("FixIT")
      })
    );
  });

  it("regenerates an activation link for an existing user when resend email fails", async () => {
    const { createSetupToken } = installActionMocks({
      ok: false,
      error: "SMTP authentication failed"
    });
    const { resendUserInviteAdminAction } = await import("@/app/admin/actions");
    const formData = new FormData();
    formData.set("id", invitedUser.id);

    const result = await resendUserInviteAdminAction({ status: "idle" }, formData);

    expect(createSetupToken).toHaveBeenCalledWith(invitedUser.email);
    expect(result.status).toBe("error");
    expect(result.inviteSent).toBe(false);
    expect(result.inviteError).toBe("SMTP authentication failed");
    expect(result.activationLink).toBe("https://fixit.example/setup/setup-token");
  });

  it("deletes a user through the admin action", async () => {
    const { dataStoreMock } = installActionMocks({ ok: true });
    const { deleteUserAdminAction } = await import("@/app/admin/actions");
    const formData = new FormData();
    formData.set("id", invitedUser.id);

    const result = await deleteUserAdminAction({ status: "idle" }, formData);

    expect(result.status).toBe("success");
    expect(dataStoreMock.deleteUserAdmin).toHaveBeenCalledWith({
      userId: invitedUser.id,
      actorId: adminUser.id
    });
  });
});
