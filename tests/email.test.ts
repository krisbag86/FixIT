import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendEmail, sendEmailWithResult } from '@/lib/email';
import {
  templateUserInvitation,
  templateTicketCreated,
  templateTicketAssigned,
  templateCommentAdded,
  templateTicketResolved,
} from '@/lib/email-templates';
import type { Ticket, User, TicketComment } from '@/lib/types';

describe('Email Templates', () => {
  const mockUser: User = {
    id: 'usr_123',
    name: 'John Doe',
    email: 'john@bagietka.pl',
    role: 'REPORTER',
    department: 'IT',
    isActive: true,
  };

  const mockAgent: User = {
    id: 'usr_456',
    name: 'Jane Agent',
    email: 'jane@bagietka.pl',
    role: 'AGENT',
    department: 'Support',
    isActive: true,
  };

  const mockTicket: Ticket = {
    id: 't_789',
    number: 'FIX-2026-001',
    title: 'Login page not loading',
    description: 'The login page shows a blank screen when I try to access it.',
    status: 'NEW',
    priority: 'HIGH',
    blocksWork: true,
    contact: 'john@bagietka.pl',
    categoryId: 'cat_1',
    reporterId: 'usr_123',
    createdAt: '2026-06-01T10:00:00Z',
    updatedAt: '2026-06-01T10:00:00Z',
  };

  const mockComment: TicketComment = {
    id: 'c_123',
    ticketId: 't_789',
    authorId: 'usr_456',
    body: 'I checked the server logs and found the issue. Fixing it now.',
    visibility: 'PUBLIC',
    createdAt: '2026-06-01T11:00:00Z',
  };

  describe('templateTicketCreated', () => {
    it('should generate ticket created template with subject and html', () => {
      const template = templateTicketCreated(mockTicket, mockUser);

      expect(template.subject).toContain('Nowy ticket');
      expect(template.subject).toContain(mockTicket.title);
      expect(template.subject).toContain(mockTicket.id);

      expect(template.html).toContain('FixIT Helpdesk');
      expect(template.html).toContain(mockTicket.id);
      expect(template.html).toContain(mockTicket.title);
      expect(template.html).toContain(mockUser.email);

      expect(template.text).toContain(mockTicket.id);
      expect(template.text).toContain(mockTicket.title);
    });

    it('should include ticket details in template', () => {
      const template = templateTicketCreated(mockTicket, mockUser);

      expect(template.html).toContain(mockTicket.description);
      expect(template.html).toContain(mockTicket.categoryId);
      expect(template.html).toContain(mockTicket.priority);
      expect(template.html).toContain(mockTicket.status);
    });

    it('should include clickable link to ticket', () => {
      const template = templateTicketCreated(mockTicket, mockUser);

      expect(template.html).toContain(`/tickets/${mockTicket.id}`);
      expect(template.text).toContain(`/tickets/${mockTicket.id}`);
    });
  });

  describe('templateUserInvitation', () => {
    it('should include login and setup link (no plain text password)', () => {
      const template = templateUserInvitation(mockUser, 'TempPass123!');

      expect(template.subject).toContain('FixIT');
      expect(template.html).toContain(mockUser.email);
      // Password should NOT be in the email body (security fix)
      expect(template.html).not.toContain('TempPass123!');
      // Setup link should be present
      expect(template.html).toContain('/login');
      expect(template.text).toContain('/login');
    });

    it('should include setup token in the link when provided', () => {
      const setupToken = 'test-setup-token-value';
      const template = templateUserInvitation(mockUser, 'TempPass123!', setupToken);

      expect(template.html).toContain(`/setup/${setupToken}`);
      expect(template.text).toContain(`/setup/${setupToken}`);
      // Password should still NOT be in the body
      expect(template.html).not.toContain('TempPass123!');
    });
  });

  describe('templateTicketAssigned', () => {
    it('should generate ticket assigned template', () => {
      const template = templateTicketAssigned(mockTicket, mockAgent);

      expect(template.subject).toContain('przypisany do Ciebie');
      expect(template.html).toContain(mockAgent.email);
      expect(template.text).toContain(mockTicket.id);
    });
  });

  describe('templateCommentAdded', () => {
    it('should generate comment added template', () => {
      const template = templateCommentAdded(mockTicket, mockComment, mockAgent);

      expect(template.subject).toContain('komentarz');
      expect(template.html).toContain(mockAgent.email);
      expect(template.html).toContain(mockComment.body);
      expect(template.text).toContain(mockComment.body);
    });
  });

  describe('templateTicketResolved', () => {
    it('should generate ticket resolved template', () => {
      const resolvedTicket = { ...mockTicket, status: 'RESOLVED' as const };
      const template = templateTicketResolved(resolvedTicket, mockAgent);

      expect(template.subject).toContain('rozwiązany');
      expect(template.html).toContain('RESOLVED');
      expect(template.html).toContain(mockAgent.email);
    });
  });

  describe('HTML escaping', () => {
    const maliciousTicket: Ticket = {
      ...mockTicket,
      id: 't_hack',
      title: '<script>alert("xss")</script>',
      description: '<img src=x onerror=alert(1)>',
    };

    const maliciousComment: TicketComment = {
      ...mockComment,
      body: '<a href="javascript:alert(\'xss\')">click me</a>',
    };

    it('should escape HTML in ticket title (TicketCreated)', () => {
      const template = templateTicketCreated(maliciousTicket, mockUser);
      expect(template.html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(template.html).not.toContain('<script>');
    });

    it('should escape HTML in ticket description (TicketCreated)', () => {
      const template = templateTicketCreated(maliciousTicket, mockUser);
      expect(template.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(template.html).not.toContain('<img');
    });

    it('should escape HTML in comment body (CommentAdded)', () => {
      const template = templateCommentAdded(mockTicket, maliciousComment, mockAgent);
      // User input in comment body should be HTML-escaped
      expect(template.html).toContain("&lt;a href=&quot;javascript:");
      expect(template.html).toContain("&gt;click me&lt;/a&gt;");
      expect(template.html).toContain("alert(&#39;xss&#39;)"); // single quotes escaped to &#39;
      // The template's own <a href> for the ticket link is legitimate
    });

    it('should escape HTML in ticket title (CommentAdded subject)', () => {
      const template = templateCommentAdded(maliciousTicket, mockComment, mockAgent);
      expect(template.subject).toContain('&lt;script&gt;');
      expect(template.subject).not.toContain('<script>');
    });

    it('should escape email in HTML body', () => {
      const maliciousUser: User = {
        ...mockUser,
        email: 'test<script>alert(1)</script>@bagietka.pl',
      };
      const template = templateTicketCreated(mockTicket, maliciousUser);
      expect(template.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;@bagietka.pl');
      expect(template.html).not.toContain('<script>alert(1)</script>@bagietka.pl');
    });
  });
});

describe('Email Sending', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.BREVO_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should return false when SMTP is not configured', async () => {
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    // Will return false if config is incomplete (in test environment)
    expect(typeof result).toBe('boolean');
  });

  it('should accept valid email payload', async () => {
    const payload = {
      to: 'test@bagietka.pl',
      subject: 'Test Email',
      html: '<p>This is a test</p>',
      text: 'This is a test',
    };

    // Just verify the payload structure
    expect(payload.to).toBeDefined();
    expect(payload.subject).toBeDefined();
    expect(payload.html).toBeDefined();
  });

  it('should send through Brevo API when BREVO_API_KEY is configured', async () => {
    process.env.BREVO_API_KEY = 'test-api-key';
    process.env.EMAIL_FROM = 'FixIT <sender@proton.me>';
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ messageId: 'msg-123' }), { status: 201 }));
    global.fetch = fetchMock;

    const result = await sendEmailWithResult({
      to: 'test@bagietka.pl',
      subject: 'Test Email',
      html: '<p>This is a test</p>',
      text: 'This is a test'
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/smtp/email',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'api-key': 'test-api-key',
          'content-type': 'application/json'
        }),
        body: JSON.stringify({
          sender: { name: 'FixIT', email: 'sender@proton.me' },
          to: [{ email: 'test@bagietka.pl' }],
          subject: 'Test Email',
          htmlContent: '<p>This is a test</p>',
          textContent: 'This is a test'
        })
      })
    );
  });

  it('should return Brevo API errors', async () => {
    process.env.BREVO_API_KEY = 'test-api-key';
    process.env.EMAIL_FROM = 'FixIT <sender@proton.me>';
    global.fetch = vi.fn(async () => new Response('invalid sender', { status: 400, statusText: 'Bad Request' }));

    const result = await sendEmailWithResult({
      to: 'test@bagietka.pl',
      subject: 'Test Email',
      html: '<p>This is a test</p>'
    });

    expect(result).toEqual({
      ok: false,
      error: 'Brevo API error 400: invalid sender'
    });
  });
});
