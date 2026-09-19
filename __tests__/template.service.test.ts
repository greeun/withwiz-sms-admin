import { describe, expect, it, vi } from 'vitest';
import { isSmsValidationError } from '../src/services/errors';
import { createTemplateService } from '../src/services/template.service';

function makePrisma() {
  return {
    smsTemplate: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'T1' }),
      update: vi.fn().mockResolvedValue({ id: 'T1' }),
      delete: vi.fn().mockResolvedValue({ id: 'T1' }),
    },
  };
}

describe('templateService.list', () => {
  it('uses an allowed sort key as is', async () => {
    const prisma = makePrisma();
    const service = createTemplateService({ prisma: prisma as never });

    await service.list({ sort: 'name', order: 'asc' });

    expect(prisma.smsTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: 'asc' } }),
    );
  });

  it('throws on a sort key that is not allowed', async () => {
    const prisma = makePrisma();
    const service = createTemplateService({ prisma: prisma as never });

    await expect(service.list({ sort: 'secret' })).rejects.toThrow('Invalid sort field');
  });

  it('throws on a sort order that is not allowed', async () => {
    const prisma = makePrisma();
    const service = createTemplateService({ prisma: prisma as never });

    await expect(service.list({ order: 'random' as never })).rejects.toThrow('Invalid sort order');
  });

  it('matches the search term against name, subject and content', async () => {
    const prisma = makePrisma();
    const service = createTemplateService({ prisma: prisma as never });

    await service.list({ search: 'briefing' });

    expect(prisma.smsTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: 'briefing', mode: 'insensitive' } },
            { subject: { contains: 'briefing', mode: 'insensitive' } },
            { content: { contains: 'briefing', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });

  it('caps the limit at 200', async () => {
    const prisma = makePrisma();
    const service = createTemplateService({ prisma: prisma as never });

    await service.list({ limit: 9999 });

    expect(prisma.smsTemplate.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 200 }));
  });
});

describe('templateService.create', () => {
  it('throws when a required field is missing', async () => {
    const prisma = makePrisma();
    const service = createTemplateService({ prisma: prisma as never });

    await expect(
      service.create({ name: '', type: 'SMS', content: 'content' }),
    ).rejects.toThrow('name, type and content are required.');
  });

  it('stores empty optional fields as null', async () => {
    const prisma = makePrisma();
    const service = createTemplateService({ prisma: prisma as never });

    await service.create({ name: 'Notice', type: 'SMS', content: 'content' });

    expect(prisma.smsTemplate.create).toHaveBeenCalledWith({
      data: { name: 'Notice', type: 'SMS', subject: null, content: 'content', imageUrl: null },
    });
  });
});

describe('templateService validation errors', () => {
  it('marks validation failures as SmsValidationError', async () => {
    const prisma = makePrisma();
    const service = createTemplateService({ prisma: prisma as never });

    await expect(service.list({ sort: 'secret' })).rejects.toSatisfy(isSmsValidationError);
    await expect(
      service.create({ name: '', type: 'SMS', content: 'content' }),
    ).rejects.toSatisfy(isSmsValidationError);
  });
});

describe('templateService.listAll', () => {
  it('fetches every row sorted, without pagination', async () => {
    const prisma = makePrisma();
    const service = createTemplateService({ prisma: prisma as never });

    await service.listAll({ sort: 'name', order: 'asc' });

    expect(prisma.smsTemplate.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { name: 'asc' },
    });
  });
});
