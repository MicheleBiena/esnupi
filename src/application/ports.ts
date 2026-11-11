import type { Coverage } from '../domain/budget';
import type { Allocation, CommandContext, Envelope, Snapshot } from '../domain/types';

export type Command =
  | { type: 'setup'; date: string; balanceCents: number }
  | { type: 'income'; date: string; amountCents: number; description: string }
  | { type: 'expense'; date: string; amountCents: number; description: string; envelopeId: string; coverage: Coverage[] }
  | { type: 'refund'; expenseId: string; date: string; amountCents: number; description: string }
  | { type: 'update-refund'; refundId: string; date: string; amountCents: number; description: string }
  | { type: 'delete-refund'; refundId: string }
  | { type: 'update-movement'; operationId: string; date: string; amountCents: number; description: string; envelopeId?: string; coverage: Coverage[] }
  | { type: 'update-occurrence'; operationId: string; date: string; amountCents: number; description: string; envelopeId?: string }
  | { type: 'delete-movement'; operationId: string }
  | { type: 'create-recurrence'; name: string; kind: 'income' | 'expense'; amountCents: number; frequency: 'monthly' | 'yearly'; anchorDate: string; envelopeId?: string; main: boolean }
  | { type: 'update-recurrence'; recurrenceId: string; name: string; amountCents: number; frequency: 'monthly' | 'yearly'; validFrom: string; anchorDate: string; envelopeId?: string }
  | { type: 'reactivate-recurrence'; recurrenceId: string; name: string; amountCents: number; frequency: 'monthly' | 'yearly'; validFrom: string; anchorDate: string; envelopeId?: string; main: boolean }
  | { type: 'archive-recurrence'; recurrenceId: string; endDate: string }
  | { type: 'skip-occurrence'; operationId: string }
  | { type: 'save-plan-template'; effectiveMonth: string; allocations: Allocation[] }
  | { type: 'apply-plan'; month: string; date: string; allocations: Allocation[] }
  | { type: 'revise-plan'; month: string; date: string; allocations: Allocation[] }
  | { type: 'reconcile' }
  | { type: 'transfer'; date: string; amountCents: number; fromEnvelopeId: string | null; toEnvelopeId: string | null }
  | { type: 'create-envelope'; name: string; kind: Envelope['kind']; rollover: 'carry' | 'release-positive' }
  | { type: 'update-envelope'; envelopeId: string; name: string; rollover: 'carry' | 'release-positive'; effectiveMonth: string }
  | { type: 'archive-envelope'; envelopeId: string }
  | { type: 'create-goal'; title: string; targetCents: number; monthlyCents: number; contributionDay: number; targetDate?: string | undefined }
  | { type: 'purchase-goal'; goalId: string; date: string; amountCents: number; description: string }
  | { type: 'record-backup-export' };

export interface Repository {
  loadSnapshot(): Promise<Snapshot>;
  runCommand(command: Command, context: CommandContext): Promise<Snapshot>;
  restoreBackup(snapshot: Snapshot): Promise<void>;
  reset(): Promise<void>;
  close(): void;
}

export interface Clock { today(): string; now(): string }
