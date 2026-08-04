"use client";

import { Send } from "lucide-react";
import { useFormStatus } from "react-dom";

export function CreateTicketSubmit() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-mint px-5 font-black text-white transition hover:bg-mint/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      <Send size={18} />
      {pending ? "Tworzenie zgłoszenia..." : "Utwórz zgłoszenie"}
    </button>
  );
}
