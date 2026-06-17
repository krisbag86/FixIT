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
  updateCategoryAdmin,
  updateStoreAdmin,
  updateUserAdmin,
  createTemplate,
  createMacro,
  deleteTemplate,
  deleteMacro,
  updateTemplate,
  updateMacro,
  listStoresAdmin
} from "@/lib/data-store";
import { sendEmailWithResult } from "@/lib/email";
import { templateUserInvitation } from "@/lib/email-templates";
import { normalizeEmail, isAllowedBagietkaEmail } from "@/lib/email-domain";
import { sanitizeText } from "@/lib/escape-html";
import { generateTemporaryPassword, hashPassword } from "@/lib/password";
import { can } from "@/lib/permissions";
import { createSetupToken } from "@/lib/setup-token";

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

const templateSchema = z.object({
  name: z.string().min(3).max(120),
  body: z.string().min(1),
  category: z.string().max(120).optional(),
  isActive: z.boolean()
});

const updateTemplateSchema = templateSchema.extend({
  id: z.string().min(1)
});

const macroSchema = z.object({
  name: z.string().min(3).max(120),
  templateId: z.string().optional(),
  body: z.string().optional(),
  newStatus: z.enum(["NEW", "TRIAGED", "IN_PROGRESS", "WAITING_FOR_USER", "WAITING_FOR_VENDOR", "RESOLVED", "CLOSED", "CANCELLED"]).optional(),
  newPriority: prioritySchema.optional(),
  isActive: z.boolean()
});

const updateMacroSchema = macroSchema.extend({
  id: z.string().min(1)
});

async function requireAdminAction(
  permission: "admin:manage-users" | "admin:manage-stores" | "admin:manage-categories" | "admin:manage-templates"
) {
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

    // Generate a one-time setup token so the user can set their password
    // via a secure link instead of receiving it in plain text via email.
    const setupToken = input.sendInvite ? await createSetupToken(user.email) : undefined;

    let inviteSent = false;
    let message = `Utworzono konto dla ${user.email}.`;

    if (input.sendInvite) {
      const template = templateUserInvitation(user, temporaryPassword, setupToken);
      const result = await sendEmailWithResult({
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text
      });

      inviteSent = result.ok;
      message = result.ok
        ? `${message} Wiadomosc z linkiem aktywacyjnym zostala wyslana.`
        : `${message} Nie udalo sie wyslac e-maila z linkiem aktywacyjnym.`;
    }

    revalidatePath("/admin/users");
    revalidatePath("/admin/tickets");

    return {
      status: "success",
      message,
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

export async function createTemplateAdminAction(formData: FormData): Promise<void> {
  const actor = await requireAdminAction("admin:manage-templates");

  const input = templateSchema.parse({
    name: sanitizeText(String(formData.get("name") ?? "")),
    body: sanitizeText(String(formData.get("body") ?? "")),
    category: normalizeOptionalText(formData.get("category")),
    isActive: formData.get("isActive") === "on"
  });

  await createTemplate({
    ...input,
    createdById: actor.id
  });
  revalidatePath("/admin/templates");
}

export async function updateTemplateAdminAction(formData: FormData): Promise<void> {
  await requireAdminAction("admin:manage-templates");

  const input = updateTemplateSchema.parse({
    id: String(formData.get("id") ?? ""),
    name: sanitizeText(String(formData.get("name") ?? "")),
    body: sanitizeText(String(formData.get("body") ?? "")),
    category: normalizeOptionalText(formData.get("category")),
    isActive: formData.get("isActive") === "on"
  });

  await updateTemplate(input);
  revalidatePath("/admin/templates");
}

export async function deleteTemplateAdminAction(formData: FormData): Promise<void> {
  await requireAdminAction("admin:manage-templates");
  const id = String(formData.get("id") ?? "");

  if (!id) {
    throw new Error("Brak identyfikatora szablonu.");
  }

  await deleteTemplate(id);
  revalidatePath("/admin/templates");
}

export async function createMacroAdminAction(formData: FormData): Promise<void> {
  const actor = await requireAdminAction("admin:manage-templates");

  const input = macroSchema.parse({
    name: sanitizeText(String(formData.get("name") ?? "")),
    templateId: normalizeOptionalText(formData.get("templateId")),
    body: normalizeOptionalText(formData.get("body")),
    newStatus: normalizeOptionalText(formData.get("newStatus")) as
      | "NEW"
      | "TRIAGED"
      | "IN_PROGRESS"
      | "WAITING_FOR_USER"
      | "WAITING_FOR_VENDOR"
      | "RESOLVED"
      | "CLOSED"
      | "CANCELLED"
      | undefined,
    newPriority: normalizeOptionalText(formData.get("newPriority")) as "LOW" | "NORMAL" | "HIGH" | "CRITICAL" | undefined,
    isActive: formData.get("isActive") === "on"
  });

  await createMacro({
    ...input,
    createdById: actor.id
  });
  revalidatePath("/admin/templates");
}

export async function updateMacroAdminAction(formData: FormData): Promise<void> {
  await requireAdminAction("admin:manage-templates");

  const input = updateMacroSchema.parse({
    id: String(formData.get("id") ?? ""),
    name: sanitizeText(String(formData.get("name") ?? "")),
    templateId: normalizeOptionalText(formData.get("templateId")),
    body: normalizeOptionalText(formData.get("body")),
    newStatus: normalizeOptionalText(formData.get("newStatus")) as
      | "NEW"
      | "TRIAGED"
      | "IN_PROGRESS"
      | "WAITING_FOR_USER"
      | "WAITING_FOR_VENDOR"
      | "RESOLVED"
      | "CLOSED"
      | "CANCELLED"
      | undefined,
    newPriority: normalizeOptionalText(formData.get("newPriority")) as "LOW" | "NORMAL" | "HIGH" | "CRITICAL" | undefined,
    isActive: formData.get("isActive") === "on"
  });

  await updateMacro(input);
  revalidatePath("/admin/templates");
}

export async function deleteMacroAdminAction(formData: FormData): Promise<void> {
  await requireAdminAction("admin:manage-templates");
  const id = String(formData.get("id") ?? "");

  if (!id) {
    throw new Error("Brak identyfikatora makra.");
  }

  await deleteMacro(id);
  revalidatePath("/admin/templates");
}
