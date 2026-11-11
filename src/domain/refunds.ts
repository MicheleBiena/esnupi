import { DomainError } from './errors';
import { appendOperation } from './ledger';
import { positive, sum } from './money';
import type { CommandContext, Operation, Snapshot } from './types';

function expenseFor(snapshot: Snapshot, expenseId: string): Operation {
  const expense = snapshot.operations.find(operation => operation.id === expenseId);
  if (!expense || expense.kind !== 'expense') throw new DomainError('NOT_FOUND', 'La spesa da rimborsare non esiste.');
  return expense;
}

export function refundableAmount(snapshot: Snapshot, expenseId: string): number {
  const expense = expenseFor(snapshot, expenseId);
  const refunded = sum(snapshot.operations.filter(operation => operation.refundOf === expense.id).map(operation => operation.cashDeltaCents));
  return sum([-expense.cashDeltaCents, -refunded]);
}

export function recordRefund(snapshot: Snapshot, context: CommandContext, input: { expenseId: string; date: string; amountCents: number; description: string }): void {
  const expense = expenseFor(snapshot, input.expenseId);
  if (input.date < expense.effectiveDate) throw new DomainError('INVALID_DATE', 'Il rimborso non può precedere la spesa.');
  const amount = positive(input.amountCents);
  if (amount > refundableAmount(snapshot, expense.id)) throw new DomainError('INVALID_MONEY', 'Il rimborso supera l’importo ancora rimborsabile.');
  const envelopeId = expense.envelopeDeltas[0]?.envelopeId;
  if (!envelopeId) throw new DomainError('INVALID_DATA', 'La spesa non ha una busta valida.');
  appendOperation(snapshot, context, {
    kind: 'refund', effectiveDate: input.date, description: input.description,
    cashDeltaCents: amount, unassignedDeltaCents: 0,
    envelopeDeltas: [{ envelopeId, deltaCents: amount }], refundOf: expense.id,
  });
}
