"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  createCategoryAdmin,
  createStoreAdmin,
  createUser,
  deleteCategoryAdmin,
  deleteStoreAdmin,
  listStoresAdmin,
  updateCategoryAdmin,
  updateStoreAdmin,
  updateUserAdmin
} from "@/lib/data-store";
import { sendEmailWithResult } from "@/lib/email";
import { templateUserInvitation } from "@/lib/email-templates";
import { normalizeEmail, isAllowedBagietkaEmail } from "@/lib/email-domain";
import { sanitizeText } from "@/lib/escape-html";
import { generateTemporaryPassword, hashPassword } from "@/lib/password";
import { can } from "@/lib/permissions";

const roleSchema = z.enum(["REPORTER", "STORE_MANAGER", "AGENT", "ADMIN"]);
const prioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]);

const userAdminSchema = z.object({
  id: z.string().min(1),
  role: roleSchema,
  storeId: z.string().optional(),
  department: z.string().max(120).optional(),
  isActive: z.boolean()
});

const createUserSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  role: roleSchema,
  storeId: z.string().optional(),
  department: z.string().max(120).optional(),
  isActive: z.boolean(),
  sendInvite: z.boolean()
});

const storeSchema = z.object({
  code: z.string().min(3).max(20).regex(/^[A-Z0-9_-]+$/),
  name: z.string().min(3).max(120),
  city: z.string().max(80),
  address: z.string().max(200),
  region: z.string().max(80),
  isActive: z.boolean()
});

const updateStoreSchema = storeSchema.extend({
  id: z.string().min(1)
});

const categorySchema = z.object({
  name: z.string().min(3).max(120),
  defaultPriority: prioritySchema,
  isActive: z.boolean()
});

const updateCategorySchema = categorySchema.extend({
  id: z.string().min(1)
});

async function requireAdminAction(permission: "admin:manage-users" | "admin:manage-stores" | "admin:manage-categories") {
  const user = await requireUser();

  if (!can(user, permission)) {
    throw new Error("Brak uprawnień administracyjnych.");
  }

  return user;
}

function normalizeOptionalText(value: FormDataEntryValue | null): string | undefined {
  const normalized = sanitizeText(String(value ?? ""));
  return normalized.length > 0 ? normalized : undefined;
}

async function assertStoreExists(storeId: string | undefined): Promise<void> {
  if (!storeId) {
    return;
  }

  const stores = await listStoresAdmin({ includeInactive: true });
  if (!stores.some((store) => store.id === storeId)) {
    throw new Error("Wybrany sklep nie istnieje.");
  }
}

export type CreateUserAdminState = {
  status: "idle" | "success" | "error";
  message?: string;
  temporaryPassword?: string;
  createdEmail?: string;
  inviteSent?: boolean;
};

