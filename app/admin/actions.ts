"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  createCategoryAdmin,
  createStoreAdmin,
  deleteCategoryAdmin,
  deleteStoreAdmin,
  listStoresAdmin,
  updateCategoryAdmin,
  updateStoreAdmin,
  updateUserAdmin
} from "@/lib/data-store";
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

const storeSchema = z.object({
  code: z.string().min(3).max(20).regex(/^[A-Z0-9_-]+$/),
  name: z.string().min(3).max(120),
  city: z.string().max(80),
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
    throw new Error("Brak uprawnien administracyjnych.");
  }

  return user;
}

function normalizeOptionalText(value: FormDataEntryValue | null): string | undefined {
  const normalized = String(value ?? "").trim();
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
    throw new Error("Nie mozesz odebrac sobie roli administratora ani dezaktywowac swojego konta.");
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

export async function createStoreAdminAction(formData: FormData): Promise<void> {
  const actor = await requireAdminAction("admin:manage-stores");

  const input = storeSchema.parse({
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    name: String(formData.get("name") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    region: String(formData.get("region") ?? "").trim(),
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
    name: String(formData.get("name") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    region: String(formData.get("region") ?? "").trim(),
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
    name: String(formData.get("name") ?? "").trim(),
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
    name: String(formData.get("name") ?? "").trim(),
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
