import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createAttachment, findTicket, listComments } from "@/lib/data-store";
import { can, canViewTicket } from "@/lib/permissions";
import { readRequestBody, RequestBodyTooLargeError } from "@/lib/request-body";
import { deleteAttachmentFile, saveAttachmentFile, UploadValidationError } from "@/lib/storage";
import { MAX_FILE_SIZE } from "@/lib/storage-utils";

export const dynamic = "force-dynamic";
const MAX_MULTIPART_OVERHEAD = 256 * 1024;
const MAX_UPLOAD_REQUEST_SIZE = MAX_FILE_SIZE + MAX_MULTIPART_OVERHEAD;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  }

  if (user.mustChangePassword) {
    return NextResponse.json({ error: "Najpierw ustaw nowe hasło." }, { status: 403 });
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
    const body = await readRequestBody(request, MAX_UPLOAD_REQUEST_SIZE);
    const uploadBody = new ArrayBuffer(body.byteLength);
    new Uint8Array(uploadBody).set(body);
    formData = await new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: uploadBody
    }).formData();
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: `Żądanie przekracza limit ${MAX_FILE_SIZE / 1024 / 1024} MB dla pliku.` }, { status: 413 });
    }
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

  if (safeCommentId) {
    if (safeCommentId.length > 128) {
      return NextResponse.json({ error: "Nieprawidłowy identyfikator komentarza." }, { status: 400 });
    }
    const comment = (await listComments(ticket.id, true)).find((item) => item.id === safeCommentId);
    if (!comment) {
      return NextResponse.json({ error: "Komentarz nie należy do tego zgłoszenia." }, { status: 400 });
    }
    if (comment.visibility === "INTERNAL" && !can(user, "comment:internal")) {
      return NextResponse.json({ error: "Brak dostępu do tego komentarza." }, { status: 403 });
    }
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    const saved = await saveAttachmentFile(data, file.name || "plik", file.type || "application/octet-stream");

    let attachment: Awaited<ReturnType<typeof createAttachment>>;
    try {
      attachment = await createAttachment({
        ticketId: ticket.id,
        commentId: safeCommentId,
        filename: saved.filename,
        mimeType: saved.mimeType,
        size: saved.size,
        storageKey: saved.storageKey,
        uploadedById: user.id
      });
    } catch (error) {
      await deleteAttachmentFile(saved.storageKey).catch((cleanupError) => {
        console.error("Attachment cleanup failed:", cleanupError);
      });
      throw error;
    }

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
