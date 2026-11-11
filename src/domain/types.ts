import { z } from 'zod';
import { localDate, monthKey } from './calendar';
import { sum } from './money';

const id = z.string().min(1).max(160).refine(value => value !== 'free', 'Identificatore riservato.');
const money = z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
const nonnegative = money.refine(value => value >= 0, 'Importo negativo non consentito.');
const date = z.string().refine(value => { try { localDate(value); return true; } catch { return false; } }, 'Data non valida.');
const month = z.string().refine(value => { try { monthKey(value); return true; } catch { return false; } }, 'Mese non valido.');
const instant = z.string().datetime();
const metadata = { id, createdAt: instant, updatedAt: instant, revision: z.number().int().min(1) };
const label = z.string().trim().min(1).max(120);

export const envelopeSchema = z.strictObject({ ...metadata, name: label, kind: z.enum(['spending', 'saving', 'goal']), color: z.enum(['red', 'yellow', 'paper']), order: z.number().int().min(0), archived: z.boolean() });
export const policySchema = z.strictObject({ id, envelopeId: id, effectiveMonth: month, rollover: z.enum(['carry', 'release-positive']) });
export const operationSchema = z.strictObject({
  ...metadata, commandId: id, effectiveDate: date, sequence: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  kind: z.enum(['opening', 'income', 'expense', 'refund', 'allocation', 'transfer', 'release']),
  description: label, notes: z.string().max(2000), origin: z.enum(['manual', 'recurring', 'plan', 'onboarding']),
  cashDeltaCents: money, unassignedDeltaCents: money,
  envelopeDeltas: z.array(z.strictObject({ envelopeId: id, deltaCents: money })),
  occurrenceId: id.optional(), planMonth: month.optional(), refundOf: id.optional(), goalId: id.optional(),
}).superRefine((operation, ctx) => {
  try {
    const total = sum([operation.unassignedDeltaCents, ...operation.envelopeDeltas.map(leg => leg.deltaCents)]);
    if (operation.cashDeltaCents !== total) ctx.addIssue({ code: 'custom', message: 'Operazione non bilanciata.' });
    if (new Set(operation.envelopeDeltas.map(leg => leg.envelopeId)).size !== operation.envelopeDeltas.length) ctx.addIssue({ code: 'custom', message: 'Busta ripetuta nella stessa operazione.' });
    const legs = operation.envelopeDeltas;
    const one = legs.length === 1 ? legs[0]! : undefined;
    const cash = operation.cashDeltaCents;
    const free = operation.unassignedDeltaCents;
    let valid = false;
    switch (operation.kind) {
      case 'opening': valid = legs.length === 0 && cash === free; break;
      case 'income': valid = legs.length === 0 && cash > 0 && cash === free; break;
      case 'expense': valid = !!one && cash < 0 && free === 0 && one.deltaCents === cash; break;
      case 'refund': valid = !!one && cash > 0 && free === 0 && one.deltaCents === cash && !!operation.refundOf; break;
      case 'allocation': valid = !!one && cash === 0 && free < 0 && one.deltaCents === -free; break;
      case 'release': valid = !!one && cash === 0 && free > 0 && one.deltaCents === -free; break;
      case 'transfer': valid = cash === 0 && free === 0 && legs.length === 2 && legs.some(leg => leg.deltaCents > 0) && legs.some(leg => leg.deltaCents < 0); break;
    }
    if (!valid) ctx.addIssue({ code: 'custom', message: 'I movimenti non corrispondono al tipo di operazione.' });
  } catch { ctx.addIssue({ code: 'custom', message: 'Importo fuori intervallo.' }); }
});

export const allocationSchema = z.strictObject({ envelopeId: id, amountCents: nonnegative });
export const templateSchema = z.strictObject({ ...metadata, effectiveMonth: month, allocations: z.array(allocationSchema) });
export const planSchema = z.strictObject({ month, templateId: id, allocations: z.array(allocationSchema), state: z.enum(['pending', 'needs-review', 'applied']), appliedAt: instant.optional(), operationIds: z.array(id) });
export const recurrenceSchema = z.strictObject({ ...metadata, name: label, archived: z.boolean() });
export const recurrenceVersionSchema = z.strictObject({ id, ruleId: id, validFrom: date, validThrough: date.optional(), kind: z.enum(['income', 'expense']), amountCents: money.refine(value => value > 0), frequency: z.enum(['monthly', 'yearly']), anchorDate: date, envelopeId: id.optional(), description: label });
export const occurrenceSchema = z.strictObject({ id, ruleId: id, scheduledDate: date, versionId: id, state: z.enum(['posted', 'skipped']), operationId: id.optional() });
export const goalSchema = z.strictObject({ ...metadata, title: label, targetCents: money.refine(value => value > 0), envelopeId: id, monthlyCents: nonnegative, targetDate: date.optional(), contributionDay: z.number().int().min(1).max(31).optional(), state: z.enum(['active', 'paused', 'purchased', 'archived']), purchaseOperationId: id.optional() });
export const settingsSchema = z.strictObject({ schemaVersion: z.literal(1), locale: z.literal('it-IT'), currency: z.literal('EUR'), startDate: date, onboardingComplete: z.literal(true), mainRecurrenceId: id.optional(), firstPlanMonth: month, lastExportAt: instant.optional() });
export const receiptSchema = z.strictObject({ id, createdAt: instant, operationIds: z.array(id) });
export const historySchema = z.strictObject({ id, commandId: id, changedAt: instant, previous: operationSchema, action: z.enum(['update', 'delete']) });

export const snapshotSchema = z.strictObject({
  settings: settingsSchema.nullable(), envelopes: z.array(envelopeSchema), policies: z.array(policySchema),
  operations: z.array(operationSchema), templates: z.array(templateSchema), monthlyPlans: z.array(planSchema),
  recurrences: z.array(recurrenceSchema), recurrenceVersions: z.array(recurrenceVersionSchema),
  occurrences: z.array(occurrenceSchema), goals: z.array(goalSchema), receipts: z.array(receiptSchema), history: z.array(historySchema),
});

export type Envelope = z.infer<typeof envelopeSchema>;
export type EnvelopePolicy = z.infer<typeof policySchema>;
export type Operation = z.infer<typeof operationSchema>;
export type Allocation = z.infer<typeof allocationSchema>;
export type BudgetTemplate = z.infer<typeof templateSchema>;
export type MonthlyPlan = z.infer<typeof planSchema>;
export type RecurrenceVersion = z.infer<typeof recurrenceVersionSchema>;
export type Occurrence = z.infer<typeof occurrenceSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Id = string;
export type MoneyCents = number;

export const emptySnapshot = (): Snapshot => ({ settings: null, envelopes: [], policies: [], operations: [], templates: [], monthlyPlans: [], recurrences: [], recurrenceVersions: [], occurrences: [], goals: [], receipts: [], history: [] });

export interface CommandContext { commandId: string; today: string; now: string; newId: () => string }
