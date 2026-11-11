import { describe, expect, it } from 'vitest';
import { cents, ceilDivide, parseMoney, sum } from './money';

describe('importi esatti', () => {
  it.each([['12,50', 1250], ['0', 0], [' 1.2 ', 120], ['0004,01', 401], ['90071992547409,91', Number.MAX_SAFE_INTEGER]])('legge %s come centesimi interi', (input, expected) => expect(parseMoney(input)).toBe(expected));
  it.each(['1.000,00', '1,000', '1e3', '-1', 'Infinity', '', '.5', 'NaN', '90071992547409,92'])('rifiuta formato ambiguo o fuori intervallo: %s', input => expect(() => parseMoney(input)).toThrow());
  it('non perde centesimi con somme e divisioni vicine al limite', () => {
    expect(sum([Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER, 1])).toBe(1);
    expect(ceilDivide(Number.MAX_SAFE_INTEGER, 2)).toBe(4_503_599_627_370_496);
    expect(ceilDivide(100, 3)).toBe(34);
    expect(() => sum([Number.MAX_SAFE_INTEGER, 1])).toThrow();
    expect(() => cents(0.1)).toThrow();
  });
});
