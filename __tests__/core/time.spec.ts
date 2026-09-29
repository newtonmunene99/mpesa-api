import { describe, expect, test } from 'vite-plus/test';
import { ValidationError } from '../../src/core/errors';
import { formatTimestamp, parseB2CDateTime, parseTimestamp } from '../../src/core/time';

describe('formatTimestamp', () => {
  test('formats in East Africa Time (UTC+3)', () => {
    expect(formatTimestamp(new Date('2026-09-29T08:30:00.000Z'))).toBe('20260929113000');
  });

  test('crosses day and year boundaries', () => {
    expect(formatTimestamp(new Date('2026-12-31T22:00:00.000Z'))).toBe('20270101010000');
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
