import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findAttachment, findTicket } from "@/lib/data-store";
import { canViewTicket } from "@/lib/permissions";
import { isValidStorageKey, readAttachmentFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  }

  const { id } = await params;
  const attachment = await findAttachment(id);

  if (!attachment) {
    return NextResponse.json({ error: "Nie znaleziono pliku." }, { status: 404 });
  }

  const ticket = await findTicket(attachment.ticketId);

  if (!ticket) {
    return NextResponse.json({ error: "Nie znaleziono zgłoszenia." }, { status: 404 });
  }

  if (!canViewTicket(user, ticket)) {
    return NextResponse.json({ error: "Brak dostępu do tego pliku." }, { status: 403 });
  }

  if (!isValidStorageKey(attachment.storageKey)) {
    return NextResponse.json({ error: "Nieprawidłowy klucz pliku." }, { status: 500 });
  }

  try {
    const data = await readAttachmentFile(attachment.storageKey);
    const safeName = attachment.filename.replace(/"/g, "");
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": String(attachment.size),
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=0, must-revalidate"
      }
    });
  } catch (error) {
    console.error("Attachment read failed:", error);
    return NextResponse.json({ error: "Nie udało się odczytać pliku." }, { status: 500 });
  }
}
