import { monthKey, monthOf, nextDate, previousDate } from '../../domain/calendar';
import { fundPlan, moveFunds, recordExpense, revisePlan } from '../../domain/budget';
import { DomainError } from '../../domain/errors';
import { appendOperation, project } from '../../domain/ledger';
import { cents, positive } from '../../domain/money';
import { removeMovementGroup } from '../../domain/movements';
import { recordRefund } from '../../domain/refunds';
import { emptySnapshot } from '../../domain/types';
import type { CommandContext, Envelope, Snapshot } from '../../domain/types';
import { validateSnapshot } from '../../domain/validation';
import type { Command } from '../ports';
import { reconcileThrough } from '../reconcile';

function createEnvelope(draft: Snapshot, context: CommandContext, name: string, kind: Envelope['kind'], rollover: 'carry' | 'release-positive'): string {
  const id = context.newId();
  draft.envelopes.push({ id, name, kind, color: kind === 'saving' ? 'yellow' : kind === 'goal' ? 'red' : 'paper', order: draft.envelopes.length, archived: false, createdAt: context.now, updatedAt: context.now, revision: 1 });
  draft.policies.push({ id: context.newId(), envelopeId: id, effectiveMonth: monthOf(context.today), rollover });
  return id;
}

function addRecurrenceVersion(draft: Snapshot, context: CommandContext, input: { recurrenceId: string; name: string; amountCents: number; frequency: 'monthly' | 'yearly'; validFrom: string; anchorDate: string; envelopeId?: string; kind: 'income' | 'expense' }): void {
  if (input.validFrom < nextDate(context.today)) throw new DomainError('INVALID_DATE', 'Scegli una prossima scadenza successiva a oggi.');
  if (input.kind === 'expense' && (!input.envelopeId || !draft.envelopes.some(envelope => envelope.id === input.envelopeId && !envelope.archived))) throw new DomainError('NOT_FOUND', 'Scegli una busta attiva.');
  const pendingIds = new Set(draft.recurrenceVersions.filter(version => version.ruleId === input.recurrenceId && version.validFrom > context.today && !draft.occurrences.some(occurrence => occurrence.versionId === version.id)).map(version => version.id));
  draft.recurrenceVersions = draft.recurrenceVersions.filter(version => !pendingIds.has(version.id));
  const previous = draft.recurrenceVersions.filter(version => version.ruleId === input.recurrenceId).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
  if (previous) previous.validThrough = previousDate(input.validFrom);
  draft.recurrenceVersions.push({ id: context.newId(), ruleId: input.recurrenceId, validFrom: input.validFrom, kind: input.kind, amountCents: positive(input.amountCents), frequency: input.frequency, anchorDate: input.anchorDate, ...(input.envelopeId ? { envelopeId: input.envelopeId } : {}), description: input.name });
}

