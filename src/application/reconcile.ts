import { fundPlan, recordExpense } from '../domain/budget';
import { appendOperation } from '../domain/ledger';
import { dueDates, occurrenceKey } from '../domain/recurrence';
import type { BudgetTemplate, CommandContext, RecurrenceVersion, Snapshot } from '../domain/types';

function templateAt(snapshot: Snapshot, month: string): BudgetTemplate | undefined {
  return snapshot.templates.filter(template => template.effectiveMonth <= month)
    .sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth) || b.updatedAt.localeCompare(a.updatedAt))[0];
}

export function reconcileThrough(snapshot: Snapshot, context: CommandContext): void {
  if (!snapshot.settings) return;
  const existing = new Set(snapshot.occurrences.map(occurrence => occurrenceKey(occurrence.ruleId, occurrence.scheduledDate)));
  const activeRules = new Set(snapshot.recurrences.filter(recurrence => !recurrence.archived).map(recurrence => recurrence.id));
  const due: { version: RecurrenceVersion; date: string }[] = [];
  for (const version of snapshot.recurrenceVersions) {
    if (!activeRules.has(version.ruleId)) continue;
    for (const date of dueDates(version, snapshot.settings.startDate, context.today)) {
      if (!existing.has(occurrenceKey(version.ruleId, date))) due.push({ version, date });
    }
  }
  due.sort((a, b) => a.date.localeCompare(b.date) || a.version.ruleId.localeCompare(b.version.ruleId));

  for (const date of [...new Set(due.map(item => item.date))]) {
    const daily = due.filter(item => item.date === date);
    let mainIncomePosted = false;
    for (const item of daily.filter(item => item.version.kind === 'income')) {
      const occurrenceId = context.newId();
      const operation = appendOperation(snapshot, context, {
        kind: 'income', effectiveDate: item.date, description: item.version.description,
        cashDeltaCents: item.version.amountCents, unassignedDeltaCents: item.version.amountCents,
        envelopeDeltas: [], origin: 'recurring', occurrenceId,
      });
      snapshot.occurrences.push({ id: occurrenceId, ruleId: item.version.ruleId, scheduledDate: item.date, versionId: item.version.id, state: 'posted', operationId: operation.id });
      existing.add(occurrenceKey(item.version.ruleId, item.date));
      if (snapshot.settings.mainRecurrenceId === item.version.ruleId) mainIncomePosted = true;
    }

    if (mainIncomePosted) {
      const month = date.slice(0, 7);
      const template = templateAt(snapshot, month);
      if (template && !snapshot.monthlyPlans.some(plan => plan.month === month)) {
        fundPlan(snapshot, context, { month, templateId: template.id, allocations: template.allocations, date, automatic: true });
      }
    }

    for (const item of daily.filter(item => item.version.kind === 'expense')) {
      const occurrenceId = context.newId();
      recordExpense(snapshot, context, {
        amountCents: item.version.amountCents, envelopeId: item.version.envelopeId!, date: item.date,
        description: item.version.description, coverage: [], automatic: true, occurrenceId,
      });
      const operationId = snapshot.operations.at(-1)!.id;
      snapshot.occurrences.push({ id: occurrenceId, ruleId: item.version.ruleId, scheduledDate: item.date, versionId: item.version.id, state: 'posted', operationId });
      existing.add(occurrenceKey(item.version.ruleId, item.date));
    }
  }
}
