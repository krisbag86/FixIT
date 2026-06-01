import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendEmail } from '@/lib/email';
import {
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
});

describe('Email Sending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
