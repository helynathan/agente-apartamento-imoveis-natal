import { describe, it, expect } from 'vitest';
import { isValidPhone } from './isValidPhone';

describe('isValidPhone', () => {
  it('accepts a valid Brazilian mobile number (55 + DDD + 9 digits)', () => {
    expect(isValidPhone('5511988887777')).toBe(true);
  });

  it('accepts a valid Brazilian landline-length number (55 + DDD + 8 digits)', () => {
    expect(isValidPhone('551133334444')).toBe(true);
  });

  it('rejects a number with a plus sign', () => {
    expect(isValidPhone('+5511988887777')).toBe(false);
  });

  it('rejects a number with spaces', () => {
    expect(isValidPhone('55 11 988887777')).toBe(false);
  });

  it('rejects a number with dashes or parentheses', () => {
    expect(isValidPhone('(11) 98888-7777')).toBe(false);
  });

  it('rejects a number that is too short', () => {
    expect(isValidPhone('123456789')).toBe(false);
  });

  it('rejects a number that is too long', () => {
    expect(isValidPhone('12345678901234')).toBe(false);
  });

  it('rejects non-digit characters mixed with digits', () => {
    expect(isValidPhone('5511abc887777')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidPhone('')).toBe(false);
  });
});
