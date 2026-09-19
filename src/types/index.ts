import type { SmsType } from '@withwiz/sms-core';

export type { SmsType };

export type SmsStatus = 'PENDING' | 'SENT' | 'FAILED';

/** Minimal interface for accepting the consuming project's logger. */
export interface SmsAdminLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface SmsRecipientInput {
  name: string;
  phone: string;
}

export interface SendMessageParams {
  type: SmsType;
  subject?: string;
  content: string;
  imageUrl?: string;
  recipients: SmsRecipientInput[];
  /** The screen that triggered the send. "briefing" | "consultation" etc. */
  source?: string;
}

export interface SendMessageResult {
  messageId: string;
  totalCount: number;
  successCount: number;
  failCount: number;
  status: SmsStatus;
  errcode?: string;
  errmsg?: string;
}

export interface MessageFilter {
  page?: number;
  limit?: number;
  source?: string;
  status?: string;
  type?: string;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface SmsMessageListItem {
  id: string;
  type: string;
  subject: string | null;
  content: string;
  imageUrl: string | null;
  sender: string;
  totalCount: number;
  successCount: number | null;
  failCount: number | null;
  status: string;
  errCode: string | null;
  errMessage: string | null;
  source: string | null;
  createdAt: Date;
}

export interface SmsMessageDetail extends SmsMessageListItem {
  recipients: Array<{
    id: string;
    messageId: string;
    name: string;
    phone: string;
    status: string;
    createdAt: Date;
  }>;
}

export interface SmsTemplateListItem {
  id: string;
  name: string;
  type: string;
  subject: string | null;
  content: string;
  imageUrl: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateInput {
  name: string;
  type: SmsType;
  subject?: string | null;
  content: string;
  imageUrl?: string | null;
}

export interface TemplateFilter {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// ── Shapes as serialized in API responses ──
// Prisma returns Date values on the server, but they become strings once they pass
// through a JSON response. Client components must use the types below.

export interface SmsMessageListItemJson extends Omit<SmsMessageListItem, 'createdAt'> {
  createdAt: string;
}

export interface SmsRecipientJson {
  id: string;
  messageId: string;
  name: string;
  phone: string;
  status: string;
  createdAt: string;
}

export interface SmsMessageDetailJson extends SmsMessageListItemJson {
  recipients: SmsRecipientJson[];
}

export interface SmsTemplateListItemJson
  extends Omit<SmsTemplateListItem, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}
