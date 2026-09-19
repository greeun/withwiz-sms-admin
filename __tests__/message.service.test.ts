import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SmsProvider } from '@withwiz/sms-core';
import { createMessageService } from '../src/services/message.service';

function makePrisma() {
  return {
    smsMessage: {
      create: vi.fn().mockResolvedValue({ id: 'M1' }),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn().mockResolvedValue(null),
      deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
  };
}

function makeProvider(overrides: Partial<SmsProvider> = {}): SmsProvider {
  return {
    name: 'test',
    capabilities: {
      maxRecipientsPerRequest: 1000,
      perRecipientResult: false,
      scheduling: false,
      imageUpload: 'inline',
    },
    send: vi.fn().mockResolvedValue({ ok: true, successCount: 2, failCount: 0 }),
    getRemainCounts: vi.fn().mockResolvedValue({ sms: 1, lms: 1, mms: 1 }),
    ...overrides,
  };
}

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

// logger is a module-level constant, so its call record must be cleared per test to keep
// the tests isolated.
beforeEach(() => {
  vi.clearAllMocks();
});

describe('messageService.send', () => {
  it('records a PENDING history row and recipients before sending', async () => {
    const prisma = makePrisma();
    const service = createMessageService({ prisma: prisma as never, provider: makeProvider(), logger });

    await service.send({
      type: 'SMS',
      content: 'content',
      sender: '021234567',
      recipients: [
        { name: 'Alice', phone: '010-1111-2222' },
        { name: 'Bob', phone: '010-3333-4444' },
      ],
      source: 'briefing',
    });

    expect(prisma.smsMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'SMS',
        subject: null,
        content: 'content',
        imageUrl: null,
        sender: '021234567',
        totalCount: 2,
        status: 'PENDING',
        source: 'briefing',
        recipients: {
          create: [
            { name: 'Alice', phone: '010-1111-2222', status: 'PENDING' },
            { name: 'Bob', phone: '010-3333-4444', status: 'PENDING' },
          ],
        },
      }),
    });
  });

  it('updates to SENT and returns the tallies on success', async () => {
    const prisma = makePrisma();
    const service = createMessageService({ prisma: prisma as never, provider: makeProvider(), logger });

    const result = await service.send({
      type: 'SMS',
      content: 'content',
      sender: '021234567',
      recipients: [
        { name: 'A', phone: '01011112222' },
        { name: 'B', phone: '01033334444' },
      ],
    });

    expect(result).toEqual({
      messageId: 'M1',
      totalCount: 2,
      successCount: 2,
      failCount: 0,
      status: 'SENT',
    });
    expect(prisma.smsMessage.update).toHaveBeenCalledWith({
      where: { id: 'M1' },
      data: expect.objectContaining({ status: 'SENT', successCount: 2, failCount: 0 }),
    });
  });

  it('normalizes numbers so the provider receives them without hyphens', async () => {
    const prisma = makePrisma();
    const provider = makeProvider();
    const service = createMessageService({ prisma: prisma as never, provider, logger });

    await service.send({
      type: 'SMS',
      content: 'content',
      sender: '02-123-4567',
      recipients: [{ name: 'A', phone: '010-1111-2222' }],
    });

    expect(provider.send).toHaveBeenCalledWith({
      type: 'SMS',
      sender: '02-123-4567',
      content: 'content',
      recipients: ['01011112222'],
    });
  });

  it('records FAILED when the provider returns a failure', async () => {
    const prisma = makePrisma();
    const provider = makeProvider({
      send: vi.fn().mockResolvedValue({
        ok: false,
        successCount: 0,
        failCount: 1,
        errorCode: '-201',
        errorMessage: 'Insufficient balance',
      }),
    });
    const service = createMessageService({ prisma: prisma as never, provider, logger });

    const result = await service.send({
      type: 'SMS',
      content: 'content',
      sender: '021234567',
      recipients: [{ name: 'A', phone: '01011112222' }],
    });

    expect(result.status).toBe('FAILED');
    expect(result.errcode).toBe('-201');
    expect(result.errmsg).toBe('Insufficient balance');
    expect(logger.error).toHaveBeenCalled();
  });

  it('still leaves the history row FAILED when the provider throws', async () => {
    const prisma = makePrisma();
    const provider = makeProvider({
      send: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    const service = createMessageService({ prisma: prisma as never, provider, logger });

    const result = await service.send({
      type: 'SMS',
      content: 'content',
      sender: '021234567',
      recipients: [{ name: 'A', phone: '01011112222' }],
    });

    expect(result.status).toBe('FAILED');
    expect(result.errmsg).toBe('Network error');
    expect(prisma.smsMessage.update).toHaveBeenCalledWith({
      where: { id: 'M1' },
      data: expect.objectContaining({ status: 'FAILED' }),
    });
  });
});

describe('messageService.list', () => {
  it('maps only allowed sort keys to DB fields', async () => {
    const prisma = makePrisma();
    const service = createMessageService({ prisma: prisma as never, provider: makeProvider(), logger });

    await service.list({ sort: 'count', order: 'asc' });

    expect(prisma.smsMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { totalCount: 'asc' } }),
    );
  });

  it('falls back to createdAt descending for a sort key that is not allowed', async () => {
    const prisma = makePrisma();
    const service = createMessageService({ prisma: prisma as never, provider: makeProvider(), logger });

    await service.list({ sort: 'password' });

    expect(prisma.smsMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });

  it('matches the search term against content and subject, case-insensitively', async () => {
    const prisma = makePrisma();
    const service = createMessageService({ prisma: prisma as never, provider: makeProvider(), logger });

    await service.list({ search: 'briefing session', source: 'briefing', page: 2, limit: 10 });

    expect(prisma.smsMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          source: 'briefing',
          OR: [
            { content: { contains: 'briefing session', mode: 'insensitive' } },
            { subject: { contains: 'briefing session', mode: 'insensitive' } },
          ],
        },
        skip: 10,
        take: 10,
      }),
    );
  });
});

describe('messageService.remove', () => {
  it('deletes the given identifiers in one call', async () => {
    const prisma = makePrisma();
    const service = createMessageService({ prisma: prisma as never, provider: makeProvider(), logger });

    await service.remove(['a', 'b']);

    expect(prisma.smsMessage.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['a', 'b'] } } });
  });
});
