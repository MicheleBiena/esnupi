import { DomainError } from './errors';

export type LocalDate = string;
export type MonthKey = string;

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function dateParts(value: LocalDate): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new DomainError('INVALID_DATE', 'Usa una data valida nel formato anno-mese-giorno.');
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year! < 1 || month! < 1 || month! > 12 || day! < 1 || day! > daysInMonth(year!, month!)) {
    throw new DomainError('INVALID_DATE', 'La data non esiste nel calendario.');
  }
  return { year: year!, month: month!, day: day! };
}

export function localDate(value: string): LocalDate { dateParts(value); return value; }
export function monthKey(value: string): MonthKey { localDate(`${value}-01`); return value; }
export function monthOf(value: LocalDate): MonthKey { dateParts(value); return value.slice(0, 7); }

export function dateInMonth(month: MonthKey, anchorDay: number): LocalDate {
  const { year, month: index } = dateParts(`${month}-01`);
  if (!Number.isInteger(anchorDay) || anchorDay < 1 || anchorDay > 31) throw new DomainError('INVALID_DATE', 'Scegli un giorno tra 1 e 31.');
  return `${month}-${String(Math.min(anchorDay, daysInMonth(year, index))).padStart(2, '0')}`;
}

export function shiftMonth(month: MonthKey, count: number): MonthKey {
  const { year, month: index } = dateParts(`${month}-01`);
  if (!Number.isSafeInteger(count)) throw new DomainError('INVALID_DATE', 'Intervallo non valido.');
  const serial = year * 12 + index - 1 + count;
  const nextYear = Math.floor(serial / 12);
  if (nextYear < 1 || nextYear > 9999) throw new DomainError('INVALID_DATE', 'Data fuori dal calendario supportato.');
  return `${String(nextYear).padStart(4, '0')}-${String(serial % 12 + 1).padStart(2, '0')}`;
}

export function endOfMonth(month: MonthKey): LocalDate { return dateInMonth(month, 31); }

export function previousDate(value: LocalDate): LocalDate {
  const { year, month, day } = dateParts(value);
  if (day > 1) return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day - 1).padStart(2, '0')}`;
  return endOfMonth(shiftMonth(monthOf(value), -1));
}

export function nextDate(value: LocalDate): LocalDate {
  const { year, month, day } = dateParts(value);
  if (day < daysInMonth(year, month)) return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day + 1).padStart(2, '0')}`;
  return `${shiftMonth(monthOf(value), 1)}-01`;
}

export function formatDate(value: LocalDate): string {
  const { year, month, day } = dateParts(value);
  // Explicit construction avoids UTC parsing and handles years below 100 correctly.
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}
