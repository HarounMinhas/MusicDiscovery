import { describe, it, expect } from 'vitest';

import { parseBoolean } from '../parseBoolean.js';

describe('parseBoolean', () => {
  it('converts string "true" to true', () => {
    expect(parseBoolean('true', false)).toBe(true);
  });

  it('converts string "false" to false', () => {
    expect(parseBoolean('false', true)).toBe(false);
  });

  it('returns default for unknown strings', () => {
    expect(parseBoolean('unknown', true)).toBe(true);
    expect(parseBoolean('unknown', false)).toBe(false);
  });

  it('passes through boolean values', () => {
    expect(parseBoolean(true, false)).toBe(true);
    expect(parseBoolean(false, true)).toBe(false);
  });

  it('returns default for undefined', () => {
    expect(parseBoolean(undefined, true)).toBe(true);
    expect(parseBoolean(undefined, false)).toBe(false);
  });
});
