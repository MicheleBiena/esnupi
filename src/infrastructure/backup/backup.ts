import { z } from 'zod';
import { DomainError } from '../../domain/errors';
import { snapshotSchema } from '../../domain/types';
import type { Snapshot } from '../../domain/types';
import { validateSnapshot } from '../../domain/validation';

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const backupSchema = z.strictObject({ format: z.literal('esnupi-backup'), schemaVersion: z.literal(1), appVersion: z.string().max(40), exportedAt: z.string().datetime(), data: snapshotSchema });

export function exportBackup(snapshot: Snapshot, now: string): string {
  const data = structuredClone(validateSnapshot(snapshot));
  if (data.settings) data.settings.lastExportAt = now;
  const backup = backupSchema.parse({ format: 'esnupi-backup', schemaVersion: 1, appVersion: '0.1.0', exportedAt: now, data });
  const text = JSON.stringify(backup, null, 2);
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new DomainError('INVALID_DATA', 'Archivio oltre il limite di esportazione della prima versione (10 MB).');
  return text;
}

export function inspectBackup(text: string): Snapshot {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new DomainError('INVALID_DATA', 'Il backup supera il limite di 10 MB.');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new DomainError('INVALID_DATA', 'Il file non contiene JSON valido.'); }
  const parsed = backupSchema.safeParse(value);
  if (!parsed.success) throw new DomainError('INVALID_DATA', 'Backup non valido o versione non supportata. L’archivio attuale resta invariato.');
  return validateSnapshot(parsed.data.data);
}
