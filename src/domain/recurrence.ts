import { dateInMonth, dateParts, monthOf, shiftMonth, localDate } from './calendar';
import type { RecurrenceVersion } from './types';

/** The original anchor survives February clamping. This function never reads a clock. */
export function dueDates(rule: RecurrenceVersion, from: string, through: string): string[] {
  localDate(from); localDate(through);
  if (from > through) return [];
  const anchor = dateParts(rule.anchorDate);
  const start = [from, rule.validFrom, rule.anchorDate].sort().at(-1)!;
  const end = rule.validThrough && rule.validThrough < through ? rule.validThrough : through;
  if (start > end) return [];
  const result: string[] = [];
  let month = monthOf(start);
  while (month <= monthOf(end)) {
    const date = dateInMonth(month, anchor.day);
    if ((rule.frequency === 'monthly' || dateParts(date).month === anchor.month) && date >= start && date <= end) result.push(date);
    if (month === monthOf(end)) break;
    month = shiftMonth(month, 1);
  }
  return result;
}

export const occurrenceKey = (ruleId: string, scheduledDate: string): string => JSON.stringify([ruleId, localDate(scheduledDate)]);
