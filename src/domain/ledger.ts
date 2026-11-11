import { endOfMonth, monthOf, shiftMonth, localDate } from './calendar';
import { DomainError } from './errors';
import { cents, sum } from './money';
import { operationSchema } from './types';
import type { CommandContext, EnvelopePolicy, Operation, Snapshot } from './types';

export interface Balance { cash: number; unassigned: number; envelopes: ReadonlyMap<string, number> }

export function assertInvariant(balance: Balance): void {
  if (balance.cash !== sum([balance.unassigned, ...balance.envelopes.values()])) throw new DomainError('INVALID_DATA', 'Il registro non è bilanciato.');
}

export function policyAt(policies: EnvelopePolicy[], envelopeId: string, month: string): EnvelopePolicy | undefined {
  return policies.filter(policy => policy.envelopeId === envelopeId && policy.effectiveMonth <= month)
    .sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0];
}

export function project(snapshot: Snapshot, through: string): Balance {
  localDate(through);
  let cash = 0;
  let unassigned = 0;
  const envelopes = new Map(snapshot.envelopes.map(envelope => [envelope.id, 0]));
  const operations = snapshot.operations.filter(operation => operation.effectiveDate <= through)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || a.sequence - b.sequence || a.id.localeCompare(b.id));
  let month = monthOf(snapshot.settings?.startDate ?? through);
  const rollover = (): void => {
    for (const [envelopeId, available] of envelopes) {
      if (available > 0 && policyAt(snapshot.policies, envelopeId, month)?.rollover === 'release-positive') {
        envelopes.set(envelopeId, 0);
        unassigned = sum([unassigned, available]);
      }
    }
    month = shiftMonth(month, 1);
  };
  for (const operation of operations) {
    operationSchema.parse(operation);
    while (month < monthOf(operation.effectiveDate)) rollover();
    cash = sum([cash, operation.cashDeltaCents]);
    unassigned = sum([unassigned, operation.unassignedDeltaCents]);
    for (const leg of operation.envelopeDeltas) {
      if (!envelopes.has(leg.envelopeId)) throw new DomainError('NOT_FOUND', 'La busta del movimento non esiste.');
      envelopes.set(leg.envelopeId, sum([envelopes.get(leg.envelopeId)!, leg.deltaCents]));
    }
  }
  while (month < monthOf(through)) rollover();
  const result = { cash, unassigned, envelopes };
  assertInvariant(result);
  return result;
}

export function monthView(snapshot: Snapshot, month: string, today: string) {
  localDate(today);
  if (month > monthOf(today)) throw new DomainError('INVALID_DATE', 'I mesi futuri appartengono alle previsioni.');
  const cutoff = endOfMonth(month) < today ? endOfMonth(month) : today;
  const operations = snapshot.operations.filter(operation => monthOf(operation.effectiveDate) === month && operation.effectiveDate <= cutoff);
  return {
    balance: project(snapshot, cutoff),
    income: sum(operations.filter(operation => operation.kind === 'income').map(operation => operation.cashDeltaCents)),
    expenses: sum(operations.filter(operation => operation.kind === 'expense' || operation.kind === 'refund').map(operation => -operation.cashDeltaCents)),
    operations: operations.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || b.sequence - a.sequence),
  };
}

type OperationInput = Pick<Operation, 'kind' | 'effectiveDate' | 'description' | 'cashDeltaCents' | 'unassignedDeltaCents' | 'envelopeDeltas'> & Partial<Pick<Operation, 'origin' | 'notes' | 'occurrenceId' | 'planMonth' | 'refundOf' | 'goalId'>>;

export function appendOperation(snapshot: Snapshot, context: CommandContext, input: OperationInput): Operation {
  localDate(input.effectiveDate);
  if (!snapshot.settings || input.effectiveDate < snapshot.settings.startDate || input.effectiveDate > context.today) {
    throw new DomainError('INVALID_DATE', 'La data deve essere compresa tra la data iniziale e oggi.');
  }
  const sequence = cents(snapshot.operations.reduce((maximum, operation) => Math.max(maximum, operation.sequence), 0) + 1);
  const operation = operationSchema.parse({
    id: context.newId(), commandId: context.commandId, createdAt: context.now, updatedAt: context.now, revision: 1,
    sequence, origin: 'manual', notes: '', ...input,
  });
  snapshot.operations.push(operation);
  return operation;
}
