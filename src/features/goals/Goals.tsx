import { useRef, useState } from 'react';
import { useApp } from '../../app/AppProvider';
import { errorMessage, today } from '../../app/browser';
import { dateParts, formatDate, monthOf } from '../../domain/calendar';
import { assessGoalBudget, simulateGoal } from '../../domain/goals';
import { project } from '../../domain/ledger';
import { formatMoney, parseMoney, sum } from '../../domain/money';
import type { Goal } from '../../domain/types';
import { Dialog } from '../../shared/ui/Dialog';
import { MoneyInput } from '../../shared/ui/MoneyInput';
import { Icon } from '../../shared/ui/Icon';

function GoalCard({ goal, onPurchase }: { goal: Goal; onPurchase(goal: Goal): void }) {
  const { snapshot } = useApp();
  const [quota, setQuota] = useState(String(goal.monthlyCents / 100).replace('.', ','));
  const saved = project(snapshot, today()).envelopes.get(goal.envelopeId) ?? 0;
  let simulation;
  let error = '';
  try {
    const main = snapshot.recurrenceVersions.find(version => version.ruleId === snapshot.settings?.mainRecurrenceId && version.validFrom <= today() && (!version.validThrough || version.validThrough >= today()));
    simulation = simulateGoal({ targetCents: goal.targetCents, savedCents: saved, monthlyCents: parseMoney(quota), contributionDay: main ? dateParts(main.anchorDate).day : goal.contributionDay ?? 1, today: today(), targetDate: goal.targetDate, currentMonthApplied: snapshot.monthlyPlans.some(plan => plan.month === monthOf(today()) && plan.state === 'applied') });
  } catch (problem) { error = errorMessage(problem); }
  return <article className="panel goal-card"><div className="envelope-top"><span className="icon-tile yellow"><Icon name="target" /></span></div><h2>{goal.title}</h2><p><strong>{formatMoney(Math.max(0, saved))}</strong><span className="muted"> di {formatMoney(goal.targetCents)}</span></p><progress value={Math.min(goal.targetCents, Math.max(0, saved))} max={goal.targetCents} aria-label={`Avanzamento ${goal.title}`} />
    {saved < 0 && <p className="warning">Busta da coprire: {formatMoney(-saved)}</p>}
    <MoneyInput label="Simula una quota mensile" value={quota} onChange={setQuota} />
    {error && <p className="error-message" role="alert">{error}</p>}
    {simulation && <div className="goal-result" aria-live="polite"><span className="small muted">{simulation.status === 'reached' ? 'STATO' : 'DATA STIMATA'}</span><strong>{simulation.status === 'reached' ? 'Obiettivo raggiunto' : simulation.estimatedDate ? formatDate(simulation.estimatedDate) : simulation.status === 'out-of-range' ? 'Data oltre il calendario supportato' : 'Imposta una quota positiva'}</strong><span className="small">{simulation.contributions ? `${simulation.contributions} quote future · mancano ${formatMoney(simulation.remainingCents)}` : `Da accantonare: ${formatMoney(simulation.remainingCents)}`}</span>
      {goal.targetDate && <p className="small">Entro il {formatDate(goal.targetDate)}: {simulation.requiredMonthlyCents === null ? 'nessuna quota disponibile nel calendario scelto.' : `${formatMoney(simulation.requiredMonthlyCents)} al mese.`}</p>}
    </div>}
    <p className="small muted">La simulazione non sposta soldi. Per accantonarli, trasferiscili nella busta dell’obiettivo.</p>
    <button className="button secondary full-width" disabled={saved <= 0} onClick={() => onPurchase(goal)}>Registra acquisto</button>
  </article>;
}

