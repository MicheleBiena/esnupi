import { describe, expect, it } from 'vitest';
import { fixture } from '../../tests/fixtures/ledger';
import { project } from '../domain/ledger';

describe('riconciliazione di ricorrenze e piano', () => {
  it('recupera i mesi in ordine, applica il piano una volta e non duplica', () => {
    const f = fixture();
    let state = f.setup(0);
    const savingId = state.envelopes.find(envelope => envelope.name === 'Risparmi')!.id;
    const subscriptionsId = state.envelopes.find(envelope => envelope.name === 'Abbonamenti')!.id;
    state = f.command(state, { type: 'save-plan-template', effectiveMonth: '2026-01', allocations: [{ envelopeId: savingId, amountCents: 65_000 }] });
    state = f.command(state, { type: 'create-recurrence', name: 'Entrata mensile', kind: 'income', amountCents: 80_000, frequency: 'monthly', anchorDate: '2026-01-31', main: true });
    state = f.command(state, { type: 'create-recurrence', name: 'Telefono', kind: 'expense', amountCents: 1_200, frequency: 'monthly', anchorDate: '2026-01-31', envelopeId: subscriptionsId, main: false });
    state = f.command(state, { type: 'reconcile' }, '2026-03-31');

    expect(state.occurrences).toHaveLength(6);
    expect(state.monthlyPlans.map(plan => plan.month).sort()).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(state.monthlyPlans.every(plan => plan.state === 'applied')).toBe(true);
    expect(state.operations.filter(operation => operation.effectiveDate === '2026-02-28').map(operation => operation.kind)).toEqual(['income', 'allocation', 'expense']);
    expect(project(state, '2026-03-31')).toMatchObject({ cash: 236_400, unassigned: 45_000 });
    expect(project(state, '2026-03-31').envelopes.get(savingId)).toBe(195_000);
    const operationCount = state.operations.length;
    const again = f.command(state, { type: 'reconcile' }, '2026-03-31');
    expect(again.operations).toHaveLength(operationCount);
    expect(again.occurrences).toHaveLength(6);
  });

  it('lascia il piano da rivedere e applica soltanto le quote confermate', () => {
    const f = fixture();
    let state = f.setup(0);
    const savingId = state.envelopes.find(envelope => envelope.name === 'Risparmi')!.id;
    state = f.command(state, { type: 'save-plan-template', effectiveMonth: '2026-01', allocations: [{ envelopeId: savingId, amountCents: 65_000 }] });
    state = f.command(state, { type: 'create-recurrence', name: 'Entrata mensile', kind: 'income', amountCents: 50_000, frequency: 'monthly', anchorDate: '2026-01-31', main: true });
    expect(state.monthlyPlans[0]?.state).toBe('needs-review');
    expect(state.operations.filter(operation => operation.kind === 'allocation')).toHaveLength(0);
    state = f.command(state, { type: 'apply-plan', month: '2026-01', date: '2026-01-31', allocations: [{ envelopeId: savingId, amountCents: 45_000 }] });
    expect(state.monthlyPlans[0]?.state).toBe('applied');
    expect(project(state, '2026-01-31').unassigned).toBe(5_000);
    expect(project(state, '2026-01-31').envelopes.get(savingId)).toBe(45_000);
  });

  it('registra una uscita automatica anche se la busta resta negativa', () => {
    const f = fixture();
    let state = f.setup(2_500);
    const subscriptionsId = state.envelopes.find(envelope => envelope.name === 'Abbonamenti')!.id;
    state = f.command(state, { type: 'transfer', date: '2026-01-31', amountCents: 500, fromEnvelopeId: null, toEnvelopeId: subscriptionsId });
    state = f.command(state, { type: 'create-recurrence', name: 'Telefono', kind: 'expense', amountCents: 1_200, frequency: 'monthly', anchorDate: '2026-01-31', envelopeId: subscriptionsId, main: false });
    const balance = project(state, '2026-01-31');
    expect(balance.cash).toBe(1_300);
    expect(balance.envelopes.get(subscriptionsId)).toBe(-700);
    expect(state.operations.find(operation => operation.kind === 'expense')).toMatchObject({ origin: 'recurring' });
  });

  it('corregge una singola occorrenza senza cambiare il piano già applicato', () => {
    const f = fixture();
    let state = f.setup(0);
    const savingId = state.envelopes.find(envelope => envelope.name === 'Risparmi')!.id;
    state = f.command(state, { type: 'save-plan-template', effectiveMonth: '2026-01', allocations: [{ envelopeId: savingId, amountCents: 65_000 }] });
    state = f.command(state, { type: 'create-recurrence', name: 'Entrata mensile', kind: 'income', amountCents: 80_000, frequency: 'monthly', anchorDate: '2026-01-31', main: true });
    const original = state.operations.find(operation => operation.kind === 'income')!;
    const occurrence = state.occurrences.find(item => item.operationId === original.id)!;
    state = f.command(state, { type: 'update-occurrence', operationId: original.id, date: '2026-01-31', amountCents: 70_000, description: 'Entrata corretta' });
    expect(state.occurrences.find(item => item.id === occurrence.id)).toMatchObject({ scheduledDate: '2026-01-31' });
    expect(state.occurrences.find(item => item.id === occurrence.id)?.operationId).not.toBe(original.id);
    expect(state.monthlyPlans[0]?.operationIds).toHaveLength(1);
    expect(state.history[0]).toMatchObject({ action: 'update', previous: { id: original.id } });
    expect(project(state, '2026-01-31')).toMatchObject({ cash: 70_000, unassigned: 5_000 });
  });

  it('accetta una prima scadenza futura e la disattivazione impedisce di registrarla', () => {
    const f = fixture();
    let state = f.setup(0);
    const envelopeId = state.envelopes.find(envelope => envelope.name === 'Abbonamenti')!.id;
    state = f.command(state, { type: 'create-recurrence', name: 'Futura', kind: 'expense', amountCents: 1_000, frequency: 'monthly', anchorDate: '2026-03-31', envelopeId, main: false });
    expect(state.occurrences).toHaveLength(0);
    const recurrenceId = state.recurrences[0]!.id;
    state = f.command(state, { type: 'archive-recurrence', recurrenceId, endDate: '2026-01-31' });
    state = f.command(state, { type: 'reconcile' }, '2026-03-31');
    expect(state.occurrences).toHaveLength(0);
    expect(state.operations.filter(operation => operation.kind === 'expense')).toHaveLength(0);
  });

  it('applica una nuova versione soltanto alle scadenze future e conserva il giorno originale', () => {
    const f = fixture();
    let state = f.setup(0);
    const envelopeId = state.envelopes.find(envelope => envelope.name === 'Abbonamenti')!.id;
    state = f.command(state, { type: 'create-recurrence', name: 'Telefono', kind: 'expense', amountCents: 1_000, frequency: 'monthly', anchorDate: '2026-01-31', envelopeId, main: false });
    const recurrenceId = state.recurrences[0]!.id;
    state = f.command(state, { type: 'update-recurrence', recurrenceId, name: 'Telefono aggiornato', amountCents: 2_000, frequency: 'monthly', validFrom: '2026-02-28', anchorDate: '2026-01-31', envelopeId }, '2026-01-31');
    state = f.command(state, { type: 'reconcile' }, '2026-03-31');
    const expenses = state.operations.filter(operation => operation.kind === 'expense').sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
    expect(expenses.map(operation => [operation.effectiveDate, operation.cashDeltaCents])).toEqual([['2026-01-31', -1_000], ['2026-02-28', -2_000], ['2026-03-31', -2_000]]);
    expect(state.recurrenceVersions).toHaveLength(2);
    expect(state.recurrenceVersions.find(version => version.validFrom === '2026-01-31')?.validThrough).toBe('2026-02-27');
  });

  it('elimina una singola occorrenza e non la rigenera', () => {
    const f = fixture();
    let state = f.setup(0);
    const envelopeId = state.envelopes.find(envelope => envelope.name === 'Abbonamenti')!.id;
    state = f.command(state, { type: 'create-recurrence', name: 'Telefono', kind: 'expense', amountCents: 1_000, frequency: 'monthly', anchorDate: '2026-01-31', envelopeId, main: false });
    state = f.command(state, { type: 'reconcile' }, '2026-02-28');
    const february = state.operations.find(operation => operation.kind === 'expense' && operation.effectiveDate === '2026-02-28')!;
    state = f.command(state, { type: 'skip-occurrence', operationId: february.id }, '2026-02-28');
    const skipped = state.occurrences.find(occurrence => occurrence.scheduledDate === '2026-02-28');
    expect(skipped).toMatchObject({ state: 'skipped' });
    expect(skipped).not.toHaveProperty('operationId');
    state = f.command(state, { type: 'reconcile' }, '2026-03-31');
    expect(state.operations.some(operation => operation.id === february.id)).toBe(false);
    expect(state.occurrences.filter(occurrence => occurrence.scheduledDate === '2026-02-28')).toHaveLength(1);
    expect(state.operations.some(operation => operation.kind === 'expense' && operation.effectiveDate === '2026-03-31')).toBe(true);
  });

  it('riattiva una regola disattivata con una nuova versione', () => {
    const f = fixture();
    let state = f.setup(0);
    const envelopeId = state.envelopes.find(envelope => envelope.name === 'Abbonamenti')!.id;
    state = f.command(state, { type: 'create-recurrence', name: 'Futura', kind: 'expense', amountCents: 1_000, frequency: 'monthly', anchorDate: '2026-03-31', envelopeId, main: false });
    const recurrenceId = state.recurrences[0]!.id;
    state = f.command(state, { type: 'archive-recurrence', recurrenceId, endDate: '2026-01-31' });
    state = f.command(state, { type: 'reactivate-recurrence', recurrenceId, name: 'Riattivata', amountCents: 1_500, frequency: 'monthly', validFrom: '2026-02-28', anchorDate: '2026-01-31', envelopeId, main: false }, '2026-01-31');
    state = f.command(state, { type: 'reconcile' }, '2026-03-31');
    expect(state.recurrences[0]).toMatchObject({ archived: false, name: 'Riattivata' });
    expect(state.operations.filter(operation => operation.kind === 'expense').map(operation => operation.effectiveDate)).toEqual(['2026-02-28', '2026-03-31']);
  });

  it('revisiona un piano applicato registrando soltanto aumenti e restituzioni', () => {
    const f = fixture();
    let state = f.setup(0);
    const spendingId = state.envelopes.find(envelope => envelope.name === 'Spese quotidiane')!.id;
    const savingId = state.envelopes.find(envelope => envelope.name === 'Risparmi')!.id;
    state = f.command(state, { type: 'save-plan-template', effectiveMonth: '2026-01', allocations: [{ envelopeId: spendingId, amountCents: 30_000 }, { envelopeId: savingId, amountCents: 20_000 }] });
    state = f.command(state, { type: 'create-recurrence', name: 'Entrata', kind: 'income', amountCents: 80_000, frequency: 'monthly', anchorDate: '2026-01-31', main: true });
    const originalOperationIds = [...state.monthlyPlans[0]!.operationIds];
    state = f.command(state, { type: 'revise-plan', month: '2026-01', date: '2026-01-31', allocations: [{ envelopeId: spendingId, amountCents: 10_000 }, { envelopeId: savingId, amountCents: 30_000 }] });
    const balance = project(state, '2026-01-31');
    expect(balance.unassigned).toBe(40_000);
    expect(balance.envelopes.get(spendingId)).toBe(10_000);
    expect(balance.envelopes.get(savingId)).toBe(30_000);
    expect(state.monthlyPlans[0]!.operationIds).toHaveLength(originalOperationIds.length + 2);
    expect(state.operations.filter(operation => operation.description === 'Revisione piano mensile').map(operation => operation.kind)).toEqual(['release', 'allocation']);
  });

  it('non riduce una quota già spesa e lascia lo snapshot invariato', () => {
    const f = fixture();
    let state = f.setup(0);
    const spendingId = state.envelopes.find(envelope => envelope.name === 'Spese quotidiane')!.id;
    state = f.command(state, { type: 'save-plan-template', effectiveMonth: '2026-01', allocations: [{ envelopeId: spendingId, amountCents: 30_000 }] });
    state = f.command(state, { type: 'create-recurrence', name: 'Entrata', kind: 'income', amountCents: 80_000, frequency: 'monthly', anchorDate: '2026-01-31', main: true });
    state = f.command(state, { type: 'expense', date: '2026-01-31', amountCents: 25_000, description: 'Spesa', envelopeId: spendingId, coverage: [] });
    const before = structuredClone(state);
    expect(() => f.command(state, { type: 'revise-plan', month: '2026-01', date: '2026-01-31', allocations: [{ envelopeId: spendingId, amountCents: 0 }] })).toThrow('non contiene più abbastanza');
    expect(state).toEqual(before);
  });
});
