import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { fixture } from '../../../tests/fixtures/ledger';
import { project } from '../../domain/ledger';
import { exportBackup, inspectBackup } from '../backup/backup';
import { openRepository } from './repository';

describe('transazioni e backup con IndexedDB', () => {
  it('persiste e serializza due scritture concorrenti senza perdere entrate', async () => {
    const name = `test-${crypto.randomUUID()}`; const f = fixture();
    const first = await openRepository(name); const second = await openRepository(name);
    try {
      await first.runCommand({ type: 'setup', date: '2026-01-01', balanceCents: 80_000 }, f.context());
      await Promise.all([
        first.runCommand({ type: 'income', date: '2026-01-02', amountCents: 1_000, description: 'Uno' }, f.context()),
        second.runCommand({ type: 'income', date: '2026-01-02', amountCents: 2_000, description: 'Due' }, f.context()),
      ]);
      expect(project(await first.loadSnapshot(), '2026-01-31').cash).toBe(83_000);
      first.close();
      const reopened = await openRepository(name);
      expect(project(await reopened.loadSnapshot(), '2026-01-31').cash).toBe(83_000); reopened.close();
    } finally { first.close(); second.close(); }
  });
  it('deduplica lo stesso comando da due tab', async () => {
    const f = fixture(); const name = `test-${crypto.randomUUID()}`;
    const first = await openRepository(name); const second = await openRepository(name);
    try {
      await first.runCommand({ type: 'setup', date: '2026-01-01', balanceCents: 0 }, f.context());
      const command = { type: 'income' as const, date: '2026-01-02', amountCents: 1_000, description: 'Unica' }; const context = f.context();
      await Promise.all([first.runCommand(command, context), second.runCommand(command, context)]);
      expect(project(await second.loadSnapshot(), '2026-01-31').cash).toBe(1_000);
    } finally { first.close(); second.close(); }
  });
  it('non lascia copertura parziale quando la spesa non può essere salvata', async () => {
    const f = fixture(); const repo = await openRepository(`test-${crypto.randomUUID()}`);
    try {
      const state = await repo.runCommand({ type: 'setup', date: '2026-01-01', balanceCents: 80_000 }, f.context());
      await expect(repo.runCommand({ type: 'expense', date: '2026-01-02', amountCents: 5_000, description: 'Spesa', envelopeId: state.envelopes[0]!.id, coverage: [{ sourceEnvelopeId: null, amountCents: 2_000 }, { sourceEnvelopeId: state.envelopes[1]!.id, amountCents: 3_000 }] }, f.context())).rejects.toThrow();
      expect(await repo.loadSnapshot()).toEqual(state);
    } finally { repo.close(); }
  });
  it('ripristina un backup completo e rifiuta file corrotti senza cambiare archivio', async () => {
    const f = fixture(); const repo = await openRepository(`test-${crypto.randomUUID()}`);
    try {
      const original = f.setup(); const exportedAt = f.context().now; const text = exportBackup(original, exportedAt);
      await repo.restoreBackup(inspectBackup(text));
      expect(await repo.loadSnapshot()).toEqual({ ...original, settings: { ...original.settings!, lastExportAt: exportedAt } });
      expect(() => inspectBackup('{')).toThrow('JSON');
      expect(() => inspectBackup(text.replace('"schemaVersion": 1', '"schemaVersion": 999'))).toThrow('versione');
      const corrupt = structuredClone(original); corrupt.operations[0]!.cashDeltaCents += 1;
      await expect(repo.restoreBackup(corrupt)).rejects.toThrow();
      const missing = structuredClone(original); missing.envelopes = [];
      await expect(repo.restoreBackup(missing)).rejects.toThrow();
      expect(await repo.loadSnapshot()).toEqual({ ...original, settings: { ...original.settings!, lastExportAt: exportedAt } });
    } finally { repo.close(); }
  });
  it('rifiuta un overflow prima del commit e conserva saldo precedente', async () => {
    const f = fixture(); const repo = await openRepository(`test-${crypto.randomUUID()}`);
    try {
      await repo.runCommand({ type: 'setup', date: '2026-01-01', balanceCents: Number.MAX_SAFE_INTEGER }, f.context());
      await expect(repo.runCommand({ type: 'income', date: '2026-01-02', amountCents: 1, description: 'Troppo' }, f.context())).rejects.toThrow();
      expect(project(await repo.loadSnapshot(), '2026-01-31').cash).toBe(Number.MAX_SAFE_INTEGER);
    } finally { repo.close(); }
  });
  it('elimina tutte le collezioni e riapre un archivio vuoto', async () => {
    const f = fixture(); const repo = await openRepository(`test-${crypto.randomUUID()}`);
    try {
      await repo.runCommand({ type: 'setup', date: '2026-01-01', balanceCents: 80_000 }, f.context());
      await repo.runCommand({ type: 'income', date: '2026-01-02', amountCents: 1_000, description: 'Extra' }, f.context());
      await repo.reset();
      expect(await repo.loadSnapshot()).toEqual({ settings: null, envelopes: [], policies: [], operations: [], templates: [], monthlyPlans: [], recurrences: [], recurrenceVersions: [], occurrences: [], goals: [], receipts: [], history: [] });
    } finally { repo.close(); }
  });
  it('riconcilia la stessa scadenza da due tab senza duplicarla', async () => {
    const f = fixture(); const name = `test-${crypto.randomUUID()}`;
    const first = await openRepository(name); const second = await openRepository(name);
    try {
      await first.runCommand({ type: 'setup', date: '2026-01-01', balanceCents: 0 }, f.context());
      await first.runCommand({ type: 'create-recurrence', name: 'Entrata', kind: 'income', amountCents: 10_000, frequency: 'monthly', anchorDate: '2026-01-31', main: true }, f.context());
      await Promise.all([
        first.runCommand({ type: 'reconcile' }, f.context('2026-03-31')),
        second.runCommand({ type: 'reconcile' }, f.context('2026-03-31')),
      ]);
      const state = await first.loadSnapshot();
      expect(state.occurrences.map(item => item.scheduledDate).sort()).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
      expect(state.operations.filter(operation => operation.kind === 'income')).toHaveLength(3);
    } finally { first.close(); second.close(); }
  });
});
