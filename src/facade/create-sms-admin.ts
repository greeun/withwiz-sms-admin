import type { SmsProvider, SmsRemainCounts } from '@withwiz/sms-core';
import {
  createMessageService,
  type MessageService,
  type SmsPrismaClient,
} from '../services/message.service';
import {
  createTemplateService,
  type TemplatePrismaClient,
  type TemplateService,
} from '../services/template.service';
import { buildMessageCsv, buildTemplateCsv, csvFileName, toCsv } from '../services/csv';
import type { SendMessageParams, SendMessageResult, SmsAdminLogger } from '../types';

export interface SmsAdminConfig {
  prisma: SmsPrismaClient & TemplatePrismaClient;
  provider: SmsProvider;
  logger: SmsAdminLogger;
  /** Reads the sender number. Read at call time so setting changes take effect at once. */
  sender: () => Promise<string>;
}

export interface SmsAdmin {
  messages: Omit<MessageService, 'send'> & {
    send(params: SendMessageParams): Promise<SendMessageResult>;
  };
  templates: TemplateService;
  remain(): Promise<SmsRemainCounts>;
  csv: {
    toCsv: typeof toCsv;
    buildMessageCsv: typeof buildMessageCsv;
    buildTemplateCsv: typeof buildTemplateCsv;
    csvFileName: typeof csvFileName;
  };
  provider: SmsProvider;
}

export function createSmsAdmin(config: SmsAdminConfig): SmsAdmin {
  const messageService = createMessageService({
    prisma: config.prisma,
    provider: config.provider,
    logger: config.logger,
  });
  const templateService = createTemplateService({ prisma: config.prisma });

  return {
    messages: {
      ...messageService,
      async send(params: SendMessageParams): Promise<SendMessageResult> {
        return messageService.send({ ...params, sender: await config.sender() });
      },
    },
    templates: templateService,
    remain: () => config.provider.getRemainCounts(),
    csv: { toCsv, buildMessageCsv, buildTemplateCsv, csvFileName },
    provider: config.provider,
  };
}
