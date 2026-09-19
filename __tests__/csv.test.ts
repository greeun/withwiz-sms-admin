import { describe, expect, it } from 'vitest';
import { buildMessageCsv, buildTemplateCsv, csvFileName, toCsv } from '../src/services/csv';

describe('toCsv', () => {
  it('leaves headers as is and quotes only the value cells', () => {
    expect(toCsv(['A', 'B'], [[1, 'x']])).toBe('﻿A,B\n"1","x"');
  });

  it('escapes a quote inside a cell by doubling it', () => {
    expect(toCsv(['A'], [['he said "hi"']])).toBe('﻿A\n"he said ""hi"""');
  });

  it('renders null and undefined as empty cells', () => {
    expect(toCsv(['A', 'B'], [[null, undefined]])).toBe('﻿A,B\n"",""');
  });
});

describe('buildMessageCsv', () => {
  it('maps status and source through the labels it is given', () => {
    const csv = buildMessageCsv(
      [
        {
          id: 'M1',
          type: 'SMS',
          subject: null,
          content: 'content',
          imageUrl: null,
          sender: '021234567',
          totalCount: 2,
          successCount: 2,
          failCount: 0,
          status: 'SENT',
          errCode: null,
          errMessage: null,
          source: 'briefing',
          createdAt: new Date('2026-09-19T01:00:00Z'),
        },
      ],
      { status: { SENT: 'Sent' }, source: { briefing: 'Briefing' } },
    );

    expect(csv).toContain('"Sent"');
    expect(csv).toContain('"Briefing"');
    expect(csv).toContain('"SMS"');
  });

  it('keeps the raw value when no label is given', () => {
    const csv = buildMessageCsv(
      [
        {
          id: 'M1',
          type: 'LMS',
          subject: 'Subject',
          content: 'content',
          imageUrl: null,
          sender: '021234567',
          totalCount: 1,
          successCount: null,
          failCount: null,
          status: 'UNKNOWN',
          errCode: null,
          errMessage: null,
          source: 'other',
          createdAt: new Date('2026-09-19T01:00:00Z'),
        },
      ],
      {},
    );

    expect(csv).toContain('"UNKNOWN"');
    expect(csv).toContain('"other"');
    // null successCount and failCount are written as 0
    expect(csv).toContain('"0","0"');
  });
});

describe('buildTemplateCsv', () => {
  it('writes the built-in flag as its Korean label', () => {
    const csv = buildTemplateCsv([
      {
        id: 'T1',
        name: 'Notice',
        type: 'SMS',
        subject: null,
        content: 'content',
        imageUrl: null,
        isSystem: true,
        createdAt: new Date('2026-09-19T01:00:00Z'),
        updatedAt: new Date('2026-09-19T01:00:00Z'),
      },
    ]);

    expect(csv).toContain('"기본제공"');
  });

  it('uses the created-at header and the YYYY/MM/DD HH:mm date format', () => {
    // This is the header and format the original templates/export/route.ts used, and it
    // differs from the toLocaleString format of the delivery history export. Pinned here so
    // the two do not get mixed up during the migration.
    const csv = buildTemplateCsv([
      {
        id: 'T1',
        name: 'Notice',
        type: 'SMS',
        subject: null,
        content: 'content',
        imageUrl: null,
        isSystem: false,
        createdAt: new Date(2026, 8, 19, 1, 5),
        updatedAt: new Date(2026, 8, 20, 14, 30),
      },
    ]);

    expect(csv).toContain('생성일');
    expect(csv).toContain('"2026/09/19 01:05"');
    expect(csv).toContain('"2026/09/20 14:30"');
  });
});

describe('csvFileName', () => {
  it('joins the prefix and the date', () => {
    expect(csvFileName('sms-history', new Date('2026-09-19T01:00:00'))).toBe(
      'sms-history_2026-09-19.csv',
    );
  });
});
