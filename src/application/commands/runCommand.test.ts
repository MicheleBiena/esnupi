import { describe, expect, it } from 'vitest';
import { fixture } from '../../../tests/fixtures/ledger';
import { project } from '../../domain/ledger';
import { refundableAmount } from '../../domain/refunds';

describe('correzione dei movimenti manuali', () => {
  it('sostituisce una spesa e la sua copertura, conservando lo storico', () => {
    const f = fixture();
    let state = f.setup();
    const envelopeId = state.envelopes[0]!.id;
    state = f.command(state, { type: 'expense', date: '2026-01-02', amountCents: 5_000, description: 'Prima', envelopeId, coverage: [{ sourceEnvelopeId: null, amountCents: 5_000 }] });
    const expense = state.operations.find(operation => operation.kind === 'expense')!;
    const original = structuredClone(state);
    const updated = f.command(state, { type: 'update-movement', operationId: expense.id, date: '2026-01-03', amountCents: 3_000, description: 'Corretta', envelopeId, coverage: [{ sourceEnvelopeId: null, amountCents: 3_000 }] });

    expect(state).toEqual(original);
    expect(updated.operations.filter(operation => operation.kind === 'expense')).toHaveLength(1);
    expect(updated.operations.find(operation => operation.kind === 'expense')?.description).toBe('Corretta');
    expect(updated.history).toHaveLength(2);
    expect(updated.history.every(item => item.action === 'update')).toBe(true);
    expect(project(updated, '2026-01-31').cash).toBe(77_000);
  });

  it('elimina una entrata e impedisce di eliminare il saldo iniziale', () => {
    const f = fixture();
    let state = f.setup();
    state = f.command(state, { type: 'income', date: '2026-01-02', amountCents: 2_000, description: 'Extra' });
    const income = state.operations.find(operation => operation.kind === 'income')!;
    const deleted = f.command(state, { type: 'delete-movement', operationId: income.id });
    expect(deleted.operations.some(operation => operation.id === income.id)).toBe(false);
    expect(deleted.history[0]).toMatchObject({ action: 'delete', previous: { id: income.id } });
    expect(project(deleted, '2026-01-31').cash).toBe(80_000);
    const opening = deleted.operations.find(operation => operation.kind === 'opening')!;
    expect(() => f.command(deleted, { type: 'delete-movement', operationId: opening.id })).toThrow('soltanto entrate e uscite manuali');
  });

  it('registra rimborsi parziali nella busta originale e impedisce eccedenze', () => {
    const f = fixture();
    let state = f.setup(0);
    const envelopeId = state.envelopes[0]!.id;
    state = f.command(state, { type: 'expense', date: '2026-01-02', amountCents: 4_000, description: 'Acquisto', envelopeId, coverage: [] });
    const expense = state.operations.find(operation => operation.kind === 'expense')!;
    expect(() => f.command(state, { type: 'refund', expenseId: expense.id, date: '2026-01-01', amountCents: 500, description: 'Troppo presto' })).toThrow('non può precedere');
    state = f.command(state, { type: 'refund', expenseId: expense.id, date: '2026-01-03', amountCents: 1_500, description: 'Rimborso parziale' });
    expect(refundableAmount(state, expense.id)).toBe(2_500);
    expect(project(state, '2026-01-31').cash).toBe(-2_500);
    expect(project(state, '2026-01-31').envelopes.get(envelopeId)).toBe(-2_500);
    const before = structuredClone(state);
    expect(() => f.command(state, { type: 'refund', expenseId: expense.id, date: '2026-01-04', amountCents: 2_501, description: 'Eccessivo' })).toThrow('supera');
    expect(state).toEqual(before);
    state = f.command(state, { type: 'refund', expenseId: expense.id, date: '2026-01-04', amountCents: 2_500, description: 'Saldo rimborso' });
    expect(refundableAmount(state, expense.id)).toBe(0);
    expect(project(state, '2026-01-31').cash).toBe(0);
    expect(() => f.command(state, { type: 'delete-movement', operationId: expense.id })).toThrow('rimborsata');
  });

  it('corregge ed elimina un rimborso conservando lo storico', () => {
    const f = fixture();
    let state = f.setup(0);
    const envelopeId = state.envelopes[0]!.id;
    state = f.command(state, { type: 'expense', date: '2026-01-02', amountCents: 4_000, description: 'Acquisto', envelopeId, coverage: [] });
    const expense = state.operations.find(operation => operation.kind === 'expense')!;
    state = f.command(state, { type: 'refund', expenseId: expense.id, date: '2026-01-03', amountCents: 1_500, description: 'Rimborso' });
    const refund = state.operations.find(operation => operation.kind === 'refund')!;
    state = f.command(state, { type: 'update-refund', refundId: refund.id, date: '2026-01-04', amountCents: 1_000, description: 'Rimborso corretto' });
    const corrected = state.operations.find(operation => operation.kind === 'refund')!;
    expect(corrected).toMatchObject({ description: 'Rimborso corretto', cashDeltaCents: 1_000, refundOf: expense.id });
    expect(state.history[0]).toMatchObject({ action: 'update', previous: { id: refund.id } });
    state = f.command(state, { type: 'delete-refund', refundId: corrected.id });
    expect(state.operations.some(operation => operation.kind === 'refund')).toBe(false);
    expect(state.history[1]).toMatchObject({ action: 'delete', previous: { id: corrected.id } });
    expect(project(state, '2026-01-31').cash).toBe(-4_000);
  });

  it('versiona la politica di una busta e la archivia soltanto a saldo zero', () => {
    const f = fixture();
    let state = f.setup();
    const savingId = state.envelopes.find(envelope => envelope.name === 'Risparmi')!.id;
    state = f.command(state, { type: 'transfer', date: '2026-01-31', amountCents: 10_000, fromEnvelopeId: null, toEnvelopeId: savingId });
    state = f.command(state, { type: 'update-envelope', envelopeId: savingId, name: 'Fondo emergenze', rollover: 'release-positive', effectiveMonth: '2026-03' }, '2026-03-15');
    expect(state.envelopes.find(envelope => envelope.id === savingId)?.name).toBe('Fondo emergenze');
    expect(project(state, '2026-02-28').envelopes.get(savingId)).toBe(10_000);
    expect(project(state, '2026-03-31').envelopes.get(savingId)).toBe(10_000);
    expect(project(state, '2026-04-01').envelopes.get(savingId)).toBe(0);
    expect(() => f.command(state, { type: 'archive-envelope', envelopeId: savingId }, '2026-03-15')).toThrow('saldo');
    state = f.command(state, { type: 'transfer', date: '2026-03-15', amountCents: 10_000, fromEnvelopeId: savingId, toEnvelopeId: null }, '2026-03-15');
    state = f.command(state, { type: 'archive-envelope', envelopeId: savingId }, '2026-03-15');
    expect(state.envelopes.find(envelope => envelope.id === savingId)?.archived).toBe(true);
  });

  it('registra l’acquisto di un obiettivo dalla busta dedicata e conserva il residuo', () => {
    const f = fixture();
    let state = f.setup();
    state = f.command(state, { type: 'create-goal', title: 'Computer', targetCents: 68_000, monthlyCents: 8_000, contributionDay: 5 });
    const goal = state.goals[0]!;
    state = f.command(state, { type: 'transfer', date: '2026-01-31', amountCents: 70_000, fromEnvelopeId: null, toEnvelopeId: goal.envelopeId });
    state = f.command(state, { type: 'purchase-goal', goalId: goal.id, date: '2026-01-31', amountCents: 68_000, description: 'Acquisto computer' });
    const purchased = state.goals[0]!;
    const operation = state.operations.find(item => item.id === purchased.purchaseOperationId)!;
    expect(purchased.state).toBe('purchased');
    expect(operation).toMatchObject({ kind: 'expense', cashDeltaCents: -68_000, goalId: goal.id });
    expect(project(state, '2026-01-31').envelopes.get(goal.envelopeId)).toBe(2_000);
    expect(project(state, '2026-01-31').cash).toBe(12_000);
    expect(() => f.command(state, { type: 'purchase-goal', goalId: goal.id, date: '2026-01-31', amountCents: 1_000, description: 'Secondo acquisto' })).toThrow('non è attivo');
  });

  it('registra quando viene avviato un export senza cambiare i dati finanziari', () => {
    const f = fixture();
    const state = f.setup();
    const exported = f.command(state, { type: 'record-backup-export' }, '2026-02-03');
    expect(exported.settings?.lastExportAt).toBe('2026-02-03T12:00:00.000Z');
    expect(project(exported, '2026-02-03')).toEqual(project(state, '2026-02-03'));
  });
});
