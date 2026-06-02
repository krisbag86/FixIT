"use client";

import { Paperclip, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { formatFileSize } from "@/lib/storage-utils";
import type { TicketAttachment } from "@/lib/types";

type PendingFile = {
  stringId: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
  result?: { id: string; filename: string; mimeType: string; size: number; createdAt: string };
};

type ExistingAttachment = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

export function AttachmentUpload({
  ticketId,
  initialAttachments = [],
  readOnly = false
}: {
  ticketId: string;
  initialAttachments?: TicketAttachment[];
  readOnly?: boolean;
}) {
  const [existing, setExisting] = useState<ExistingAttachment[]>(
    initialAttachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      createdAt: a.createdAt
    }))
  );
  const [pending, setPending] = useState<PendingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function makeStringId(): string {
    return `f_${Math.random().toString(36).slice(2, 10)}`;
  }

  async function uploadFile(file: File, stringId: string): Promise<void> {
    setPending((current) =>
      current.map((p) => (p.stringId === stringId ? { ...p, status: "uploading", error: undefined } : p))
    );

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("stringId", stringId);

      const res = await fetch(`/api/attachments/ticket/${ticketId}`, {
        method: "POST",
        body: fd
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setPending((current) =>
          current.map((p) =>
            p.stringId === stringId ? { ...p, status: "error", error: body.error ?? "Blad uploadu" } : p
          )
        );
        return;
      }

      const data = (await res.json()) as {
        id: string;
        filename: string;
        mimeType: string;
        size: number;
        createdAt: string;
        stringId: string;
      };

      setPending((current) =>
        current.map((p) =>
          p.stringId === stringId
            ? { ...p, status: "done", result: { id: data.id, filename: data.filename, mimeType: data.mimeType, size: data.size, createdAt: data.createdAt } }
            : p
        )
      );
      setExisting((current) => [
        ...current,
        { id: data.id, filename: data.filename, mimeType: data.mimeType, size: data.size, createdAt: data.createdAt }
      ]);
    } catch (err) {
      setPending((current) =>
        current.map((p) =>
          p.stringId === stringId ? { ...p, status: "error", error: (err as Error).message } : p
        )
      );
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const newPending: PendingFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const stringId = makeStringId();
      newPending.push({ stringId, file, status: "pending" });
    }
    setPending((current) => [...current, ...newPending]);
    for (const p of newPending) {
      void uploadFile(p.file, p.stringId);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removePending(stringId: string) {
    setPending((current) => current.filter((p) => p.stringId !== stringId));
  }

  return (
    <div className="space-y-2" data-testid="attachment-upload">
      <div className="flex items-center gap-2 text-sm font-bold">
        <Paperclip size={16} className="text-mint" />
        Zalaczniki
      </div>

      {existing.length > 0 || pending.length > 0 ? (
        <ul className="space-y-1">
          {existing.map((att) => (
            <li
              key={att.id}
              data-testid="attachment-item"
              className="flex items-center gap-2 rounded-md border border-black/10 bg-paper/70 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            >
              <Paperclip size={14} className="shrink-0 text-mint" />
              <a
                href={`/api/attachments/${att.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate font-semibold text-ink hover:underline dark:text-paper"
                title={att.filename}
              >
                {att.filename}
              </a>
              <span className="shrink-0 text-xs text-ink/55 dark:text-paper/55">
                {formatFileSize(att.size)}
              </span>
            </li>
          ))}
          {pending.map((p) => (
            <li
              key={p.stringId}
              className="flex items-center gap-2 rounded-md border border-black/10 bg-paper/70 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            >
              <Paperclip size={14} className="shrink-0 text-ink/50 dark:text-paper/50" />
              <span className="flex-1 truncate">{p.file.name}</span>
              {p.status === "uploading" ? (
                <span className="shrink-0 text-xs text-ink/55 dark:text-paper/55">Wysylanie...</span>
              ) : p.status === "done" ? (
                <span className="shrink-0 text-xs font-bold text-green-700 dark:text-green-300">OK</span>
              ) : p.status === "error" ? (
                <span className="shrink-0 text-xs text-red-600 dark:text-red-400" title={p.error}>
                  Blad
                </span>
              ) : (
                <span className="shrink-0 text-xs text-ink/55 dark:text-paper/55">Oczekiwanie</span>
              )}
              <button
                type="button"
                onClick={() => removePending(p.stringId)}
                className="shrink-0 text-ink/40 hover:text-ink dark:text-paper/40 dark:hover:text-paper"
                aria-label="Usun"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {!readOnly ? (
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed border-black/20 bg-white/50 px-3 text-sm font-semibold text-ink/70 transition hover:bg-white/80 dark:border-white/20 dark:bg-white/5 dark:text-paper/70 dark:hover:bg-white/10">
          <Upload size={16} />
          Dodaj plik
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            data-testid="attachment-input"
          />
        </label>
      ) : null}
    </div>
  );
}
