import "server-only";

import { mapAttachment } from "@/lib/data-store-mappers";
import { getPrisma, id, now, readDatabase, shouldUsePrisma, withDatabase } from "@/lib/data-store-core";
import type { TicketAttachment } from "@/lib/types";

export async function listAttachments(ticketId: string): Promise<TicketAttachment[]> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const attachments = await db.ticketAttachment.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" }
    });
    return attachments.map(mapAttachment);
  }

  const database = await readDatabase();
  return database.attachments
    .filter((attachment) => attachment.ticketId === ticketId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function findAttachment(id: string): Promise<TicketAttachment | undefined> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const attachment = await db.ticketAttachment.findUnique({ where: { id } });
    return attachment ? mapAttachment(attachment) : undefined;
  }

  const database = await readDatabase();
  return database.attachments.find((attachment) => attachment.id === id);
}

export async function createAttachment(input: {
  ticketId: string;
  commentId?: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  uploadedById: string;
}): Promise<TicketAttachment> {
  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const attachment = await db.ticketAttachment.create({
      data: {
        ticketId: input.ticketId,
        commentId: input.commentId,
        filename: input.filename,
        mimeType: input.mimeType,
        size: input.size,
        storageKey: input.storageKey,
        uploadedById: input.uploadedById
      }
    });
    return mapAttachment(attachment);
  }

  return withDatabase((database) => {
    const attachment: TicketAttachment = {
      id: id("att"),
      ticketId: input.ticketId,
      commentId: input.commentId,
      filename: input.filename,
      mimeType: input.mimeType,
      size: input.size,
      storageKey: input.storageKey,
      uploadedById: input.uploadedById,
      createdAt: now()
    };
    database.attachments.push(attachment);
    return attachment;
  });
}