/** A failed command cannot mutate its input. Storage is deliberately outside this function. */
export function runCommand(snapshot: Snapshot, command: Command, context: CommandContext): Snapshot {
  if (snapshot.receipts.some(receipt => receipt.id === context.commandId)) return structuredClone(snapshot);
  const draft = structuredClone(snapshot);
  const beforeReconcile = { operations: draft.operations.length, occurrences: draft.occurrences.length, plans: draft.monthlyPlans.length };
  if (command.type !== 'setup' && !draft.settings) throw new DomainError('INVALID_DATA', 'Completa prima la configurazione iniziale.');
  switch (command.type) {
    case 'setup': {
      if (draft.settings) throw new DomainError('ALREADY_APPLIED', 'La configurazione iniziale è già completata.');
      if (command.date > context.today) throw new DomainError('INVALID_DATE', 'La data iniziale non può essere futura.');
      Object.assign(draft, emptySnapshot());
      draft.settings = { schemaVersion: 1, locale: 'it-IT', currency: 'EUR', startDate: command.date, onboardingComplete: true, firstPlanMonth: monthOf(command.date) };
      appendOperation(draft, context, { kind: 'opening', effectiveDate: command.date, description: 'Saldo iniziale', cashDeltaCents: cents(command.balanceCents), unassignedDeltaCents: command.balanceCents, envelopeDeltas: [], origin: 'onboarding' });
      createEnvelope(draft, context, 'Spese quotidiane', 'spending', 'release-positive');
      createEnvelope(draft, context, 'Svago', 'spending', 'release-positive');
      createEnvelope(draft, context, 'Abbonamenti', 'spending', 'carry');
      createEnvelope(draft, context, 'Risparmi', 'saving', 'carry');
      // Setup policies start with the ledger, even when opening it later.
      for (const policy of draft.policies) policy.effectiveMonth = monthOf(command.date);
      break;
    }
    case 'income':
      appendOperation(draft, context, { kind: 'income', effectiveDate: command.date, description: command.description, cashDeltaCents: positive(command.amountCents), unassignedDeltaCents: command.amountCents, envelopeDeltas: [] });
      break;
    case 'expense': recordExpense(draft, context, command); break;
    case 'refund': recordRefund(draft, context, command); break;
    case 'update-refund': {
      const previous = draft.operations.find(operation => operation.id === command.refundId && operation.kind === 'refund');
      if (!previous?.refundOf) throw new DomainError('NOT_FOUND', 'Il rimborso non esiste.');
      draft.history.push({ id: context.newId(), commandId: context.commandId, changedAt: context.now, previous, action: 'update' });
      draft.operations = draft.operations.filter(operation => operation.id !== previous.id);
      recordRefund(draft, context, { expenseId: previous.refundOf, date: command.date, amountCents: command.amountCents, description: command.description });
      break;
    }
    case 'delete-refund': {
      const previous = draft.operations.find(operation => operation.id === command.refundId && operation.kind === 'refund');
      if (!previous) throw new DomainError('NOT_FOUND', 'Il rimborso non esiste.');
      draft.history.push({ id: context.newId(), commandId: context.commandId, changedAt: context.now, previous, action: 'delete' });
      draft.operations = draft.operations.filter(operation => operation.id !== previous.id);
      break;
    }
    case 'update-movement': {
      const previous = removeMovementGroup(draft, command.operationId, context, 'update');
      if (previous.kind === 'income') {
        appendOperation(draft, context, { kind: 'income', effectiveDate: command.date, description: command.description, cashDeltaCents: positive(command.amountCents), unassignedDeltaCents: command.amountCents, envelopeDeltas: [] });
      } else {
        if (!command.envelopeId) throw new DomainError('INVALID_DATA', 'Scegli una busta.');
        recordExpense(draft, context, { date: command.date, amountCents: command.amountCents, description: command.description, envelopeId: command.envelopeId, coverage: command.coverage });
      }
      break;
    }
    case 'update-occurrence': {
      const previous = draft.operations.find(operation => operation.id === command.operationId);
      if (!previous || previous.origin !== 'recurring' || !previous.occurrenceId || (previous.kind !== 'income' && previous.kind !== 'expense')) throw new DomainError('INVALID_DATA', 'La registrazione automatica non può essere corretta.');
      if (draft.operations.some(operation => operation.refundOf === previous.id)) throw new DomainError('INVALID_DATA', 'Una spesa rimborsata non può essere corretta.');
      const occurrence = draft.occurrences.find(item => item.id === previous.occurrenceId && item.operationId === previous.id);
      if (!occurrence) throw new DomainError('NOT_FOUND', 'La scadenza collegata non esiste.');
      draft.history.push({ id: context.newId(), commandId: context.commandId, changedAt: context.now, previous, action: 'update' });
      draft.operations = draft.operations.filter(operation => operation.id !== previous.id);
      if (previous.kind === 'income') {
        const replacement = appendOperation(draft, context, { kind: 'income', effectiveDate: command.date, description: command.description, cashDeltaCents: positive(command.amountCents), unassignedDeltaCents: command.amountCents, envelopeDeltas: [], origin: 'recurring', occurrenceId: occurrence.id });
        occurrence.operationId = replacement.id;
      } else {
        if (!command.envelopeId) throw new DomainError('INVALID_DATA', 'Scegli una busta.');
        recordExpense(draft, context, { date: command.date, amountCents: command.amountCents, description: command.description, envelopeId: command.envelopeId, coverage: [], automatic: true, occurrenceId: occurrence.id });
        occurrence.operationId = draft.operations.at(-1)!.id;
      }
      break;
    }
    case 'delete-movement': removeMovementGroup(draft, command.operationId, context, 'delete'); break;
    case 'create-recurrence': {
      if (command.anchorDate < draft.settings!.startDate) throw new DomainError('INVALID_DATE', 'La prima scadenza non può precedere la data iniziale.');
      if (command.kind === 'expense' && (!command.envelopeId || !draft.envelopes.some(envelope => envelope.id === command.envelopeId && !envelope.archived))) throw new DomainError('NOT_FOUND', 'Scegli una busta attiva.');
      if (command.kind === 'income' && command.envelopeId) throw new DomainError('INVALID_DATA', 'Una entrata ricorrente va nei soldi da assegnare.');
      if (command.main && command.kind !== 'income') throw new DomainError('INVALID_DATA', 'Solo una entrata può essere quella principale.');
      if (command.main && draft.settings!.mainRecurrenceId) throw new DomainError('INVALID_DATA', 'Esiste già una entrata principale.');
      const recurrenceId = context.newId();
      draft.recurrences.push({ id: recurrenceId, name: command.name, archived: false, createdAt: context.now, updatedAt: context.now, revision: 1 });
      draft.recurrenceVersions.push({ id: context.newId(), ruleId: recurrenceId, validFrom: command.anchorDate, kind: command.kind, amountCents: positive(command.amountCents), frequency: command.frequency, anchorDate: command.anchorDate, ...(command.envelopeId ? { envelopeId: command.envelopeId } : {}), description: command.name });
      if (command.main) draft.settings!.mainRecurrenceId = recurrenceId;
      reconcileThrough(draft, context);
      break;
    }
    case 'update-recurrence': {
      const recurrence = draft.recurrences.find(item => item.id === command.recurrenceId && !item.archived);
      if (!recurrence) throw new DomainError('NOT_FOUND', 'La ricorrenza non è attiva.');
      const kind = draft.recurrenceVersions.find(version => version.ruleId === recurrence.id)?.kind;
      if (!kind) throw new DomainError('INVALID_DATA', 'La ricorrenza non ha una versione valida.');
      recurrence.name = command.name; recurrence.updatedAt = context.now; recurrence.revision += 1;
      addRecurrenceVersion(draft, context, { recurrenceId: recurrence.id, name: command.name, amountCents: command.amountCents, frequency: command.frequency, validFrom: command.validFrom, anchorDate: command.anchorDate, ...(command.envelopeId ? { envelopeId: command.envelopeId } : {}), kind });
      break;
    }
    case 'reactivate-recurrence': {
      const recurrence = draft.recurrences.find(item => item.id === command.recurrenceId && item.archived);
      if (!recurrence) throw new DomainError('NOT_FOUND', 'La ricorrenza non è disattivata.');
      const kind = draft.recurrenceVersions.find(version => version.ruleId === recurrence.id)?.kind;
      if (!kind) throw new DomainError('INVALID_DATA', 'La ricorrenza non ha una versione valida.');
      if (command.main && kind !== 'income') throw new DomainError('INVALID_DATA', 'Solo una entrata può essere quella principale.');
      if (command.main && draft.settings!.mainRecurrenceId) throw new DomainError('INVALID_DATA', 'Esiste già una entrata principale.');
      recurrence.archived = false; recurrence.name = command.name; recurrence.updatedAt = context.now; recurrence.revision += 1;
      addRecurrenceVersion(draft, context, { recurrenceId: recurrence.id, name: command.name, amountCents: command.amountCents, frequency: command.frequency, validFrom: command.validFrom, anchorDate: command.anchorDate, ...(command.envelopeId ? { envelopeId: command.envelopeId } : {}), kind });
      if (command.main) draft.settings!.mainRecurrenceId = recurrence.id;
      break;
    }
    case 'archive-recurrence': {
      const recurrence = draft.recurrences.find(item => item.id === command.recurrenceId);
      if (!recurrence || recurrence.archived) throw new DomainError('NOT_FOUND', 'La ricorrenza non è attiva.');
      if (command.endDate > context.today) throw new DomainError('INVALID_DATE', 'La data di fine non può essere futura.');
      recurrence.archived = true; recurrence.updatedAt = context.now; recurrence.revision += 1;
      for (const version of draft.recurrenceVersions.filter(item => item.ruleId === recurrence.id && !item.validThrough)) version.validThrough = command.endDate < version.validFrom ? version.validFrom : command.endDate;
      if (draft.settings!.mainRecurrenceId === recurrence.id) delete draft.settings!.mainRecurrenceId;
      break;
    }
    case 'skip-occurrence': {
      const operation = draft.operations.find(item => item.id === command.operationId);
      if (!operation || operation.origin !== 'recurring' || !operation.occurrenceId || (operation.kind !== 'income' && operation.kind !== 'expense')) throw new DomainError('INVALID_DATA', 'La registrazione automatica non può essere eliminata.');
      if (draft.operations.some(item => item.refundOf === operation.id)) throw new DomainError('INVALID_DATA', 'Una spesa rimborsata non può essere eliminata.');
      const occurrence = draft.occurrences.find(item => item.id === operation.occurrenceId && item.operationId === operation.id);
      if (!occurrence) throw new DomainError('NOT_FOUND', 'La scadenza collegata non esiste.');
      draft.history.push({ id: context.newId(), commandId: context.commandId, changedAt: context.now, previous: operation, action: 'delete' });
      draft.operations = draft.operations.filter(item => item.id !== operation.id);
      occurrence.state = 'skipped'; delete occurrence.operationId;
      break;
    }
    case 'save-plan-template': {
      monthKey(command.effectiveMonth);
      if (command.effectiveMonth < draft.settings!.firstPlanMonth) throw new DomainError('INVALID_DATE', 'Il piano non può iniziare prima dell’archivio.');
      if (new Set(command.allocations.map(item => item.envelopeId)).size !== command.allocations.length) throw new DomainError('INVALID_DATA', 'Ogni busta può comparire una sola volta.');
      for (const allocation of command.allocations) {
        if (allocation.amountCents < 0) throw new DomainError('INVALID_MONEY', 'Le quote non possono essere negative.');
        if (!draft.envelopes.some(envelope => envelope.id === allocation.envelopeId && !envelope.archived)) throw new DomainError('NOT_FOUND', 'Una busta del piano non è disponibile.');
      }
      const existing = draft.templates.find(template => template.effectiveMonth === command.effectiveMonth);
      if (existing && !draft.monthlyPlans.some(plan => plan.templateId === existing.id)) { existing.allocations = command.allocations; existing.updatedAt = context.now; existing.revision += 1; }
      else draft.templates.push({ id: context.newId(), effectiveMonth: command.effectiveMonth, allocations: command.allocations, createdAt: context.now, updatedAt: context.now, revision: 1 });
      break;
    }
    case 'apply-plan': {
      const template = draft.templates.filter(item => item.effectiveMonth <= command.month).sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth) || b.updatedAt.localeCompare(a.updatedAt))[0];
      if (!template) throw new DomainError('NOT_FOUND', 'Configura prima il piano mensile.');
      fundPlan(draft, context, { month: command.month, templateId: template.id, allocations: command.allocations, date: command.date, automatic: false });
      break;
    }
    case 'revise-plan': revisePlan(draft, context, command); break;
    case 'reconcile': reconcileThrough(draft, context); break;
    case 'transfer': moveFunds(draft, context, command); break;
    case 'create-envelope': createEnvelope(draft, context, command.name, command.kind, command.rollover); break;
    case 'update-envelope': {
      const envelope = draft.envelopes.find(item => item.id === command.envelopeId && !item.archived);
      if (!envelope) throw new DomainError('NOT_FOUND', 'La busta non è disponibile.');
      monthKey(command.effectiveMonth);
      if (command.effectiveMonth < monthOf(context.today)) throw new DomainError('INVALID_DATE', 'La nuova regola non può modificare mesi precedenti.');
      envelope.name = command.name; envelope.updatedAt = context.now; envelope.revision += 1;
      const policy = draft.policies.find(item => item.envelopeId === envelope.id && item.effectiveMonth === command.effectiveMonth);
      if (policy) policy.rollover = command.rollover;
      else draft.policies.push({ id: context.newId(), envelopeId: envelope.id, effectiveMonth: command.effectiveMonth, rollover: command.rollover });
      break;
    }
    case 'archive-envelope': {
      const envelope = draft.envelopes.find(item => item.id === command.envelopeId && !item.archived);
      if (!envelope) throw new DomainError('NOT_FOUND', 'La busta non è disponibile.');
      if ((project(draft, context.today).envelopes.get(envelope.id) ?? 0) !== 0) throw new DomainError('INVALID_DATA', 'Sposta o copri tutto il saldo prima di archiviare la busta.');
      if (draft.goals.some(goal => goal.envelopeId === envelope.id && (goal.state === 'active' || goal.state === 'paused'))) throw new DomainError('INVALID_DATA', 'La busta appartiene a un obiettivo attivo.');
      if (draft.recurrences.some(rule => !rule.archived && draft.recurrenceVersions.some(version => version.ruleId === rule.id && version.envelopeId === envelope.id && (!version.validThrough || version.validThrough >= context.today)))) throw new DomainError('INVALID_DATA', 'La busta è usata da una ricorrenza attiva.');
      const currentMonth = monthOf(context.today);
      const templateMonths = new Set([currentMonth, ...draft.templates.filter(template => template.effectiveMonth >= currentMonth).map(template => template.effectiveMonth)]);
      const usedByPlan = [...templateMonths].some(month => draft.templates.filter(template => template.effectiveMonth <= month).sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth) || b.updatedAt.localeCompare(a.updatedAt))[0]?.allocations.some(allocation => allocation.envelopeId === envelope.id && allocation.amountCents > 0));
      if (usedByPlan) throw new DomainError('INVALID_DATA', 'Rimuovi prima la busta dal piano mensile.');
      envelope.archived = true; envelope.updatedAt = context.now; envelope.revision += 1;
      break;
    }
    case 'create-goal': {
      const envelopeId = createEnvelope(draft, context, command.title, 'goal', 'carry');
      draft.goals.push({ id: context.newId(), title: command.title, targetCents: positive(command.targetCents), envelopeId, monthlyCents: command.monthlyCents, contributionDay: command.contributionDay, ...(command.targetDate ? { targetDate: command.targetDate } : {}), state: 'active', createdAt: context.now, updatedAt: context.now, revision: 1 });
      break;
    }
    case 'purchase-goal': {
      const goal = draft.goals.find(item => item.id === command.goalId && item.state === 'active');
      if (!goal) throw new DomainError('NOT_FOUND', 'L’obiettivo non è attivo.');
      const amount = positive(command.amountCents);
      if ((project(draft, command.date).envelopes.get(goal.envelopeId) ?? 0) < amount) throw new DomainError('INSUFFICIENT_FUNDS', 'La busta dell’obiettivo non contiene abbastanza soldi per questo acquisto.');
      recordExpense(draft, context, { date: command.date, amountCents: amount, description: command.description, envelopeId: goal.envelopeId, coverage: [] });
      const operation = draft.operations.at(-1)!; operation.goalId = goal.id;
      goal.state = 'purchased'; goal.purchaseOperationId = operation.id; goal.updatedAt = context.now; goal.revision += 1;
      break;
    }
    case 'record-backup-export':
      draft.settings!.lastExportAt = context.now;
      break;
  }
  if (command.type === 'reconcile' && draft.operations.length === beforeReconcile.operations && draft.occurrences.length === beforeReconcile.occurrences && draft.monthlyPlans.length === beforeReconcile.plans) return validateSnapshot(draft);
  draft.receipts.push({ id: context.commandId, createdAt: context.now, operationIds: draft.operations.filter(operation => operation.commandId === context.commandId).map(operation => operation.id) });
  return validateSnapshot(draft);
}
