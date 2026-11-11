import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase, IDBPTransaction } from 'idb';
import { runCommand } from '../../application/commands/runCommand';
import type { Command, Repository } from '../../application/ports';
import { emptySnapshot } from '../../domain/types';
import type { CommandContext, Snapshot } from '../../domain/types';
import { validateSnapshot } from '../../domain/validation';

export const collectionNames = ['envelopes', 'policies', 'operations', 'templates', 'monthlyPlans', 'recurrences', 'recurrenceVersions', 'occurrences', 'goals', 'receipts', 'history'] as const;
type CollectionName = (typeof collectionNames)[number];
type StoreName = CollectionName | 'settings';
type Database = { [Name in StoreName]: { key: string; value: unknown; indexes: Name extends 'occurrences' ? { byRuleDate: [string, string] } : Record<never, never> } } & DBSchema;
const stores: StoreName[] = ['settings', ...collectionNames];

async function readTransaction(tx: IDBPTransaction<Database, StoreName[], 'readonly' | 'readwrite'>): Promise<Snapshot> {
  const raw: Record<string, unknown> = {};
  const settings = await tx.objectStore('settings').get('current');
  if (settings === undefined) {
    // Missing configuration is only a valid empty archive if every store is empty.
    const counts = await Promise.all(collectionNames.map(name => tx.objectStore(name).count()));
    if (counts.some(count => count > 0)) throw new Error('Archivio incompleto: configurazione iniziale mancante.');
    return emptySnapshot();
  }
  raw['settings'] = settings;
  await Promise.all(collectionNames.map(async name => { raw[name] = await tx.objectStore(name).getAll(); }));
  return validateSnapshot(raw);
}

async function writeTransaction(tx: IDBPTransaction<Database, StoreName[], 'readwrite'>, snapshot: Snapshot): Promise<void> {
  await tx.objectStore('settings').put(snapshot.settings, 'current');
  for (const name of collectionNames) {
    await tx.objectStore(name).clear();
    for (const record of snapshot[name]) await tx.objectStore(name).put(record);
  }
}

class IndexedDbRepository implements Repository {
  constructor(private readonly db: IDBPDatabase<Database>) {}

  async loadSnapshot(): Promise<Snapshot> {
    const tx = this.db.transaction(stores, 'readonly');
    const snapshot = await readTransaction(tx);
    await tx.done;
    return snapshot;
  }

  async runCommand(command: Command, context: CommandContext): Promise<Snapshot> {
    // A readwrite transaction serializes competing tabs before either reads its base state.
    const tx = this.db.transaction(stores, 'readwrite');
    try {
      const snapshot = await readTransaction(tx);
      const next = runCommand(snapshot, command, context);
      await writeTransaction(tx, next);
      await tx.done;
      return next;
    } catch (error) {
      try { tx.abort(); } catch { /* The browser may already have aborted the transaction. */ }
      await tx.done.catch(() => undefined);
      throw error;
    }
  }

  async restoreBackup(snapshot: Snapshot): Promise<void> {
    const validated = validateSnapshot(snapshot);
    const tx = this.db.transaction(stores, 'readwrite');
    try { await writeTransaction(tx, validated); await tx.done; }
    catch (error) {
      try { tx.abort(); } catch { /* Already aborted. */ }
      await tx.done.catch(() => undefined);
      throw error;
    }
  }

  async reset(): Promise<void> {
    const tx = this.db.transaction(stores, 'readwrite');
    try {
      await Promise.all(stores.map(name => tx.objectStore(name).clear()));
      await tx.done;
    } catch (error) {
      try { tx.abort(); } catch { /* Already aborted. */ }
      await tx.done.catch(() => undefined);
      throw error;
    }
  }

  close(): void { this.db.close(); }
}

export async function openRepository(name = 'esnupi'): Promise<Repository> {
  const db = await openDB<Database>(name, 1, {
    upgrade(database) {
      database.createObjectStore('settings');
      for (const store of collectionNames) {
        if (store === 'occurrences') {
          database.createObjectStore(store, { keyPath: 'id' }).createIndex('byRuleDate', ['ruleId', 'scheduledDate'], { unique: true });
        } else database.createObjectStore(store, { keyPath: store === 'monthlyPlans' ? 'month' : 'id' });
      }
    },
    blocking() { db.close(); },
  });
  return new IndexedDbRepository(db);
}
