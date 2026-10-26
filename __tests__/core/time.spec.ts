import { describe, expect, test } from 'vite-plus/test';
import { ValidationError } from '../../src/core/errors';
import {
  formatEatDate,
  formatEatDateTime,
  formatTimestamp,
  parseB2CDateTime,
  parseEatDay,
  parseTimestamp,
} from '../../src/core/time';

describe('formatTimestamp', () => {
  test('formats in East Africa Time (UTC+3)', () => {
    expect(formatTimestamp(new Date('2026-09-29T08:30:00.000Z'))).toBe('20260929113000');
  });

  test('crosses day and year boundaries', () => {
    expect(formatTimestamp(new Date('2026-12-31T22:00:00.000Z'))).toBe('20270101010000');
  });
});

describe('formatEatDate', () => {
  test('formats as yyyymmdd in East Africa Time, across UTC midnight', () => {
    expect(formatEatDate(new Date('2026-10-07T21:30:00Z'))).toBe('20261008');
    expect(formatEatDate(new Date('2026-10-07T20:59:59Z'))).toBe('20261007');
  });
});

describe('formatEatDateTime', () => {
  test('formats as YYYY-MM-DD HH:mm:ss in East Africa Time', () => {
    expect(formatEatDateTime(new Date('2020-08-04T05:36:00Z'))).toBe('2020-08-04 08:36:00');
  });

  test('crosses day and year boundaries and pads every part', () => {
    expect(formatEatDateTime(new Date('2026-12-31T22:01:02.900Z'))).toBe('2027-01-01 01:01:02');
  });
});

describe('parseTimestamp', () => {
  test('parses a string YYYYMMDDHHmmss in EAT', () => {
    expect(parseTimestamp('20191219102115').toISOString()).toBe('2019-12-19T07:21:15.000Z');
  });

  test('parses a numeric timestamp', () => {
    expect(parseTimestamp(20191219102115).toISOString()).toBe('2019-12-19T07:21:15.000Z');
  });

  test('rejects malformed values', () => {
    expect(() => parseTimestamp('2019121910')).toThrow(ValidationError);
    expect(() => parseTimestamp('20191319102115')).toThrow(ValidationError);
  });
});

describe('parseB2CDateTime', () => {
  test('parses dd.MM.yyyy HH:mm:ss in EAT', () => {
    expect(parseB2CDateTime('06.07.2024 22:48:52').toISOString()).toBe('2024-07-06T19:48:52.000Z');
  });

  test('rejects malformed values', () => {
    expect(() => parseB2CDateTime('2024-07-06 22:48:52')).toThrow(ValidationError);
  });
});

describe('parseEatDay', () => {
  test('reads YYYY-MM-DD as midnight East Africa Time', () => {
    expect(parseEatDay('2021-10-01').toISOString()).toBe('2021-09-30T21:00:00.000Z');
  });

  test.each(['2021-02-30', '2021-10-1', '01-10-2021', '2021-10-01T00:00'])(
    'rejects %j',
    (value) => {
      expect(() => parseEatDay(value)).toThrow(ValidationError);
    },
  );
});