function PurchaseGoalDialog({ goal, onClose }: { goal: Goal; onClose(): void }) {
  const { snapshot, execute } = useApp();
  const available = project(snapshot, today()).envelopes.get(goal.envelopeId) ?? 0;
  const [amount, setAmount] = useState(String(goal.targetCents / 100).replace('.', ','));
  const [description, setDescription] = useState(`Acquisto: ${goal.title}`);
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const commandId = useRef(crypto.randomUUID());
  return <Dialog title="Registra acquisto" onClose={onClose} busy={busy}><form onSubmit={event => { event.preventDefault(); if (busy) return; setBusy(true); setError(''); void execute({ type: 'purchase-goal', goalId: goal.id, date, amountCents: parseMoney(amount), description: description.trim() }, commandId.current).then(onClose).catch(problem => setError(errorMessage(problem))).finally(() => setBusy(false)); }}>
    <p className="muted">Disponibili nella busta: <strong>{formatMoney(available)}</strong>. L’acquisto sarà registrato come uscita reale.</p>
    <MoneyInput label="Importo dell’acquisto" value={amount} onChange={setAmount} hint={`Massimo disponibile ${formatMoney(Math.max(0, available))}.`} />
    <label className="field">Descrizione<input required maxLength={120} value={description} onChange={event => setDescription(event.target.value)} /></label>
    <label className="field">Data dell’acquisto<input type="date" min={snapshot.settings?.startDate} max={today()} required value={date} onChange={event => setDate(event.target.value)} /></label>
    {error && <p role="alert" className="error-message">{error}</p>}<div className="dialog-footer"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Annulla</button><button className="button primary" disabled={busy}>{busy ? 'Salvataggio…' : 'Registra acquisto'}</button></div>
  </form></Dialog>;
}

function CreateGoalDialog({ onClose }: { onClose(): void }) {
  const { execute } = useApp();
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [monthly, setMonthly] = useState('');
  const [day, setDay] = useState('5');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const commandId = useRef(crypto.randomUUID());
  const close = () => { if (!(title || target || monthly) || window.confirm('Chiudere senza salvare questo obiettivo?')) onClose(); };
  return <Dialog title="Nuovo obiettivo" onClose={close} busy={busy}><form onSubmit={event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    void execute({ type: 'create-goal', title: title.trim(), targetCents: parseMoney(target), monthlyCents: parseMoney(monthly), contributionDay: Number(day), ...(deadline ? { targetDate: deadline } : {}) }, commandId.current).then(onClose).catch(problem => setError(errorMessage(problem))).finally(() => setBusy(false));
  }}>
    <label className="field">Nome dell’obiettivo<input required value={title} maxLength={120} placeholder="Per esempio: un weekend al mare" onChange={event => setTitle(event.target.value)} /></label>
    <MoneyInput label="Quanto costa?" value={target} onChange={setTarget} /><MoneyInput label="Quota mensile prevista" value={monthly} onChange={setMonthly} />
    <div className="form-grid"><label className="field">Giorno di accantonamento<input type="number" min="1" max="31" required value={day} onChange={event => setDay(event.target.value)} /></label><label className="field">Entro quando? (facoltativo)<input type="date" min={today()} value={deadline} onChange={event => setDeadline(event.target.value)} /></label></div>
    <p className="small muted">Viene creata una busta dedicata. Il giorno serve alla previsione e non genera versamenti automatici.</p>
    {error && <p role="alert" className="error-message">{error}</p>}<button className="button primary" disabled={busy}>{busy ? 'Salvataggio…' : 'Crea obiettivo'}</button>
  </form></Dialog>;
}

