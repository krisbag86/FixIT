import "server-only";

import { getPrisma, id, readDatabase, shouldUsePrisma, withDatabase } from "@/lib/data-store-core";
import { mapMacro, mapTemplate } from "@/lib/data-store-mappers";
import type { ResponseMacro, ResponseTemplate, TicketPriority, TicketStatus } from "@/lib/types";

export async function listTemplates(): Promise<ResponseTemplate[]> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const templates = await db.responseTemplate.findMany({
      orderBy: { name: "asc" }
    });
    return templates.map(mapTemplate);
  }

  const database = await readDatabase();
  return [...database.responseTemplates].sort((a, b) => a.name.localeCompare(b.name));
}

export async function createTemplate(input: {
  name: string;
  body: string;
  category?: string;
  createdById: string;
}): Promise<ResponseTemplate> {
  const timestamp = new Date().toISOString();

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const template = await db.responseTemplate.create({
      data: {
        name: input.name,
        body: input.body,
        category: input.category,
        isActive: true,
        createdById: input.createdById
      }
    });
    return mapTemplate(template);
  }

  return withDatabase((database) => {
    const template: ResponseTemplate = {
      id: id("tpl"),
      name: input.name,
      body: input.body,
      category: input.category ?? undefined,
      isActive: true,
      createdById: input.createdById,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    database.responseTemplates.push(template);
    return template;
  });
}

export async function updateTemplate(input: {
  id: string;
  name: string;
  body: string;
  category?: string;
  isActive: boolean;
}): Promise<ResponseTemplate | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const existing = await db.responseTemplate.findUnique({ where: { id: input.id } });
    if (!existing) return undefined;

    const template = await db.responseTemplate.update({
      where: { id: input.id },
      data: {
        name: input.name,
        body: input.body,
        category: input.category,
        isActive: input.isActive
      }
    });
    return mapTemplate(template);
  }

  return withDatabase((database) => {
    const template = database.responseTemplates.find((item) => item.id === input.id);
    if (!template) return undefined;

    template.name = input.name;
    template.body = input.body;
    template.category = input.category ?? undefined;
    template.isActive = input.isActive;
    template.updatedAt = new Date().toISOString();
    return template;
  });
}

export async function deleteTemplate(id: string): Promise<boolean> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const template = await db.responseTemplate.findUnique({ where: { id } });
    if (!template) return false;
    await db.responseTemplate.delete({ where: { id } });
    return true;
  }

  return withDatabase((database) => {
    const index = database.responseTemplates.findIndex((template) => template.id === id);
    if (index === -1) return false;
    database.responseTemplates.splice(index, 1);
    return true;
  });
}

export async function listMacros(): Promise<ResponseMacro[]> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const macros = await db.responseMacro.findMany({
      orderBy: { name: "asc" }
    });
    return macros.map(mapMacro);
  }

  const database = await readDatabase();
  return [...database.responseMacros].sort((a, b) => a.name.localeCompare(b.name));
}

export async function createMacro(input: {
  name: string;
  templateId?: string;
  body?: string;
  newStatus?: TicketStatus;
  newPriority?: TicketPriority;
  createdById: string;
}): Promise<ResponseMacro> {
  const timestamp = new Date().toISOString();

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const macro = await db.responseMacro.create({
      data: {
        name: input.name,
        templateId: input.templateId,
        body: input.body,
        newStatus: input.newStatus,
        newPriority: input.newPriority,
        isActive: true,
        createdById: input.createdById
      }
    });
    return mapMacro(macro);
  }

  return withDatabase((database) => {
    const macro: ResponseMacro = {
      id: id("macro"),
      name: input.name,
      templateId: input.templateId ?? undefined,
      body: input.body ?? undefined,
      newStatus: input.newStatus ?? undefined,
      newPriority: input.newPriority ?? undefined,
      isActive: true,
      createdById: input.createdById,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    database.responseMacros.push(macro);
    return macro;
  });
}

export async function updateMacro(input: {
  id: string;
  name: string;
  templateId?: string;
  body?: string;
  newStatus?: TicketStatus;
  newPriority?: TicketPriority;
  isActive: boolean;
}): Promise<ResponseMacro | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const existing = await db.responseMacro.findUnique({ where: { id: input.id } });
    if (!existing) return undefined;

    const macro = await db.responseMacro.update({
      where: { id: input.id },
      data: {
        name: input.name,
        templateId: input.templateId,
        body: input.body,
        newStatus: input.newStatus,
        newPriority: input.newPriority,
        isActive: input.isActive
      }
    });
    return mapMacro(macro);
  }

  return withDatabase((database) => {
    const macro = database.responseMacros.find((item) => item.id === input.id);
    if (!macro) return undefined;

    macro.name = input.name;
    macro.templateId = input.templateId ?? undefined;
    macro.body = input.body ?? undefined;
    macro.newStatus = input.newStatus ?? undefined;
    macro.newPriority = input.newPriority ?? undefined;
    macro.isActive = input.isActive;
    macro.updatedAt = new Date().toISOString();
    return macro;
  });
}

export async function deleteMacro(id: string): Promise<boolean> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const macro = await db.responseMacro.findUnique({ where: { id } });
    if (!macro) return false;
    await db.responseMacro.delete({ where: { id } });
    return true;
  }

  return withDatabase((database) => {
    const index = database.responseMacros.findIndex((macro) => macro.id === id);
    if (index === -1) return false;
    database.responseMacros.splice(index, 1);
    return true;
  });
}
