import { describe, expect, it } from 'vitest';
import { dateInMonth, localDate, nextDate, previousDate, shiftMonth } from './calendar';
import { dueDates } from './recurrence';
import type { RecurrenceVersion } from './types';

const rule: RecurrenceVersion = { id: 'version', ruleId: 'rule', validFrom: '2026-01-01', kind: 'income', amountCents: 80_000, frequency: 'monthly', anchorDate: '2026-01-31', description: 'Entrata' };

describe('calendario civile e ricorrenze pure', () => {
  it('mantiene il giorno originale dopo febbraio', () => {
    expect(dueDates(rule, '2026-01-01', '2026-03-31')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(dateInMonth('2028-02', 31)).toBe('2028-02-29');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
  it('ripristina il 29 febbraio negli anni bisestili', () => {
    expect(dueDates({ ...rule, frequency: 'yearly', anchorDate: '2024-02-29', validFrom: '2024-01-01' }, '2024-01-01', '2028-02-29')).toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
  });
  it('rispetta limiti di versione, inizio archivio e oggi', () => {
    expect(dueDates({ ...rule, validThrough: '2026-03-01' }, '2026-02-01', '2026-12-31')).toEqual(['2026-02-28']);
    expect(dueDates(rule, '2025-01-01', '2026-01-30')).toEqual([]);
  });
  it('sposta un giorno attraverso mese e anno', () => {
    expect(nextDate('2026-02-28')).toBe('2026-03-01');
    expect(previousDate('2026-03-01')).toBe('2026-02-28');
    expect(nextDate('2027-12-31')).toBe('2028-01-01');
  });
  it.each(['2026-02-29', '2026-04-31', '2026-00-01', '0000-01-01', '2026-1-01'])('rifiuta date impossibili: %s', value => expect(() => localDate(value)).toThrow());
});
