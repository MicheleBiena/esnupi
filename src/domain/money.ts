import { DomainError } from './errors';

export function cents(value: number): number {
  if (!Number.isSafeInteger(value)) throw new DomainError('INVALID_MONEY', 'Importo fuori intervallo o con precisione non valida.');
  return value;
}

export function sum(values: Iterable<number>): number {
  let result = 0n;
  for (const value of values) result += BigInt(cents(value));
  return cents(Number(result));
}

export function positive(value: number): number {
  cents(value);
  if (value <= 0) throw new DomainError('INVALID_MONEY', 'Inserisci un importo maggiore di zero.');
  return value;
}

/** Input intentionally excludes thousands separators, exponents and excess decimals. */
export function parseMoney(input: string): number {
  const match = /^(\d+)(?:[,.](\d{1,2}))?$/.exec(input.trim());
  if (!match) throw new DomainError('INVALID_MONEY', 'Usa un importo come 12,50, senza separatori delle migliaia.');
  const value = BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new DomainError('INVALID_MONEY', 'Importo troppo grande.');
  return Number(value);
}

export function ceilDivide(amount: number, count: number): number {
  cents(amount);
  if (amount < 0 || !Number.isSafeInteger(count) || count <= 0) throw new DomainError('INVALID_MONEY', 'Divisione monetaria non valida.');
  return Number((BigInt(amount) + BigInt(count) - 1n) / BigInt(count));
}

const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
export const formatMoney = (value: number): string => euro.format(cents(value) / 100);
