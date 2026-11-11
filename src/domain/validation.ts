import { DomainError } from './errors';
import { project } from './ledger';
import { sum } from './money';
import { occurrenceKey } from './recurrence';
import { snapshotSchema } from './types';
import type { Snapshot } from './types';

function requireData(condition: unknown, message: string): asserts condition {
  if (!condition) throw new DomainError('INVALID_DATA', message);
}

export function validateSnapshot(input: unknown): Snapshot {
  const parsed = snapshotSchema.safeParse(input);
  if (!parsed.success) throw new DomainError('INVALID_DATA', `Dati non validi: ${parsed.error.issues[0]?.message ?? 'formato sconosciuto'}`);
  const snapshot = parsed.data;
  for (const [key, collection] of Object.entries(snapshot)) {
    if (!Array.isArray(collection)) continue;
    const keys = collection.map(record => 'id' in record ? record.id : record.month);
    requireData(new Set(keys).size === keys.length, `Identificatori duplicati: ${key}.`);
  }
  if (!snapshot.settings) {
    requireData(Object.values(snapshot).every(value => value === null || (Array.isArray(value) && value.length === 0)), 'Archivio senza configurazione iniziale.');
    return snapshot;
  }
  const envelopes = new Set(snapshot.envelopes.map(envelope => envelope.id));
  const operations = new Map(snapshot.operations.map(operation => [operation.id, operation]));
  const rules = new Set(snapshot.recurrences.map(rule => rule.id));
  const versions = new Map(snapshot.recurrenceVersions.map(version => [version.id, version]));
  const occurrences = new Map(snapshot.occurrences.map(occurrence => [occurrence.id, occurrence]));
  requireData(snapshot.operations.filter(operation => operation.kind === 'opening').length === 1, 'Serve un solo saldo iniziale.');
  requireData(snapshot.operations.find(operation => operation.kind === 'opening')!.effectiveDate === snapshot.settings.startDate, 'La data del saldo iniziale non corrisponde alla data iniziale.');
  requireData(new Set(snapshot.operations.map(operation => operation.sequence)).size === snapshot.operations.length, 'Sequenze movimento duplicate.');
  requireData(new Set(snapshot.policies.map(policy => `${policy.envelopeId}:${policy.effectiveMonth}`)).size === snapshot.policies.length, 'Politiche mensili duplicate.');
  for (const envelope of snapshot.envelopes) requireData(snapshot.policies.some(policy => policy.envelopeId === envelope.id), 'Ogni busta deve avere una politica di riporto.');
  for (const policy of snapshot.policies) requireData(envelopes.has(policy.envelopeId), 'Politica riferita a una busta inesistente.');
  for (const operation of snapshot.operations) {
    requireData(operation.effectiveDate >= snapshot.settings.startDate, 'Movimento precedente al saldo iniziale.');
    for (const leg of operation.envelopeDeltas) requireData(envelopes.has(leg.envelopeId), 'Movimento riferito a una busta inesistente.');
    if (operation.occurrenceId) requireData(occurrences.get(operation.occurrenceId)?.operationId === operation.id, 'Occorrenza del movimento non valida.');
    if (operation.planMonth) requireData(snapshot.monthlyPlans.some(plan => plan.month === operation.planMonth && plan.operationIds.includes(operation.id)), 'Piano del movimento non valido.');
    if (operation.kind === 'refund') {
      const expense = operations.get(operation.refundOf!);
      requireData(expense?.kind === 'expense' && expense.effectiveDate <= operation.effectiveDate, 'Spesa del rimborso non valida.');
      requireData(expense.envelopeDeltas[0]!.envelopeId === operation.envelopeDeltas[0]!.envelopeId, 'Il rimborso deve tornare nella busta originaria.');
      requireData(sum(snapshot.operations.filter(item => item.refundOf === expense.id).map(item => item.cashDeltaCents)) <= -expense.cashDeltaCents, 'I rimborsi superano la spesa originale.');
    }
    if (operation.goalId) requireData(snapshot.goals.some(goal => goal.id === operation.goalId), 'Obiettivo del movimento non valido.');
  }
  for (const template of snapshot.templates) {
    requireData(new Set(template.allocations.map(item => item.envelopeId)).size === template.allocations.length, 'Quote duplicate.');
    for (const item of template.allocations) requireData(envelopes.has(item.envelopeId), 'Quota riferita a una busta inesistente.');
    sum(template.allocations.map(item => item.amountCents));
  }
  for (const plan of snapshot.monthlyPlans) {
    requireData(snapshot.templates.some(template => template.id === plan.templateId), 'Template del piano inesistente.');
    requireData(new Set(plan.allocations.map(item => item.envelopeId)).size === plan.allocations.length, 'Quote del mese duplicate.');
    for (const item of plan.allocations) requireData(envelopes.has(item.envelopeId), 'Busta del piano inesistente.');
    sum(plan.allocations.map(item => item.amountCents));
    for (const operationId of plan.operationIds) requireData(operations.get(operationId)?.planMonth === plan.month, 'Operazione del piano inesistente.');
    requireData(plan.state === 'applied' || plan.operationIds.length === 0, 'Piano non applicato con operazioni finanziarie.');
  }
  for (const version of snapshot.recurrenceVersions) {
    requireData(rules.has(version.ruleId), 'Ricorrenza inesistente.');
    requireData(!version.validThrough || version.validThrough >= version.validFrom, 'Intervallo della ricorrenza non valido.');
    if (version.kind === 'expense') requireData(version.envelopeId && envelopes.has(version.envelopeId), 'Busta della ricorrenza inesistente.');
    const others = snapshot.recurrenceVersions.filter(other => other.ruleId === version.ruleId && other.id !== version.id);
    requireData(!others.some(other => other.validFrom <= (version.validThrough ?? '9999-12-31') && version.validFrom <= (other.validThrough ?? '9999-12-31')), 'Versioni della ricorrenza sovrapposte.');
  }
  if (snapshot.settings.mainRecurrenceId) requireData(rules.has(snapshot.settings.mainRecurrenceId) && snapshot.recurrenceVersions.filter(version => version.ruleId === snapshot.settings!.mainRecurrenceId).every(version => version.kind === 'income'), 'Entrata principale non valida.');
  const occurrenceKeys = snapshot.occurrences.map(occurrence => occurrenceKey(occurrence.ruleId, occurrence.scheduledDate));
  requireData(new Set(occurrenceKeys).size === occurrenceKeys.length, 'Scadenze duplicate.');
  for (const occurrence of snapshot.occurrences) {
    requireData(rules.has(occurrence.ruleId) && versions.get(occurrence.versionId)?.ruleId === occurrence.ruleId, 'Versione della scadenza non valida.');
    requireData(occurrence.state === 'skipped' ? !occurrence.operationId : operations.get(occurrence.operationId ?? '')?.occurrenceId === occurrence.id, 'Movimento della scadenza non valido.');
  }
  const activeGoals = snapshot.goals.filter(goal => goal.state === 'active' || goal.state === 'paused');
  requireData(new Set(activeGoals.map(goal => goal.envelopeId)).size === activeGoals.length, 'Due obiettivi condividono la stessa busta.');
  for (const goal of snapshot.goals) {
    requireData(snapshot.envelopes.some(envelope => envelope.id === goal.envelopeId && envelope.kind === 'goal'), 'Busta obiettivo non valida.');
    if (goal.purchaseOperationId) requireData(operations.get(goal.purchaseOperationId)?.goalId === goal.id, 'Acquisto dell’obiettivo non valido.');
  }
  const lastDate = snapshot.operations.map(operation => operation.effectiveDate).sort().at(-1) ?? snapshot.settings.startDate;
  project(snapshot, lastDate);
  return snapshot;
}
