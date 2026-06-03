import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createAttachment, findTicket } from "@/lib/data-store";
import { can, canViewTicket } from "@/lib/permissions";
import { saveAttachmentFile, UploadValidationError } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  }

  if (!can(user, "ticket:view")) {
    return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
  }

  const { ticketId } = await params;
  const ticket = await findTicket(ticketId);

  if (!ticket) {
    return NextResponse.json({ error: "Nie znaleziono zgłoszenia." }, { status: 404 });
  }

  if (!canViewTicket(user, ticket)) {
    return NextResponse.json({ error: "Brak dostępu do tego zgłoszenia." }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 400 });
  }

  const file = formData.get("file");
  const commentId = formData.get("commentId");
  const fileStringId = formData.get("stringId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nie przesłano pliku." }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "Plik jest pusty." }, { status: 400 });
  }

  const safeCommentId = typeof commentId === "string" && commentId.length > 0 ? commentId : undefined;
  const safeStringId = typeof fileStringId === "string" && fileStringId.length > 0 ? fileStringId : undefined;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    const saved = await saveAttachmentFile(data, file.name || "plik", file.type || "application/octet-stream");

    const attachment = await createAttachment({
      ticketId: ticket.id,
      commentId: safeCommentId,
      filename: saved.filename,
      mimeType: saved.mimeType,
      size: saved.size,
      storageKey: saved.storageKey,
      uploadedById: user.id
    });

    revalidatePath(`/tickets/${ticket.id}`);
    revalidatePath(`/admin/tickets/${ticket.id}`);

    return NextResponse.json({
      id: attachment.id,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      size: attachment.size,
      createdAt: attachment.createdAt,
      stringId: safeStringId
    });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Attachment upload failed:", error);
    return NextResponse.json({ error: "Nie udało się zapisać pliku." }, { status: 500 });
  }
}
