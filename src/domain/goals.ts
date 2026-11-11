import { dateInMonth, localDate, monthOf, shiftMonth } from './calendar';
import { cents, ceilDivide, sum } from './money';
import { DomainError } from './errors';

export interface GoalSimulation {
  remainingCents: number;
  contributions: number | null;
  estimatedDate: string | null;
  requiredMonthlyCents: number | null;
  targetContributions: number;
  status: 'reached' | 'estimated' | 'no-contribution' | 'out-of-range';
}

export interface GoalBudgetAssessment {
  status: 'no-main-income' | 'non-monthly-income' | 'within-budget' | 'over-budget';
  incomeCents: number | null;
  planCents: number;
  goalQuotesCents: number;
  goalQuotesInPlanCents: number;
  extraGoalQuotesCents: number;
  combinedCents: number;
  differenceCents: number | null;
}

export function assessGoalBudget(input: {
  goalQuotes: { monthlyCents: number; plannedCents: number }[];
  otherPlanCents: number;
  mainIncome?: { amountCents: number; frequency: 'monthly' | 'yearly' } | undefined;
}): GoalBudgetAssessment {
  cents(input.otherPlanCents);
  if (input.otherPlanCents < 0) throw new DomainError('INVALID_MONEY', 'Piano mensile non valido.');
  input.goalQuotes.forEach(item => {
    cents(item.monthlyCents); cents(item.plannedCents);
    if (item.monthlyCents < 0 || item.plannedCents < 0) throw new DomainError('INVALID_MONEY', 'Quota obiettivo non valida.');
  });
  const goalQuotesCents = sum(input.goalQuotes.map(item => item.monthlyCents));
  const goalQuotesInPlanCents = sum(input.goalQuotes.map(item => item.plannedCents));
  const extraGoalQuotesCents = sum(input.goalQuotes.map(item => Math.max(0, item.monthlyCents - item.plannedCents)));
  const planCents = sum([input.otherPlanCents, goalQuotesInPlanCents]);
  const combinedCents = sum([planCents, extraGoalQuotesCents]);
  const base = { planCents, goalQuotesCents, goalQuotesInPlanCents, extraGoalQuotesCents, combinedCents };
  if (!input.mainIncome) return { ...base, status: 'no-main-income', incomeCents: null, differenceCents: null };
  cents(input.mainIncome.amountCents);
  if (input.mainIncome.amountCents <= 0) throw new DomainError('INVALID_MONEY', 'Entrata principale non valida.');
  if (input.mainIncome.frequency !== 'monthly') return { ...base, status: 'non-monthly-income', incomeCents: input.mainIncome.amountCents, differenceCents: null };
  const differenceCents = input.mainIncome.amountCents - combinedCents;
  return { ...base, status: differenceCents < 0 ? 'over-budget' : 'within-budget', incomeCents: input.mainIncome.amountCents, differenceCents };
}

export function simulateGoal(input: {
  targetCents: number; savedCents: number; monthlyCents: number;
  contributionDay: number; today: string; targetDate?: string | undefined; currentMonthApplied?: boolean;
}): GoalSimulation {
  const { targetCents, savedCents, monthlyCents, contributionDay, today, targetDate } = input;
  localDate(today);
  if (targetDate) localDate(targetDate);
  [targetCents, savedCents, monthlyCents].forEach(cents);
  if (targetCents <= 0 || monthlyCents < 0) throw new DomainError('INVALID_MONEY', 'Prezzo e quota non validi.');
  const remainingCents = Math.max(0, targetCents - Math.max(0, savedCents));
  let firstMonth = monthOf(today);
  // Today's scheduled contribution is explicitly still pending unless marked applied.
  if (dateInMonth(firstMonth, contributionDay) < today || input.currentMonthApplied) firstMonth = shiftMonth(firstMonth, 1);
  const contributions = remainingCents === 0 ? 0 : monthlyCents === 0 ? null : ceilDivide(remainingCents, monthlyCents);
  let estimatedDate: string | null = null;
  let outOfRange = false;
  if (contributions && contributions > 0) {
    try { estimatedDate = dateInMonth(shiftMonth(firstMonth, contributions - 1), contributionDay); }
    catch { outOfRange = true; }
  }
  let targetContributions = 0;
  if (targetDate && targetDate >= today) {
    const first = monthOf(dateInMonth(firstMonth, contributionDay));
    const last = monthOf(targetDate);
    if (first <= last) {
      const serial = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5));
      targetContributions = serial(last) - serial(first) + 1;
      if (dateInMonth(last, contributionDay) > targetDate) targetContributions -= 1;
    }
  }
  return {
    remainingCents, contributions, estimatedDate, targetContributions,
    requiredMonthlyCents: remainingCents === 0 ? 0 : targetContributions > 0 ? ceilDivide(remainingCents, targetContributions) : null,
    status: remainingCents === 0 ? 'reached' : outOfRange ? 'out-of-range' : monthlyCents === 0 ? 'no-contribution' : 'estimated',
  };
}
