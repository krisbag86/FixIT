import type { Ticket } from "@/lib/types";
import { priorityLabels, statusLabels } from "@/lib/labels";

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(options: { heading: string; lines: string[]; cta?: { label: string; url: string } }): string {
  const paragraphs = options.lines
    .map((line) => `<p style="margin:0 0 12px;color:#334155;font-size:15px;line-height:1.6;">${line}</p>`)
    .join("");

  const button = options.cta
    ? `<p style="margin:24px 0 8px;"><a href="${escapeHtml(options.cta.url)}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;font-size:15px;">${escapeHtml(options.cta.label)}</a></p>`
    : "";

  return `<!doctype html>
<html lang="pl">
  <body style="margin:0;background:#f1f5f9;padding:24px;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="background:#0f172a;padding:20px 28px;">
                <span style="color:#ffffff;font-size:18px;font-weight:800;">FixIT</span>
                <span style="color:#94a3b8;font-size:13px;margin-left:8px;">Helpdesk IT Bagietka</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 16px;color:#0f172a;font-size:20px;">${escapeHtml(options.heading)}</h1>
                ${paragraphs}
                ${button}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">Wiadomosc wyslana automatycznie przez FixIT. Prosimy na nia nie odpowiadac.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function ticketMeta(ticket: Ticket): string {
  return `${ticket.number} | status: ${statusLabels[ticket.status]} | priorytet: ${priorityLabels[ticket.priority]}`;
}

export function magicLinkEmail(input: { url: string; ttlMinutes: number; isNewAccount: boolean }): RenderedEmail {
  const heading = input.isNewAccount ? "Potwierdz swoje konto FixIT" : "Twoj link do logowania";
  const intro = input.isNewAccount
    ? "Dziekujemy za zalozenie konta w FixIT. Aby potwierdzic adres email i aktywowac konto, kliknij ponizszy przycisk."
    : "Otrzymalismy prosbe o zalogowanie do FixIT. Kliknij ponizszy przycisk, aby sie zalogowac.";
  const expiry = `Link jest wazny przez ${input.ttlMinutes} minut i mozna go uzyc tylko raz.`;
  const ignore = "Jesli to nie Ty, zignoruj te wiadomosc.";

  return {
    subject: input.isNewAccount ? "Potwierdz konto FixIT" : "Link do logowania FixIT",
    html: layout({
      heading,
      lines: [intro, expiry, ignore],
      cta: { label: input.isNewAccount ? "Potwierdz konto" : "Zaloguj sie", url: input.url }
    }),
    text: `${heading}\n\n${intro}\n\n${input.url}\n\n${expiry}\n${ignore}`
  };
}

export function ticketCreatedReporterEmail(input: { ticket: Ticket; url: string }): RenderedEmail {
  const heading = `Zgloszenie ${input.ticket.number} zostalo przyjete`;
  return {
    subject: `[${input.ticket.number}] Przyjelismy Twoje zgloszenie`,
    html: layout({
      heading,
      lines: [
        `Twoje zgloszenie zostalo zarejestrowane: <strong>${escapeHtml(input.ticket.title)}</strong>.`,
        ticketMeta(input.ticket),
        "Dzial IT zajmie sie sprawa. O zmianach statusu poinformujemy Cie mailem."
      ],
      cta: { label: "Zobacz zgloszenie", url: input.url }
    }),
    text: `${heading}\n\n${input.ticket.title}\n${ticketMeta(input.ticket)}\n\n${input.url}`
  };
}

export function ticketCreatedAgentEmail(input: { ticket: Ticket; reporterName: string; url: string }): RenderedEmail {
  const heading = `Nowe zgloszenie w kolejce: ${input.ticket.number}`;
  return {
    subject: `[${input.ticket.number}] Nowe zgloszenie w kolejce`,
    html: layout({
      heading,
      lines: [
        `Zglaszajacy: <strong>${escapeHtml(input.reporterName)}</strong>.`,
        `Temat: <strong>${escapeHtml(input.ticket.title)}</strong>.`,
        ticketMeta(input.ticket)
      ],
      cta: { label: "Otworz w panelu IT", url: input.url }
    }),
    text: `${heading}\n\nZglaszajacy: ${input.reporterName}\nTemat: ${input.ticket.title}\n${ticketMeta(input.ticket)}\n\n${input.url}`
  };
}

export function ticketAssignedEmail(input: { ticket: Ticket; url: string }): RenderedEmail {
  const heading = `Przypisano Ci zgloszenie ${input.ticket.number}`;
  return {
    subject: `[${input.ticket.number}] Zgloszenie przypisane do Ciebie`,
    html: layout({
      heading,
      lines: [
        `Zostalo Ci przypisane zgloszenie: <strong>${escapeHtml(input.ticket.title)}</strong>.`,
        ticketMeta(input.ticket)
      ],
      cta: { label: "Przejdz do zgloszenia", url: input.url }
    }),
    text: `${heading}\n\n${input.ticket.title}\n${ticketMeta(input.ticket)}\n\n${input.url}`
  };
}

export function ticketCommentEmail(input: {
  ticket: Ticket;
  authorName: string;
  body: string;
  url: string;
}): RenderedEmail {
  const heading = `Nowy komentarz w zgloszeniu ${input.ticket.number}`;
  return {
    subject: `[${input.ticket.number}] Nowy komentarz`,
    html: layout({
      heading,
      lines: [
        `<strong>${escapeHtml(input.authorName)}</strong> dodal komentarz:`,
        `<em>${escapeHtml(input.body)}</em>`,
        ticketMeta(input.ticket)
      ],
      cta: { label: "Odpowiedz w zgloszeniu", url: input.url }
    }),
    text: `${heading}\n\n${input.authorName}: ${input.body}\n${ticketMeta(input.ticket)}\n\n${input.url}`
  };
}

export function ticketResolvedEmail(input: { ticket: Ticket; url: string }): RenderedEmail {
  const heading = `Zgloszenie ${input.ticket.number} zostalo rozwiazane`;
  return {
    subject: `[${input.ticket.number}] Zgloszenie rozwiazane`,
    html: layout({
      heading,
      lines: [
        `Twoje zgloszenie <strong>${escapeHtml(input.ticket.title)}</strong> zostalo oznaczone jako rozwiazane.`,
        "Jesli problem nadal wystepuje, odpowiedz w zgloszeniu, a chetnie wrocimy do sprawy."
      ],
      cta: { label: "Zobacz szczegoly", url: input.url }
    }),
    text: `${heading}\n\n${input.ticket.title}\n\n${input.url}`
  };
}
