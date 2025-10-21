import { describe, expect, it } from 'vitest';

import { parseBoolean } from '../parseBoolean';

describe('parseBoolean', () => {
  it('returns boolean values as-is', () => {
    expect(parseBoolean(true)).toBe(true);
    expect(parseBoolean(false)).toBe(false);
  });

  it('parses common truthy strings', () => {
    expect(parseBoolean('true')).toBe(true);
    expect(parseBoolean('TRUE')).toBe(true);
    expect(parseBoolean(' yes ')).toBe(true);
    expect(parseBoolean('1')).toBe(true);
    expect(parseBoolean('on')).toBe(true);
  });

  it('parses common falsy strings', () => {
    expect(parseBoolean('false')).toBe(false);
    expect(parseBoolean('FALSE')).toBe(false);
    expect(parseBoolean(' no ')).toBe(false);
    expect(parseBoolean('0')).toBe(false);
    expect(parseBoolean('off')).toBe(false);
    expect(parseBoolean('')).toBe(false);
  });

  it('falls back to default when string is unrecognized', () => {
    expect(parseBoolean('maybe', true)).toBe(true);
    expect(parseBoolean('perhaps', false)).toBe(false);
  });

  it('uses default for non-string values', () => {
    expect(parseBoolean(undefined)).toBe(false);
    expect(parseBoolean(undefined, true)).toBe(true);
    expect(parseBoolean(0 as unknown, true)).toBe(true);
    expect(parseBoolean(1 as unknown, false)).toBe(false);
  });
});
