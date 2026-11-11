import { describe, expect, it } from 'vitest';
import { assessGoalBudget, simulateGoal } from './goals';

const input = { targetCents: 68_000, savedCents: 20_000, monthlyCents: 8_000, contributionDay: 5, today: '2026-01-01', targetDate: '2026-03-05' };

describe('previsioni condizionate alle quote', () => {
  it('calcola sei quote future e inverso in tre quote', () => {
    expect(simulateGoal(input)).toMatchObject({ remainingCents: 48_000, contributions: 6, estimatedDate: '2026-06-05', requiredMonthlyCents: 16_000, targetContributions: 3 });
  });
  it('non conta di nuovo una quota già applicata', () => {
    expect(simulateGoal({ ...input, currentMonthApplied: true }).estimatedDate).toBe('2026-07-05');
    expect(simulateGoal({ ...input, today: '2026-01-06' }).estimatedDate).toBe('2026-07-05');
  });
  it('distingue raggiunto, quota zero e data irraggiungibile', () => {
    expect(simulateGoal({ ...input, savedCents: 68_000 })).toMatchObject({ status: 'reached', remainingCents: 0, requiredMonthlyCents: 0 });
    expect(simulateGoal({ ...input, monthlyCents: 0 })).toMatchObject({ status: 'no-contribution', estimatedDate: null });
    expect(simulateGoal({ ...input, targetDate: '2026-01-04' }).requiredMonthlyCents).toBeNull();
    expect(simulateGoal({ ...input, savedCents: -500 }).remainingCents).toBe(68_000);
  });
  it('arrotonda verso l’alto e non inventa date fuori calendario', () => {
    expect(simulateGoal({ ...input, targetCents: 101, savedCents: 0, targetDate: '2026-03-05' }).requiredMonthlyCents).toBe(34);
    expect(simulateGoal({ ...input, targetCents: Number.MAX_SAFE_INTEGER, savedCents: 0, monthlyCents: 1 })).toMatchObject({ status: 'out-of-range', estimatedDate: null });
  });
});

describe('compatibilità complessiva delle quote', () => {
  it('non conta due volte la parte delle quote già presente nel piano', () => {
    expect(assessGoalBudget({
      mainIncome: { amountCents: 80_000, frequency: 'monthly' },
      otherPlanCents: 40_000,
      goalQuotes: [{ monthlyCents: 20_000, plannedCents: 15_000 }, { monthlyCents: 10_000, plannedCents: 10_000 }],
    })).toEqual({ status: 'within-budget', incomeCents: 80_000, planCents: 65_000, goalQuotesCents: 30_000, goalQuotesInPlanCents: 25_000, extraGoalQuotesCents: 5_000, combinedCents: 70_000, differenceCents: 10_000 });
  });

  it('segnala quando piano e quote concorrenti superano il reddito', () => {
    expect(assessGoalBudget({
      mainIncome: { amountCents: 50_000, frequency: 'monthly' },
      otherPlanCents: 35_000,
      goalQuotes: [{ monthlyCents: 20_000, plannedCents: 5_000 }],
    })).toMatchObject({ status: 'over-budget', combinedCents: 55_000, differenceCents: -5_000, extraGoalQuotesCents: 15_000 });
  });

  it('non inventa un confronto senza entrata mensile principale', () => {
    expect(assessGoalBudget({ otherPlanCents: 10_000, goalQuotes: [{ monthlyCents: 5_000, plannedCents: 0 }] })).toMatchObject({ status: 'no-main-income', incomeCents: null, differenceCents: null });
    expect(assessGoalBudget({ mainIncome: { amountCents: 80_000, frequency: 'yearly' }, otherPlanCents: 10_000, goalQuotes: [] })).toMatchObject({ status: 'non-monthly-income', differenceCents: null });
  });
});
