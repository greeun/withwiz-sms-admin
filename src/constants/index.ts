import { SMS_MAX_BYTES, type SmsType } from '@withwiz/sms-core';

/**
 * Static values shared by the service layer, the UI components and the consuming
 * project's route handlers.
 *
 * These live behind their own entry point (`@withwiz/sms-admin/constants`) because the
 * root entry point is server-only and the components entry point is emitted with a
 * `"use client"` directive, while these values are needed on both sides.
 */

// ── API paths ──

/** Default base path of the SMS admin API group. */
export const DEFAULT_BASE_PATH = '/api/admin/sms';

/** Endpoint segments appended to the base path. */
export const SMS_ENDPOINTS = {
  send: '/send',
  remain: '/remain',
  templates: '/templates',
  detail: (id: string) => `/${id}`,
} as const;

/** Default sessionStorage key holding recipients collected on another screen. */
export const DEFAULT_RECIPIENT_STORAGE_KEY = 'sms_recipients';

// ── Byte limits ──

/** Maximum byte length of an LMS or MMS body, on an EUC-KR basis. */
export const LMS_MAX_BYTES = 2000;

/** Maximum byte length of an LMS or MMS subject, on an EUC-KR basis. */
export const SUBJECT_MAX_BYTES = 40;

/**
 * Maximum body byte length per message type. The SMS entry reuses `SMS_MAX_BYTES` from
 * `@withwiz/sms-core` so that the 90-byte limit stays defined in a single place.
 */
export const MAX_CONTENT_BYTES: Record<SmsType, number> = {
  SMS: SMS_MAX_BYTES,
  LMS: LMS_MAX_BYTES,
  MMS: LMS_MAX_BYTES,
};

// ── Pagination ──

/** Page size used when a request does not specify one. */
export const DEFAULT_PAGE_SIZE = 20;

/** Upper bound on the page size a request may ask for. */
export const MAX_PAGE_SIZE = 200;

// ── Remaining quota display ──

/** Under this many remaining messages the quota badge turns red. */
export const REMAIN_LOW_THRESHOLD = 100;

/** Under this many remaining messages the quota badge turns orange. */
export const REMAIN_WARN_THRESHOLD = 1000;

// ── Input constraints ──

/** Length of a fully formatted Korean mobile number, such as 010-1234-5678. */
export const PHONE_INPUT_MAX_LENGTH = 13;

/** Image MIME types the send form accepts. The MMS specification allows JPEG only. */
export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/jpg'] as const;

/** The same list in the form an `<input type="file">` accept attribute takes. */
export const ALLOWED_IMAGE_ACCEPT = ALLOWED_IMAGE_MIME.join(',');
