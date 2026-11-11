import { describe, expect, it } from 'vitest';
import { fixture } from '../../tests/fixtures/ledger';
import { runCommand } from '../application/commands/runCommand';
import { fundPlan, recordExpense } from './budget';
import { appendOperation, assertInvariant, project } from './ledger';
import { validateSnapshot } from './validation';

describe('registro e buste', () => {
  it('accantona senza creare spese e mantiene saldo dopo copertura', () => {
    const f = fixture(); let state = f.setup();
    const spending = state.envelopes[0]!.id; const saving = state.envelopes[3]!.id;
    state = f.command(state, { type: 'transfer', date: '2026-01-01', amountCents: 20_000, fromEnvelopeId: null, toEnvelopeId: saving });
    expect(project(state, '2026-01-31')).toMatchObject({ cash: 80_000, unassigned: 60_000 });
    expect(state.operations.filter(operation => operation.kind === 'expense')).toHaveLength(0);
    state = f.command(state, { type: 'expense', date: '2026-01-02', amountCents: 5_000, description: 'Spesa', envelopeId: spending, coverage: [{ sourceEnvelopeId: null, amountCents: 5_000 }] });
    expect(project(state, '2026-01-31')).toMatchObject({ cash: 75_000, unassigned: 55_000 });
    expect(project(state, '2026-01-31').envelopes.get(saving)).toBe(20_000);
  });
  it('richiede copertura manuale e non modifica input quando un comando fallisce', () => {
    const f = fixture(); const state = f.setup(); const before = structuredClone(state);
    expect(() => f.command(state, { type: 'expense', date: '2026-01-02', amountCents: 5_000, description: 'Spesa', envelopeId: state.envelopes[0]!.id, coverage: [] })).toThrow('Scegli da dove');
    expect(state).toEqual(before);
    expect(() => f.command(state, { type: 'expense', date: '2026-01-02', amountCents: 5_000, description: 'Spesa', envelopeId: state.envelopes[0]!.id, coverage: [{ sourceEnvelopeId: null, amountCents: 2_000 }, { sourceEnvelopeId: state.envelopes[1]!.id, amountCents: 3_000 }] })).toThrow('non ha abbastanza');
    expect(state).toEqual(before);
  });
  it('registra scoperto reale e conserva deficit al cambio mese', () => {
    const f = fixture(); let state = f.setup(2_500); const spending = state.envelopes[0]!.id;
    state = f.command(state, { type: 'transfer', date: '2026-01-01', amountCents: 2_500, fromEnvelopeId: null, toEnvelopeId: spending });
    state = f.command(state, { type: 'expense', date: '2026-01-02', amountCents: 4_000, description: 'Spesa reale', envelopeId: spending, coverage: [] });
    expect(project(state, '2026-02-01').cash).toBe(-1_500);
    expect(project(state, '2026-02-01').envelopes.get(spending)).toBe(-1_500);
  });
  it('rilascia soltanto positivi e ricalcola dopo correzzione storica', () => {
    const f = fixture(); let state = f.setup(); const spending = state.envelopes[0]!.id;
    state = f.command(state, { type: 'transfer', date: '2026-01-01', amountCents: 10_000, fromEnvelopeId: null, toEnvelopeId: spending });
    expect(project(state, '2026-01-31').envelopes.get(spending)).toBe(10_000);
    expect(project(state, '2026-02-01')).toMatchObject({ cash: 80_000, unassigned: 80_000 });
    state = f.command(state, { type: 'expense', date: '2026-01-31', amountCents: 2_000, description: 'Spesa di gennaio', envelopeId: spending, coverage: [] }, '2026-03-15');
    expect(project(state, '2026-02-01')).toMatchObject({ cash: 78_000, unassigned: 78_000 });
    expect(project(state, '2026-03-01').cash).toBe(78_000);
  });
  it('le politiche nuove non cambiano i mesi precedenti', () => {
    const f = fixture(); let state = f.setup(); const saving = state.envelopes[3]!.id;
    state = f.command(state, { type: 'transfer', date: '2026-01-01', amountCents: 10_000, fromEnvelopeId: null, toEnvelopeId: saving });
    state.policies.push({ id: 'future-policy', envelopeId: saving, effectiveMonth: '2026-03', rollover: 'release-positive' });
    expect(project(state, '2026-03-31').envelopes.get(saving)).toBe(10_000);
    expect(project(state, '2026-04-01').envelopes.get(saving)).toBe(0);
  });
  it('una ricorrenza scoperta non preleva soldi da altre buste', () => {
    const f = fixture(); const state = f.setup(); const target = state.envelopes[2]!.id;
    recordExpense(state, f.context(), { date: '2026-01-31', amountCents: 1_200, description: 'Abbonamento', envelopeId: target, coverage: [], automatic: true });
    const balance = project(state, '2026-01-31');
    expect(balance).toMatchObject({ cash: 78_800, unassigned: 80_000 });
    expect(balance.envelopes.get(target)).toBe(-1_200);
  });
  it('il piano insufficiente non assegna quote e aspetta conferma', () => {
    const f = fixture(); let state = f.setup(50_000); const envelopeId = state.envelopes[0]!.id;
    const input = { month: '2026-01', templateId: 'template', allocations: [{ envelopeId, amountCents: 65_000 }], date: '2026-01-31', automatic: true };
    state.templates.push({ id: 'template', createdAt: f.context().now, updatedAt: f.context().now, revision: 1, effectiveMonth: '2026-01', allocations: input.allocations });
    expect(fundPlan(state, f.context(), input)).toBe('needs-review');
    expect(state.operations).toHaveLength(1);
    state = f.command(state, { type: 'income', date: '2026-01-31', amountCents: 20_000, description: 'Altra entrata' });
    expect(fundPlan(state, f.context(), input)).toBe('needs-review');
    expect(fundPlan(state, f.context(), { ...input, automatic: false })).toBe('applied');
    expect(project(state, '2026-01-31').unassigned).toBe(5_000);
    expect(() => fundPlan(state, f.context(), input)).toThrow('già applicato');
    validateSnapshot(state);
  });
  it('non ripete un comando con la stessa ricevuta', () => {
    const f = fixture(); const state = f.setup(); const context = f.context();
    const command = { type: 'income' as const, date: '2026-01-02', amountCents: 1_000, description: 'Entrata' };
    const next = runCommand(state, command, context);
    expect(runCommand(next, command, context)).toEqual(next);
  });
  it('rifiuta rimborsi non collegati, eccessivi o su altra busta', () => {
    const f = fixture(); let state = f.setup(0); const envelopeId = state.envelopes[0]!.id;
    state = f.command(state, { type: 'expense', date: '2026-01-02', amountCents: 4_000, description: 'Spesa', envelopeId, coverage: [] });
    const expense = state.operations.at(-1)!;
    appendOperation(state, f.context(), { kind: 'refund', effectiveDate: '2026-01-03', description: 'Rimborso', cashDeltaCents: 1_500, unassignedDeltaCents: 0, envelopeDeltas: [{ envelopeId, deltaCents: 1_500 }], refundOf: expense.id });
    expect(validateSnapshot(state).operations).toHaveLength(3);
    expect(project(state, '2026-01-31').cash).toBe(-2_500);
    appendOperation(state, f.context(), { kind: 'refund', effectiveDate: '2026-01-04', description: 'Rimborso eccessivo', cashDeltaCents: 3_000, unassignedDeltaCents: 0, envelopeDeltas: [{ envelopeId, deltaCents: 3_000 }], refundOf: expense.id });
    expect(() => validateSnapshot(state)).toThrow('superano');
  });
  it('mantiene invariante lungo una sequenza di entrate, spese e riporti', () => {
    const f = fixture(); const state = f.setup(); const envelopeId = state.envelopes[0]!.id;
    for (let index = 1; index <= 100; index++) {
      const date = index < 50 ? '2026-01-31' : '2026-02-28';
      appendOperation(state, f.context('2026-02-28'), { kind: 'income', effectiveDate: date, description: 'Entrata', cashDeltaCents: index * 11, unassignedDeltaCents: index * 11, envelopeDeltas: [] });
      recordExpense(state, f.context('2026-02-28'), { date, amountCents: index * 13, description: 'Spesa', envelopeId, coverage: [], automatic: true });
      assertInvariant(project(state, date));
    }
    assertInvariant(project(state, '2026-03-01'));
  });
});
