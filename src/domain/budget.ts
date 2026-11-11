import { monthOf } from './calendar';
import { DomainError } from './errors';
import { appendOperation, project } from './ledger';
import { positive, sum } from './money';
import type { Allocation, CommandContext, Snapshot } from './types';

export interface Coverage { sourceEnvelopeId: string | null; amountCents: number }

export function moveFunds(snapshot: Snapshot, context: CommandContext, input: {
  fromEnvelopeId: string | null; toEnvelopeId: string | null; amountCents: number; date: string;
}): void {
  const { fromEnvelopeId: from, toEnvelopeId: to, amountCents, date } = input;
  positive(amountCents);
  if (from === to) throw new DomainError('INVALID_DATA', 'Scegli due destinazioni diverse.');
  for (const envelopeId of [from, to]) {
    if (envelopeId && !snapshot.envelopes.some(envelope => envelope.id === envelopeId && !envelope.archived)) throw new DomainError('NOT_FOUND', 'La busta non è disponibile.');
  }
  const balance = project(snapshot, date);
  const available = from === null ? balance.unassigned : balance.envelopes.get(from) ?? 0;
  if (available < amountCents) throw new DomainError('INSUFFICIENT_FUNDS', 'La sorgente scelta non ha abbastanza soldi disponibili.');
  appendOperation(snapshot, context, {
    effectiveDate: date, description: 'Spostamento tra buste', kind: from === null ? 'allocation' : to === null ? 'release' : 'transfer',
    cashDeltaCents: 0, unassignedDeltaCents: from === null ? -amountCents : to === null ? amountCents : 0,
    envelopeDeltas: [...(from ? [{ envelopeId: from, deltaCents: -amountCents }] : []), ...(to ? [{ envelopeId: to, deltaCents: amountCents }] : [])],
  });
}

export function recordExpense(snapshot: Snapshot, context: CommandContext, input: {
  amountCents: number; envelopeId: string; date: string; description: string; coverage: Coverage[];
  automatic?: boolean; occurrenceId?: string;
}): void {
  positive(input.amountCents);
  if (!snapshot.envelopes.some(envelope => envelope.id === input.envelopeId && !envelope.archived)) throw new DomainError('NOT_FOUND', 'Scegli una busta attiva.');
  const balance = project(snapshot, input.date);
  const deficit = Math.max(0, sum([input.amountCents, -(balance.envelopes.get(input.envelopeId) ?? 0)]));
  const coverage = sum(input.coverage.map(source => positive(source.amountCents)));
  if (coverage > deficit) throw new DomainError('INVALID_DATA', 'La copertura supera la differenza necessaria.');
  if (!input.automatic && balance.cash >= input.amountCents && coverage < deficit) throw new DomainError('COVERAGE_REQUIRED', 'Scegli da dove coprire la differenza prima di registrare la spesa.');
  for (const source of input.coverage) {
    moveFunds(snapshot, context, { fromEnvelopeId: source.sourceEnvelopeId, toEnvelopeId: input.envelopeId, amountCents: source.amountCents, date: input.date });
  }
  appendOperation(snapshot, context, {
    kind: 'expense', effectiveDate: input.date, description: input.description,
    cashDeltaCents: -input.amountCents, unassignedDeltaCents: 0,
    envelopeDeltas: [{ envelopeId: input.envelopeId, deltaCents: -input.amountCents }],
    origin: input.automatic ? 'recurring' : 'manual',
    ...(input.occurrenceId ? { occurrenceId: input.occurrenceId } : {}),
  });
}

/** Mutates a draft only; the application commits the entire draft atomically. */
export function fundPlan(snapshot: Snapshot, context: CommandContext, input: {
  month: string; templateId: string; allocations: Allocation[]; date: string; automatic: boolean;
}): 'applied' | 'needs-review' {
  if (monthOf(input.date) !== input.month) throw new DomainError('INVALID_DATE', 'Il piano deve essere applicato nel suo mese.');
  const existing = snapshot.monthlyPlans.find(plan => plan.month === input.month);
  if (existing?.state === 'applied') throw new DomainError('ALREADY_APPLIED', 'Piano già applicato: una revisione deve indicare soltanto le differenze.');
  if (existing?.state === 'needs-review' && input.automatic) return 'needs-review';
  if (new Set(input.allocations.map(item => item.envelopeId)).size !== input.allocations.length) throw new DomainError('INVALID_DATA', 'Ogni busta può comparire una sola volta nel piano.');
  const requested = sum(input.allocations.map(item => {
    if (item.amountCents < 0) throw new DomainError('INVALID_MONEY', 'Le quote non possono essere negative.');
    return item.amountCents;
  }));
  const plan = { month: input.month, templateId: input.templateId, allocations: input.allocations, state: 'needs-review' as 'needs-review' | 'applied', operationIds: [] as string[] };
  snapshot.monthlyPlans = snapshot.monthlyPlans.filter(item => item.month !== input.month);
  snapshot.monthlyPlans.push(plan);
  if (project(snapshot, input.date).unassigned < requested) return 'needs-review';
  for (const allocation of input.allocations) {
    if (allocation.amountCents === 0) continue;
    moveFunds(snapshot, context, { fromEnvelopeId: null, toEnvelopeId: allocation.envelopeId, amountCents: allocation.amountCents, date: input.date });
    const operation = snapshot.operations.at(-1)!;
    operation.origin = 'plan';
    operation.planMonth = input.month;
    plan.operationIds.push(operation.id);
  }
  Object.assign(plan, { state: 'applied', appliedAt: context.now });
  return 'applied';
}

