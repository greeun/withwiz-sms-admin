import type { SmsMessageListItem, SmsTemplateListItem } from '../types';

/** Byte order mark prepended so that Excel reads the file as UTF-8. */
const BOM = '﻿';

export interface CsvLabels {
  status?: Record<string, string>;
  source?: Record<string, string>;
}

function escape(value: unknown): string {
  const s = value == null ? '' : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

// The two original export routes used different date formats. Step 1 aims to preserve
// behavior, so each format is kept exactly as it was.

/** Date format for the delivery history export, as used by the original `export/route.ts`. */
function formatMessageDate(d: Date): string {
  return d.toLocaleString('ko-KR');
}

/** Date format for the template export, as used by the original `templates/export/route.ts`. */
function formatTemplateDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  // Headers are left unescaped because the original routes wrote them verbatim.
  // Values may contain commas or quotes, so they do need escaping.
  const lines = [headers.join(','), ...rows.map((r) => r.map(escape).join(','))];
  return BOM + lines.join('\n');
}

const MESSAGE_HEADERS = [
  '발송일시',
  '유형',
  '제목',
  '내용',
  '전체건수',
  '성공건수',
  '실패건수',
  '상태',
  '출처',
];

export function buildMessageCsv(items: SmsMessageListItem[], labels: CsvLabels = {}): string {
  const rows = items.map((it) => [
    formatMessageDate(it.createdAt),
    it.type,
    it.subject ?? '',
    it.content,
    it.totalCount,
    it.successCount ?? 0,
    it.failCount ?? 0,
    labels.status?.[it.status] ?? it.status,
    it.source ? (labels.source?.[it.source] ?? it.source) : '',
  ]);
  return toCsv(MESSAGE_HEADERS, rows);
}

const TEMPLATE_HEADERS = ['이름', '유형', '구분', '제목', '내용', '생성일', '수정일'];

export function buildTemplateCsv(items: SmsTemplateListItem[]): string {
  const rows = items.map((it) => [
    it.name,
    it.type,
    it.isSystem ? '기본제공' : '사용자추가',
    it.subject ?? '',
    it.content,
    formatTemplateDate(it.createdAt),
    formatTemplateDate(it.updatedAt),
  ]);
  return toCsv(TEMPLATE_HEADERS, rows);
}

/** Builds a file name in the form `prefix_YYYY-MM-DD.csv`. */
export function csvFileName(prefix: string, date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${prefix}_${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.csv`;
}
