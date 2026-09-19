import type {
  PaginatedResult,
  SmsTemplateListItem,
  TemplateFilter,
  TemplateInput,
} from '../types';
import { SmsValidationError } from './errors';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants';

export interface TemplatePrismaClient {
  smsTemplate: {
    findMany(args: unknown): Promise<SmsTemplateListItem[]>;
    count(args: unknown): Promise<number>;
    create(args: unknown): Promise<SmsTemplateListItem>;
    update(args: unknown): Promise<SmsTemplateListItem>;
    delete(args: unknown): Promise<SmsTemplateListItem>;
  };
}

export interface TemplateServiceDeps {
  prisma: TemplatePrismaClient;
}

export interface TemplateService {
  list(filter?: TemplateFilter): Promise<PaginatedResult<SmsTemplateListItem>>;
  /** For exports. Fetches every row without pagination. */
  listAll(filter?: Omit<TemplateFilter, 'page' | 'limit'>): Promise<SmsTemplateListItem[]>;
  create(input: TemplateInput): Promise<SmsTemplateListItem>;
  update(id: string, input: TemplateInput): Promise<SmsTemplateListItem>;
  remove(id: string): Promise<void>;
}

const ALLOWED_SORT = new Set(['createdAt', 'name', 'type', 'isSystem', 'content']);
const ALLOWED_ORDER = new Set(['asc', 'desc']);

function buildWhere(search?: string): Record<string, unknown> {
  if (!search) return {};
  return {
    OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { subject: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
    ],
  };
}

function resolveSort(sort?: string, order?: string): Record<string, string> {
  const field = sort ?? 'createdAt';
  const direction = order ?? 'desc';
  if (!ALLOWED_SORT.has(field)) {
    throw new SmsValidationError('Invalid sort field');
  }
  if (!ALLOWED_ORDER.has(direction)) {
    throw new SmsValidationError('Invalid sort order');
  }
  return { [field]: direction };
}

export function createTemplateService(deps: TemplateServiceDeps): TemplateService {
  const { prisma } = deps;

  return {
    async list(filter: TemplateFilter = {}): Promise<PaginatedResult<SmsTemplateListItem>> {
      const page = Number.isFinite(filter.page) && (filter.page ?? 0) >= 1 ? Math.floor(filter.page!) : 1;
      const limit =
        Number.isFinite(filter.limit) && (filter.limit ?? 0) >= 1
          ? Math.min(MAX_PAGE_SIZE, Math.floor(filter.limit!))
          : DEFAULT_PAGE_SIZE;
      const where = buildWhere(filter.search?.trim());
      const orderBy = resolveSort(filter.sort, filter.order);

      const [items, total] = await Promise.all([
        prisma.smsTemplate.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit }),
        prisma.smsTemplate.count({ where }),
      ]);

      return { items, total, page, limit };
    },

    async listAll(filter: Omit<TemplateFilter, 'page' | 'limit'> = {}): Promise<SmsTemplateListItem[]> {
      return prisma.smsTemplate.findMany({
        where: buildWhere(filter.search?.trim()),
        orderBy: resolveSort(filter.sort, filter.order),
      });
    },

    async create(input: TemplateInput): Promise<SmsTemplateListItem> {
      if (!input.name || !input.type || !input.content) {
        throw new SmsValidationError('name, type and content are required.');
      }
      return prisma.smsTemplate.create({
        data: {
          name: input.name,
          type: input.type,
          subject: input.subject || null,
          content: input.content,
          imageUrl: input.imageUrl || null,
        },
      });
    },

    async update(id: string, input: TemplateInput): Promise<SmsTemplateListItem> {
      if (!input.name || !input.type || !input.content) {
        throw new SmsValidationError('name, type and content are required.');
      }
      return prisma.smsTemplate.update({
        where: { id },
        data: {
          name: input.name,
          type: input.type,
          subject: input.subject || null,
          content: input.content,
          imageUrl: input.imageUrl || null,
        },
      });
    },

    async remove(id: string): Promise<void> {
      await prisma.smsTemplate.delete({ where: { id } });
    },
  };
}
