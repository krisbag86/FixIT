import { Ticket, TicketComment, User } from './types';
import { escapeHtml } from './escape-html';

const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export function getTicketUrl(ticketId: string): string {
  return `${baseUrl}/tickets/${ticketId}`;
}

export function getLoginUrl(): string {
  return `${baseUrl}/login`;
}

export function getSetupUrl(setupToken: string): string {
  return `${baseUrl}/setup/${encodeURIComponent(setupToken)}`;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export function templateUserInvitation(user: User, _temporaryPassword: string, setupToken?: string): EmailTemplate {
  const setupUrl = setupToken ? getSetupUrl(setupToken) : getLoginUrl();
  const subject = `[FixIT] Dostep do systemu FixIT`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .setup-link { background-color: #eefbf7; padding: 15px; border-left: 4px solid #20b486; margin: 15px 0; }
          .button { display: inline-block; padding: 12px 24px; background-color: #20b486; color: #fff !important; text-decoration: none; border-radius: 6px; font-weight: bold; }
          .footer { font-size: 0.9em; color: #666; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; }
          a { color: #007bff; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>FixIT Helpdesk</h2>
            <p>Twoje konto zostalo utworzone</p>
          </div>

          <p>Czesc ${escapeHtml(user.name || user.email)},</p>
          <p>Administrator utworzyl dla Ciebie konto w systemie FixIT.</p>

          <div class="setup-link">
            <p><strong>Login:</strong> ${escapeHtml(user.email)}</p>
            <p style="margin-top: 16px;">
              <a href="${setupUrl}" class="button">Ustaw haslo i aktywuj konto</a>
            </p>
          </div>

          <p>Link jest wazny przez 48 godzin. Po zalogowaniu bedziesz mogl korzystac z systemu.</p>
          <p style="margin-top: 12px;">
            <small>Jesli przycisk nie dziala, skopiuj ten link: ${setupUrl}</small>
          </p>

          <div class="footer">
            <p>To jest automatyczna wiadomosc z systemu FixIT Helpdesk. Prosze nie odpowiadac na tego maila.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
FixIT Helpdesk

Twoje konto zostalo utworzone

Czesc ${user.name || user.email},
Administrator utworzyl dla Ciebie konto w systemie FixIT.

Login: ${user.email}

Aby ustawic haslo i aktywowac konto, kliknij link:
${setupUrl}

Link jest wazny przez 48 godzin.

To jest automatyczna wiadomosc z systemu FixIT Helpdesk. Prosze nie odpowiadac na tego maila.
  `.trim();

  return { subject, html, text };
}

export function templateTicketCreated(ticket: Ticket, reporter: User): EmailTemplate {
  const ticketUrl = getTicketUrl(ticket.id);
  const subject = `[FixIT] Nowy ticket: ${escapeHtml(ticket.title)} (${ticket.id})`;

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

          <p>Cześć ${escapeHtml(reporter.email)},</p>
          <p>Twój ticket został pomyślnie utworzony w systemie FixIT.</p>

          <div class="ticket-details">
            <p><strong>ID Ticketu:</strong> ${escapeHtml(ticket.id)}</p>
            <p><strong>Tytuł:</strong> ${escapeHtml(ticket.title)}</p>
            <p><strong>Opis:</strong> ${escapeHtml(ticket.description)}</p>
            <p><strong>Kategoria:</strong> ${escapeHtml(ticket.categoryId)}</p>
            <p><strong>Priorytet:</strong> ${escapeHtml(ticket.priority)}</p>
            <p><strong>Status:</strong> ${escapeHtml(ticket.status)}</p>
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
  const subject = `[FixIT] Ticket przypisany do Ciebie: ${escapeHtml(ticket.title)} (${ticket.id})`;

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

          <p>Cześć ${escapeHtml(assignedTo.email)},</p>
          <p>Ticket został Ci przypisany i czeka na obsługę.</p>

          <div class="ticket-details">
            <p><strong>ID Ticketu:</strong> ${escapeHtml(ticket.id)}</p>
            <p><strong>Tytuł:</strong> ${escapeHtml(ticket.title)}</p>
            <p><strong>Opis:</strong> ${escapeHtml(ticket.description)}</p>
            <p><strong>Priorytet:</strong> ${escapeHtml(ticket.priority)}</p>
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
  const subject = `[FixIT] Nowy komentarz do ticketu: ${escapeHtml(ticket.title)} (${ticket.id})`;

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
          <p><strong>${escapeHtml(author.email)}</strong> dodał komentarz do ticketu.</p>

          <div class="comment">
            <p><strong>Komentarz:</strong></p>
            <p>${escapeHtml(comment.body)}</p>
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
  const subject = `[FixIT] Ticket rozwiązany: ${escapeHtml(ticket.title)} (${ticket.id})`;

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
          <p>Twój ticket został oznaczony jako <strong>ROZWIĄZANY</strong> przez <strong>${escapeHtml(resolver.email)}</strong>.</p>

          <div class="status">
            <p><strong>Status:</strong> ${ticket.status}</p>
            <p><strong>Rozwiązane przez:</strong> ${escapeHtml(resolver.email)}</p>
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