export async function updateUserAdminAction(formData: FormData): Promise<void> {
  const actor = await requireAdminAction("admin:manage-users");

  const input = userAdminSchema.parse({
    id: String(formData.get("id") ?? ""),
    role: String(formData.get("role") ?? "REPORTER"),
    storeId: normalizeOptionalText(formData.get("storeId")),
    department: normalizeOptionalText(formData.get("department")),
    isActive: formData.get("isActive") === "on"
  });

  if (input.id === actor.id && (input.role !== actor.role || !input.isActive)) {
    throw new Error("Nie możesz odebrać sobie roli administratora ani dezaktywować swojego konta.");
  }

  if (input.role === "STORE_MANAGER" && !input.storeId) {
    throw new Error("Kierownik sklepu musi miec przypisany sklep.");
  }

  await assertStoreExists(input.storeId);

  await updateUserAdmin({
    userId: input.id,
    role: input.role,
    storeId: input.role === "AGENT" || input.role === "ADMIN" ? undefined : input.storeId,
    department: input.department,
    isActive: input.isActive,
    actorId: actor.id
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/tickets");
}

export async function createUserAdminAction(
  _previousState: CreateUserAdminState,
  formData: FormData
): Promise<CreateUserAdminState> {
  try {
    const actor = await requireAdminAction("admin:manage-users");

    const input = createUserSchema.parse({
      name: sanitizeText(String(formData.get("name") ?? "")),
      email: normalizeEmail(String(formData.get("email") ?? "")),
      role: String(formData.get("role") ?? "REPORTER"),
      storeId: normalizeOptionalText(formData.get("storeId")),
      department: normalizeOptionalText(formData.get("department")),
      isActive: formData.get("isActive") === "on",
      sendInvite: formData.get("sendInvite") === "on"
    });

    if (!isAllowedBagietkaEmail(input.email)) {
      return {
        status: "error",
        message: "Podaj służbowy adres w domenie bagietka.pl."
      };
    }

    if (input.role === "STORE_MANAGER" && !input.storeId) {
      return {
        status: "error",
        message: "Kierownik sklepu musi mieć przypisany sklep."
      };
    }

    await assertStoreExists(input.storeId);

    const temporaryPassword = generateTemporaryPassword();
    const user = await createUser({
      name: input.name,
      email: input.email,
      role: input.role,
      storeId: input.role === "AGENT" || input.role === "ADMIN" ? undefined : input.storeId,
      department: input.department,
      isActive: input.isActive,
      passwordHash: hashPassword(temporaryPassword),
      mustChangePassword: true,
      actorId: actor.id
    });

    let inviteSent = false;
    let message = `Utworzono konto dla ${user.email}.`;

    if (input.sendInvite) {
      const template = templateUserInvitation(user, temporaryPassword);
      const result = await sendEmailWithResult({
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text
      });

      inviteSent = result.ok;
      message = result.ok
        ? `${message} Wiadomosc z danymi logowania zostala wyslana.`
        : `${message} Nie udalo sie wyslac e-maila z danymi logowania.`;
    }

    revalidatePath("/admin/users");
    revalidatePath("/admin/tickets");

    return {
      status: "success",
      message,
      temporaryPassword,
      createdEmail: user.email,
      inviteSent
    };
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Nie udalo sie utworzyc uzytkownika."
        : error instanceof Error
          ? error.message
          : "Nie udalo sie utworzyc uzytkownika.";

    return {
      status: "error",
      message
    };
  }
}

export async function createStoreAdminAction(formData: FormData): Promise<void> {
  const actor = await requireAdminAction("admin:manage-stores");

  const input = storeSchema.parse({
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    name: sanitizeText(String(formData.get("name") ?? "")),
    city: sanitizeText(String(formData.get("city") ?? "")),
    address: sanitizeText(String(formData.get("address") ?? "")),
    region: sanitizeText(String(formData.get("region") ?? "")),
    isActive: formData.get("isActive") === "on"
  });

  await createStoreAdmin({ ...input, actorId: actor.id });
  revalidatePath("/admin/stores");
  revalidatePath("/tickets/new");
}

export async function updateStoreAdminAction(formData: FormData): Promise<void> {
  const actor = await requireAdminAction("admin:manage-stores");

  const input = updateStoreSchema.parse({
    id: String(formData.get("id") ?? ""),
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    name: sanitizeText(String(formData.get("name") ?? "")),
    city: sanitizeText(String(formData.get("city") ?? "")),
    address: sanitizeText(String(formData.get("address") ?? "")),
    region: sanitizeText(String(formData.get("region") ?? "")),
    isActive: formData.get("isActive") === "on"
  });

  await updateStoreAdmin({ ...input, actorId: actor.id });
  revalidatePath("/admin/stores");
  revalidatePath("/tickets/new");
}

export async function deleteStoreAdminAction(formData: FormData): Promise<void> {
  const actor = await requireAdminAction("admin:manage-stores");
  const id = String(formData.get("id") ?? "");

  if (!id) {
    throw new Error("Brak identyfikatora sklepu.");
  }

  await deleteStoreAdmin(id, actor.id);
  revalidatePath("/admin/stores");
  revalidatePath("/tickets/new");
}

export async function createCategoryAdminAction(formData: FormData): Promise<void> {
  const actor = await requireAdminAction("admin:manage-categories");

  const input = categorySchema.parse({
    name: sanitizeText(String(formData.get("name") ?? "")),
    defaultPriority: String(formData.get("defaultPriority") ?? "NORMAL"),
    isActive: formData.get("isActive") === "on"
  });

  await createCategoryAdmin({ ...input, actorId: actor.id });
  revalidatePath("/admin/categories");
  revalidatePath("/tickets/new");
  revalidatePath("/knowledge");
}

export async function updateCategoryAdminAction(formData: FormData): Promise<void> {
  const actor = await requireAdminAction("admin:manage-categories");

  const input = updateCategorySchema.parse({
    id: String(formData.get("id") ?? ""),
    name: sanitizeText(String(formData.get("name") ?? "")),
    defaultPriority: String(formData.get("defaultPriority") ?? "NORMAL"),
    isActive: formData.get("isActive") === "on"
  });

  await updateCategoryAdmin({ ...input, actorId: actor.id });
  revalidatePath("/admin/categories");
  revalidatePath("/tickets/new");
  revalidatePath("/knowledge");
}

export async function deleteCategoryAdminAction(formData: FormData): Promise<void> {
  const actor = await requireAdminAction("admin:manage-categories");
  const id = String(formData.get("id") ?? "");

  if (!id) {
    throw new Error("Brak identyfikatora kategorii.");
  }

  await deleteCategoryAdmin(id, actor.id);
  revalidatePath("/admin/categories");
  revalidatePath("/tickets/new");
  revalidatePath("/knowledge");
}
