import { describe, expect, it, vi } from 'vitest';
import type { SmsProvider } from '@withwiz/sms-core';
import { createSmsAdmin } from '../src/facade/create-sms-admin';

function makeDeps() {
  const prisma = {
    smsMessage: {
      create: vi.fn().mockResolvedValue({ id: 'M1' }),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn().mockResolvedValue(null),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    smsTemplate: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
  const provider: SmsProvider = {
    name: 'test',
    capabilities: {
      maxRecipientsPerRequest: 1000,
      perRecipientResult: false,
      scheduling: false,
      imageUpload: 'inline',
    },
    send: vi.fn().mockResolvedValue({ ok: true, successCount: 1, failCount: 0 }),
    getRemainCounts: vi.fn().mockResolvedValue({ sms: 10, lms: 5, mms: 1 }),
  };
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { prisma, provider, logger };
}

describe('createSmsAdmin', () => {
  it('exposes messages, templates, remain and csv', () => {
    const { prisma, provider, logger } = makeDeps();
    const admin = createSmsAdmin({
      prisma: prisma as never,
      provider,
      logger,
      sender: async () => '021234567',
    });

    expect(typeof admin.messages.send).toBe('function');
    expect(typeof admin.templates.list).toBe('function');
    expect(typeof admin.remain).toBe('function');
    expect(typeof admin.csv.buildMessageCsv).toBe('function');
  });

  it('fills in the sender number read from config when sending', async () => {
    const { prisma, provider, logger } = makeDeps();
    const admin = createSmsAdmin({
      prisma: prisma as never,
      provider,
      logger,
      sender: async () => '02-123-4567',
    });

    await admin.messages.send({
      type: 'SMS',
      content: 'content',
      recipients: [{ name: 'A', phone: '01011112222' }],
    });

    expect(prisma.smsMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sender: '02-123-4567' }) }),
    );
  });

  it('passes the provider remaining counts straight through', async () => {
    const { prisma, provider, logger } = makeDeps();
    const admin = createSmsAdmin({
      prisma: prisma as never,
      provider,
      logger,
      sender: async () => '021234567',
    });

    expect(await admin.remain()).toEqual({ sms: 10, lms: 5, mms: 1 });
  });
});
