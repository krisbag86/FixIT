import { describe, expect, it } from "vitest";
import { magicLinkEmail, ticketCommentEmail, ticketCreatedReporterEmail } from "@/lib/email-templates";
import type { Ticket } from "@/lib/types";

const ticket: Ticket = {
  id: "t_1",
  number: "IT-2026-0007",
  title: "Drukarka nie drukuje",
  description: "Opis",
  status: "NEW",
  priority: "HIGH",
  blocksWork: false,
  contact: "jan@bagietka.pl",
  categoryId: "cat_printer",
  reporterId: "usr_1",
  createdAt: "2026-06-01T10:00:00.000Z",
  updatedAt: "2026-06-01T10:00:00.000Z"
};

describe("email templates", () => {
  it("uses a confirmation subject for new accounts and a login subject otherwise", () => {
    expect(magicLinkEmail({ url: "https://x/y", ttlMinutes: 15, isNewAccount: true }).subject).toContain("Potwierdz");
    expect(magicLinkEmail({ url: "https://x/y", ttlMinutes: 15, isNewAccount: false }).subject).toContain("logowania");
  });

  it("includes the ticket number in created-ticket subject and link in body", () => {
    const rendered = ticketCreatedReporterEmail({ ticket, url: "https://app/tickets/t_1" });
    expect(rendered.subject).toContain(ticket.number);
    expect(rendered.html).toContain("https://app/tickets/t_1");
    expect(rendered.text).toContain(ticket.number);
  });

  it("escapes HTML in untrusted comment body", () => {
    const rendered = ticketCommentEmail({
      ticket,
      authorName: "Jan",
      body: "<script>alert(1)</script>",
      url: "https://app/tickets/t_1"
    });
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;script&gt;");
  });
});
