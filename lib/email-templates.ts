import { Ticket, TicketComment, User } from './types';

const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export function getTicketUrl(ticketId: string): string {
  return `${baseUrl}/tickets/${ticketId}`;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export function templateTicketCreated(ticket: Ticket, reporter: User): EmailTemplate {
  const ticketUrl = getTicketUrl(ticket.id);
  const subject = `[FixIT] Nowy ticket: ${ticket.title} (${ticket.id})`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .ticket-details { background-color: #fafafa; padding: 15px; border-left: 4px solid #007bff; margin: 15px 0; }
          .footer { font-size: 0.9em; color: #666; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; }
          a { color: #007bff; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>FixIT Helpdesk</h2>
            <p>Nowy ticket został utworzony</p>
          </div>

          <p>Cześć ${reporter.email},</p>
          <p>Twój ticket został pomyślnie utworzony w systemie FixIT.</p>

          <div class="ticket-details">
            <p><strong>ID Ticketu:</strong> ${ticket.id}</p>
            <p><strong>Tytuł:</strong> ${ticket.title}</p>
            <p><strong>Opis:</strong> ${ticket.description}</p>
            <p><strong>Kategoria:</strong> ${ticket.categoryId}</p>
            <p><strong>Priorytet:</strong> ${ticket.priority}</p>
            <p><strong>Status:</strong> ${ticket.status}</p>
          </div>

          <p>
            <a href="${ticketUrl}">Przejdź do ticketu</a>
          </p>

          <div class="footer">
            <p>To jest automatyczna wiadomość z systemu FixIT Helpdesk. Proszę nie odpowiadać na tego maila.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
FixIT Helpdesk

Nowy ticket został utworzony

Cześć ${reporter.email},
Twój ticket został pomyślnie utworzony w systemie FixIT.

ID Ticketu: ${ticket.id}
Tytuł: ${ticket.title}
Opis: ${ticket.description}
Kategoria: ${ticket.categoryId}
Priorytet: ${ticket.priority}
Status: ${ticket.status}

Przejdź do ticketu: ${ticketUrl}

To jest automatyczna wiadomość z systemu FixIT Helpdesk. Proszę nie odpowiadać na tego maila.
  `.trim();

  return { subject, html, text };
}

export function templateTicketAssigned(ticket: Ticket, assignedTo: User): EmailTemplate {
  const ticketUrl = getTicketUrl(ticket.id);
  const subject = `[FixIT] Ticket przypisany do Ciebie: ${ticket.title} (${ticket.id})`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .ticket-details { background-color: #e3f2fd; padding: 15px; border-left: 4px solid #1976d2; margin: 15px 0; }
          .footer { font-size: 0.9em; color: #666; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; }
          a { color: #007bff; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>FixIT Helpdesk</h2>
            <p>Masz nowy ticket przypisany</p>
          </div>

          <p>Cześć ${assignedTo.email},</p>
          <p>Ticket został Ci przypisany i czeka na obsługę.</p>

          <div class="ticket-details">
            <p><strong>ID Ticketu:</strong> ${ticket.id}</p>
            <p><strong>Tytuł:</strong> ${ticket.title}</p>
            <p><strong>Opis:</strong> ${ticket.description}</p>
            <p><strong>Priorytet:</strong> ${ticket.priority}</p>
          </div>

          <p>
            <a href="${ticketUrl}">Otwórz ticket</a>
          </p>

          <div class="footer">
            <p>To jest automatyczna wiadomość z systemu FixIT Helpdesk. Proszę nie odpowiadać na tego maila.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
FixIT Helpdesk

Masz nowy ticket przypisany

Cześć ${assignedTo.email},
Ticket został Ci przypisany i czeka na obsługę.

ID Ticketu: ${ticket.id}
Tytuł: ${ticket.title}
Opis: ${ticket.description}
Priorytet: ${ticket.priority}

Otwórz ticket: ${ticketUrl}

To jest automatyczna wiadomość z systemu FixIT Helpdesk. Proszę nie odpowiadać na tego maila.
  `.trim();

  return { subject, html, text };
}

export function templateCommentAdded(ticket: Ticket, comment: TicketComment, author: User): EmailTemplate {
  const ticketUrl = getTicketUrl(ticket.id);
  const subject = `[FixIT] Nowy komentarz do ticketu: ${ticket.title} (${ticket.id})`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .comment { background-color: #fff9e6; padding: 15px; border-left: 4px solid #ffa500; margin: 15px 0; }
          .footer { font-size: 0.9em; color: #666; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; }
          a { color: #007bff; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>FixIT Helpdesk</h2>
            <p>Nowy komentarz do Twojego ticketu</p>
          </div>

          <p>Cześć,</p>
          <p><strong>${author.email}</strong> dodał komentarz do ticketu.</p>

          <div class="comment">
            <p><strong>Komentarz:</strong></p>
            <p>${comment.body}</p>
          </div>

          <p>
            <a href="${ticketUrl}">Przejdź do ticketu</a>
          </p>

          <div class="footer">
            <p>To jest automatyczna wiadomość z systemu FixIT Helpdesk. Proszę nie odpowiadać na tego maila.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
FixIT Helpdesk

Nowy komentarz do Twojego ticketu

Cześć,
${author.email} dodał komentarz do ticketu.

Komentarz:
${comment.body}

Przejdź do ticketu: ${ticketUrl}

To jest automatyczna wiadomość z systemu FixIT Helpdesk. Proszę nie odpowiadać na tego maila.
  `.trim();

  return { subject, html, text };
}

export function templateTicketResolved(ticket: Ticket, resolver: User): EmailTemplate {
  const ticketUrl = getTicketUrl(ticket.id);
  const subject = `[FixIT] Ticket rozwiązany: ${ticket.title} (${ticket.id})`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .status { background-color: #e8f5e9; padding: 15px; border-left: 4px solid #4caf50; margin: 15px 0; }
          .footer { font-size: 0.9em; color: #666; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; }
          a { color: #007bff; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>FixIT Helpdesk</h2>
            <p>Twój ticket został rozwiązany</p>
          </div>

          <p>Cześć,</p>
          <p>Twój ticket został oznaczony jako <strong>ROZWIĄZANY</strong> przez <strong>${resolver.email}</strong>.</p>

          <div class="status">
            <p><strong>Status:</strong> ${ticket.status}</p>
            <p><strong>Rozwiązane przez:</strong> ${resolver.email}</p>
          </div>

          <p>
            <a href="${ticketUrl}">Przejdź do ticketu</a>
          </p>

          <div class="footer">
            <p>To jest automatyczna wiadomość z systemu FixIT Helpdesk. Proszę nie odpowiadać na tego maila.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
FixIT Helpdesk

Twój ticket został rozwiązany

Cześć,
Twój ticket został oznaczony jako ROZWIĄZANY przez ${resolver.email}.

Status: ${ticket.status}
Rozwiązane przez: ${resolver.email}

Przejdź do ticketu: ${ticketUrl}

To jest automatyczna wiadomość z systemu FixIT Helpdesk. Proszę nie odpowiadać na tego maila.
  `.trim();

  return { subject, html, text };
}