/** Revises an applied month by recording only explicit differences from its current allocations. */
export function revisePlan(snapshot: Snapshot, context: CommandContext, input: { month: string; allocations: Allocation[]; date: string }): void {
  if (monthOf(input.date) !== input.month) throw new DomainError('INVALID_DATE', 'La revisione deve essere registrata nel mese del piano.');
  const plan = snapshot.monthlyPlans.find(item => item.month === input.month);
  if (!plan || plan.state !== 'applied') throw new DomainError('INVALID_DATA', 'Puoi revisionare soltanto un piano già applicato.');
  if (new Set(input.allocations.map(item => item.envelopeId)).size !== input.allocations.length) throw new DomainError('INVALID_DATA', 'Ogni busta può comparire una sola volta nel piano.');
  for (const allocation of input.allocations) {
    if (allocation.amountCents < 0) throw new DomainError('INVALID_MONEY', 'Le quote non possono essere negative.');
    if (!snapshot.envelopes.some(envelope => envelope.id === allocation.envelopeId && !envelope.archived)) throw new DomainError('NOT_FOUND', 'Una busta del piano non è disponibile.');
  }
  const before = new Map(plan.allocations.map(item => [item.envelopeId, item.amountCents]));
  const after = new Map(input.allocations.map(item => [item.envelopeId, item.amountCents]));
  const envelopeIds = new Set([...before.keys(), ...after.keys()]);
  const deltas = [...envelopeIds].map(envelopeId => ({ envelopeId, amountCents: (after.get(envelopeId) ?? 0) - (before.get(envelopeId) ?? 0) }));
  if (deltas.every(item => item.amountCents === 0)) throw new DomainError('INVALID_DATA', 'Le quote del mese non sono cambiate.');

  const balance = project(snapshot, input.date);
  for (const delta of deltas.filter(item => item.amountCents < 0)) {
    const available = balance.envelopes.get(delta.envelopeId) ?? 0;
    if (available < -delta.amountCents) {
      const name = snapshot.envelopes.find(envelope => envelope.id === delta.envelopeId)?.name ?? 'La busta';
      throw new DomainError('INSUFFICIENT_FUNDS', `${name} non contiene più abbastanza soldi per ridurre la quota.`);
    }
  }
  const released = sum(deltas.filter(item => item.amountCents < 0).map(item => -item.amountCents));
  const requested = sum(deltas.filter(item => item.amountCents > 0).map(item => item.amountCents));
  if (sum([balance.unassigned, released]) < requested) throw new DomainError('INSUFFICIENT_FUNDS', 'I soldi da assegnare non bastano per aumentare queste quote.');

  for (const delta of deltas.filter(item => item.amountCents < 0)) {
    moveFunds(snapshot, context, { fromEnvelopeId: delta.envelopeId, toEnvelopeId: null, amountCents: -delta.amountCents, date: input.date });
    const operation = snapshot.operations.at(-1)!; operation.origin = 'plan'; operation.planMonth = input.month; operation.description = 'Revisione piano mensile'; plan.operationIds.push(operation.id);
  }
  for (const delta of deltas.filter(item => item.amountCents > 0)) {
    moveFunds(snapshot, context, { fromEnvelopeId: null, toEnvelopeId: delta.envelopeId, amountCents: delta.amountCents, date: input.date });
    const operation = snapshot.operations.at(-1)!; operation.origin = 'plan'; operation.planMonth = input.month; operation.description = 'Revisione piano mensile'; plan.operationIds.push(operation.id);
  }
  plan.allocations = input.allocations;
}
