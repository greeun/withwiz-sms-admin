import { normalizePhone, type SmsProvider } from '@withwiz/sms-core';
import type {
  MessageFilter,
  PaginatedResult,
  SendMessageParams,
  SendMessageResult,
  SmsAdminLogger,
  SmsMessageDetail,
  SmsMessageListItem,
  SmsStatus,
} from '../types';
import { DEFAULT_PAGE_SIZE } from '../constants';

/**
 * The Prisma surface this service actually uses. It accepts the consumer's PrismaClient
 * as is.
 *
 * Only the return type of `findUnique` is left as `unknown`. Demanding the relation-bearing
 * `SmsMessageDetail` there does not structurally match the generic overload Prisma
 * generates: Prisma's `findUnique` is checked with its type parameter instantiated to the
 * constraint's default, and that instantiation ignores `include`, so the resulting type has
 * no relation fields. The actual call passes `include: { recipients: ... }`, so the runtime
 * result does carry the relation, and `detail()` pins the type down at that point.
 */
export interface SmsPrismaClient {
  smsMessage: {
    create(args: unknown): Promise<{ id: string }>;
    update(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<SmsMessageListItem[]>;
    count(args: unknown): Promise<number>;
    findUnique(args: unknown): Promise<unknown>;
    deleteMany(args: unknown): Promise<{ count: number }>;
  };
}

export interface MessageServiceDeps {
  prisma: SmsPrismaClient;
  provider: SmsProvider;
  logger: SmsAdminLogger;
}

/** Send parameters plus the sender number, which the facade reads from config and fills in. */
export interface SendParams extends SendMessageParams {
  sender: string;
}

export interface MessageService {
  send(params: SendParams): Promise<SendMessageResult>;
  list(filter?: MessageFilter): Promise<PaginatedResult<SmsMessageListItem>>;
  detail(id: string): Promise<SmsMessageDetail | null>;
  remove(ids: string[]): Promise<number>;
}

// Allowlist for column header sorting: maps a front-end column key to a DB field name.
// It blocks sorting by arbitrary fields, which would full-scan unindexed columns.
const SORT_FIELDS: Record<string, string> = {
  createdAt: 'createdAt',
  type: 'type',
  count: 'totalCount',
  status: 'status',
  source: 'source',
};

export function createMessageService(deps: MessageServiceDeps): MessageService {
  const { prisma, provider, logger } = deps;

  return {
    async send(params: SendParams): Promise<SendMessageResult> {
      const { type, subject, content, imageUrl, recipients, source, sender } = params;

      const message = await prisma.smsMessage.create({
        data: {
          type,
          subject: subject || null,
          content,
          imageUrl: imageUrl || null,
          sender,
          totalCount: recipients.length,
          status: 'PENDING',
          source: source || null,
          recipients: {
            create: recipients.map((r) => ({
              name: r.name,
              phone: r.phone,
              status: 'PENDING',
            })),
          },
        },
      });

      let status: SmsStatus = 'SENT';
      let successCount = recipients.length;
      let failCount = 0;
      let errcode: string | undefined;
      let errmsg: string | undefined;

      try {
        const outcome = await provider.send({
          type,
          sender,
          ...(subject ? { subject } : {}),
          content,
          ...(imageUrl ? { imageUrl } : {}),
          recipients: recipients.map((r) => normalizePhone(r.phone)),
        });

        if (!outcome.ok) {
          status = 'FAILED';
          successCount = 0;
          failCount = recipients.length;
          errcode = outcome.errorCode;
          errmsg = outcome.errorMessage;
          logger.error('[sms/send] send failed', {
            type,
            sender,
            provider: provider.name,
            errcode,
            errmsg,
          });
        }
      } catch (err) {
        status = 'FAILED';
        successCount = 0;
        failCount = recipients.length;
        errmsg = err instanceof Error ? err.message : String(err);
        // Send exceptions are hard to reproduce, so the stack is logged too. This matches
        // what the original homepage code recorded through errorMeta(err).
        logger.error('[sms/send] exception', {
          error: err instanceof Error ? (err.stack ?? `${err.name}: ${err.message}`) : String(err),
          provider: provider.name,
        });
      }

      await prisma.smsMessage.update({
        where: { id: message.id },
        data: {
          status,
          successCount,
          failCount,
          errCode: errcode ?? null,
          errMessage: errmsg ?? null,
          recipients: {
            updateMany: {
              where: { messageId: message.id },
              data: { status },
            },
          },
        },
      });

      return {
        messageId: message.id,
        totalCount: recipients.length,
        successCount,
        failCount,
        status,
        ...(errcode ? { errcode } : {}),
        ...(errmsg ? { errmsg } : {}),
      };
    },

    async list(filter: MessageFilter = {}): Promise<PaginatedResult<SmsMessageListItem>> {
      const { page = 1, limit = DEFAULT_PAGE_SIZE, source, status, type, search, sort, order } = filter;
      const where: Record<string, unknown> = {};
      if (source) where.source = source;
      if (status) where.status = status;
      if (type) where.type = type;
      if (search) {
        where.OR = [
          { content: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } },
        ];
      }

      const sortField = (sort && SORT_FIELDS[sort]) || 'createdAt';
      const sortOrder = order === 'asc' ? 'asc' : 'desc';

      const [items, total] = await Promise.all([
        prisma.smsMessage.findMany({
          where,
          orderBy: { [sortField]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.smsMessage.count({ where }),
      ]);

      return { items, total, page, limit };
    },

    async detail(id: string): Promise<SmsMessageDetail | null> {
      // `include` fetches the relation along with the row, so the result carries recipients.
      // See the SmsPrismaClient comment for why the interface returns unknown here.
      const found = await prisma.smsMessage.findUnique({
        where: { id },
        include: {
          recipients: { orderBy: { createdAt: 'asc' } },
        },
      });
      return found as SmsMessageDetail | null;
    },

    async remove(ids: string[]): Promise<number> {
      const result = await prisma.smsMessage.deleteMany({ where: { id: { in: ids } } });
      return result.count;
    },
  };
}