function GoalBudgetSummary({ goals }: { goals: Goal[] }) {
  const { snapshot } = useApp();
  const currentMonth = monthOf(today());
  const template = snapshot.templates.filter(item => item.effectiveMonth <= currentMonth).sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth) || b.updatedAt.localeCompare(a.updatedAt))[0];
  const activeEnvelopeIds = new Set(goals.map(goal => goal.envelopeId));
  const otherPlanCents = sum((template?.allocations ?? []).filter(item => !activeEnvelopeIds.has(item.envelopeId)).map(item => item.amountCents));
  const mainRecurrence = snapshot.recurrences.find(item => item.id === snapshot.settings?.mainRecurrenceId && !item.archived);
  const mainVersion = mainRecurrence ? snapshot.recurrenceVersions.filter(item => item.ruleId === mainRecurrence.id && item.validFrom <= today() && (!item.validThrough || item.validThrough >= today())).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0] : undefined;
  const assessment = assessGoalBudget({
    otherPlanCents,
    goalQuotes: goals.map(goal => ({ monthlyCents: goal.monthlyCents, plannedCents: template?.allocations.find(item => item.envelopeId === goal.envelopeId)?.amountCents ?? 0 })),
    ...(mainVersion ? { mainIncome: { amountCents: mainVersion.amountCents, frequency: mainVersion.frequency } } : {}),
  });
  return <section className="panel goal-budget-panel" aria-labelledby="goal-budget-title"><div className="section-heading"><div><h2 id="goal-budget-title">Quote mensili</h2><p className="muted">Confronto tra entrata principale, piano e quote degli obiettivi attivi.</p></div></div>
    <dl className="goal-budget-grid"><div><dt>Entrata principale</dt><dd>{assessment.incomeCents === null ? 'Non impostata' : assessment.status === 'non-monthly-income' ? `${formatMoney(assessment.incomeCents)} annuale` : formatMoney(assessment.incomeCents)}</dd></div><div><dt>Piano mensile</dt><dd>{formatMoney(assessment.planCents)}</dd></div><div><dt>Quote obiettivi</dt><dd>{formatMoney(assessment.goalQuotesCents)}</dd></div><div><dt>Totale considerato</dt><dd>{formatMoney(assessment.combinedCents)}</dd></div></dl>
    {assessment.extraGoalQuotesCents > 0 && <p className="small muted">Quote non ancora incluse nel piano: {formatMoney(assessment.extraGoalQuotesCents)} al mese.</p>}
    {assessment.status === 'no-main-income' && <p className="warning">Imposta un’entrata principale mensile nelle Ricorrenze per verificare se il piano e le quote sono compatibili.</p>}
    {assessment.status === 'non-monthly-income' && <p className="warning">L’entrata principale non è mensile. Il confronto con le quote mensili non viene calcolato.</p>}
    {assessment.status === 'over-budget' && assessment.differenceCents !== null && <p className="warning">Mancano {formatMoney(-assessment.differenceCents)} al mese per coprire insieme piano e quote.</p>}
    {assessment.status === 'within-budget' && assessment.differenceCents !== null && <p className="budget-ok">Dopo piano e quote restano {formatMoney(assessment.differenceCents)} al mese.</p>}
  </section>;
}

export function Goals() {
  const { snapshot } = useApp();
  const [creating, setCreating] = useState(false);
  const [purchasing, setPurchasing] = useState<Goal | null>(null);
  const active = snapshot.goals.filter(goal => goal.state === 'active' || goal.state === 'paused');
  const purchased = snapshot.goals.filter(goal => goal.state === 'purchased');
  return <><div className="section-heading actions-only"><button className="button secondary" onClick={() => setCreating(true)}><Icon name="plus" />Nuovo obiettivo</button></div>
    {active.some(goal => goal.state === 'active') && <GoalBudgetSummary goals={active.filter(goal => goal.state === 'active')} />}
    {active.length ? <div className="goals-grid">{active.map(goal => <GoalCard key={goal.id} goal={goal} onPurchase={setPurchasing} />)}</div> : !purchased.length && <div className="panel empty-state roomy"><h2>Nessun obiettivo</h2><p className="muted">Aggiungi un importo e una quota mensile per stimare la data. Puoi anche indicare una scadenza per calcolare la quota necessaria.</p></div>}
    {purchased.length > 0 && <section className="completed-goals"><h2>Acquisti registrati</h2><div className="goals-grid">{purchased.map(goal => { const operation = snapshot.operations.find(item => item.id === goal.purchaseOperationId); const residual = project(snapshot, today()).envelopes.get(goal.envelopeId) ?? 0; return <article className="panel goal-card completed" key={goal.id}><span className="status-tag applied">ACQUISTATO</span><h3>{goal.title}</h3>{operation && <p>{formatMoney(-operation.cashDeltaCents)} · {formatDate(operation.effectiveDate)}</p>}<p className="small muted">Residuo nella busta: {formatMoney(residual)}</p></article>; })}</div></section>}
    {creating && <CreateGoalDialog onClose={() => setCreating(false)} />}{purchasing && <PurchaseGoalDialog goal={purchasing} onClose={() => setPurchasing(null)} />}
  </>;
}
