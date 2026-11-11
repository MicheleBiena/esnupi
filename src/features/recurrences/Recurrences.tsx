import { useMemo, useRef, useState } from 'react';
import { useApp } from '../../app/AppProvider';
import { errorMessage, today } from '../../app/browser';
import { endOfMonth, formatDate, monthOf, nextDate, shiftMonth } from '../../domain/calendar';
import { project } from '../../domain/ledger';
import { formatMoney, parseMoney, sum } from '../../domain/money';
import { dueDates, occurrenceKey } from '../../domain/recurrence';
import type { Allocation } from '../../domain/types';
import { Dialog } from '../../shared/ui/Dialog';
import { Icon } from '../../shared/ui/Icon';
import { MoneyInput } from '../../shared/ui/MoneyInput';

const moneyValue = (cents: number) => cents ? String(cents / 100).replace('.', ',') : '';
const amountOrZero = (value: string) => value.trim() ? parseMoney(value) : 0;

function NewRecurrenceDialog({ onClose }: { onClose(): void }) {
  const { snapshot, execute } = useApp();
  const envelopes = snapshot.envelopes.filter(envelope => !envelope.archived);
  const [kind, setKind] = useState<'income' | 'expense'>('expense');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'yearly'>('monthly');
  const [anchorDate, setAnchorDate] = useState(today);
  const [envelopeId, setEnvelopeId] = useState(envelopes.find(envelope => envelope.name === 'Abbonamenti')?.id ?? envelopes[0]?.id ?? '');
  const [main, setMain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const commandId = useRef(crypto.randomUUID());
  const close = () => { if (!(name || amount) || window.confirm('Chiudere senza salvare la ricorrenza?')) onClose(); };
  return <Dialog title="Nuova ricorrenza" onClose={close} busy={busy}><form onSubmit={event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    void execute({ type: 'create-recurrence', name: name.trim(), kind, amountCents: parseMoney(amount), frequency, anchorDate, ...(kind === 'expense' ? { envelopeId } : {}), main: kind === 'income' && main }, commandId.current)
      .then(onClose).catch(problem => setError(errorMessage(problem))).finally(() => setBusy(false));
  }}>
    <fieldset className="segmented"><legend className="visually-hidden">Tipo di ricorrenza</legend><label><input type="radio" name="recurrence-kind" checked={kind === 'expense'} onChange={() => { setKind('expense'); setMain(false); }} />Uscita</label><label><input type="radio" name="recurrence-kind" checked={kind === 'income'} onChange={() => setKind('income')} />Entrata</label></fieldset>
    <label className="field">Nome<input required maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder={kind === 'expense' ? 'Per esempio: telefono' : 'Per esempio: entrata INPS'} /></label>
    <MoneyInput label="Importo" value={amount} onChange={setAmount} />
    <div className="form-grid"><label className="field">Frequenza<select value={frequency} onChange={event => setFrequency(event.target.value as typeof frequency)}><option value="monthly">Ogni mese</option><option value="yearly">Ogni anno</option></select></label><label className="field">Prima scadenza<input type="date" min={snapshot.settings?.startDate} required value={anchorDate} onChange={event => setAnchorDate(event.target.value)} /></label></div>
    {kind === 'expense' && <label className="field">Busta<select required value={envelopeId} onChange={event => setEnvelopeId(event.target.value)}>{envelopes.map(envelope => <option key={envelope.id} value={envelope.id}>{envelope.name}</option>)}</select></label>}
    {kind === 'income' && !snapshot.settings?.mainRecurrenceId && <label className="check-field"><input type="checkbox" checked={main} onChange={event => setMain(event.target.checked)} /><span><strong>Entrata principale</strong><small>Quando viene registrata, esnupi prova ad applicare il piano mensile.</small></span></label>}
    <p className="small muted">Le scadenze dalla prima data fino a oggi saranno registrate subito. Quelle successive vengono registrate quando apri l’app.</p>
    {error && <p role="alert" className="error-message">{error}</p>}
    <div className="dialog-footer"><button type="button" className="button secondary" disabled={busy} onClick={close}>Annulla</button><button className="button primary" disabled={busy}>{busy ? 'Salvataggio…' : 'Salva ricorrenza'}</button></div>
  </form></Dialog>;
}

function ArchiveDialog({ recurrenceId, name, onClose }: { recurrenceId: string; name: string; onClose(): void }) {
  const { execute } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <Dialog title="Disattiva ricorrenza" onClose={onClose} busy={busy}><p><strong>{name}</strong> non genererà altre registrazioni. I movimenti già registrati restano nel diario.</p>{error && <p role="alert" className="error-message">{error}</p>}<div className="dialog-footer"><button className="button secondary" disabled={busy} onClick={onClose}>Annulla</button><button className="button danger" disabled={busy} onClick={() => { setBusy(true); void execute({ type: 'archive-recurrence', recurrenceId, endDate: today() }).then(onClose).catch(problem => setError(errorMessage(problem))).finally(() => setBusy(false)); }}>{busy ? 'Salvataggio…' : 'Disattiva'}</button></div></Dialog>;
}

function EditRecurrenceDialog({ recurrenceId, onClose }: { recurrenceId: string; onClose(): void }) {
  const { snapshot, execute } = useApp();
  const recurrence = snapshot.recurrences.find(item => item.id === recurrenceId)!;
  const version = snapshot.recurrenceVersions.filter(item => item.ruleId === recurrenceId).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0]!;
  const envelopes = snapshot.envelopes.filter(envelope => !envelope.archived);
  const previewVersion = { ...version, validFrom: nextDate(today()) }; delete previewVersion.validThrough;
  const suggestedDate = dueDates(previewVersion, nextDate(today()), endOfMonth(shiftMonth(monthOf(today()), 24)))[0] ?? nextDate(today());
  const [name, setName] = useState(recurrence.name);
  const [amount, setAmount] = useState(moneyValue(version.amountCents));
  const [frequency, setFrequency] = useState(version.frequency);
  const [anchorDate, setAnchorDate] = useState(suggestedDate);
  const [dateChanged, setDateChanged] = useState(false);
  const [envelopeId, setEnvelopeId] = useState(version.envelopeId ?? envelopes[0]?.id ?? '');
  const [main, setMain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isIncome = version.kind === 'income';
  return <Dialog title={recurrence.archived ? 'Riattiva ricorrenza' : 'Modifica ricorrenza'} onClose={onClose} busy={busy}><form onSubmit={event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    const scheduleChanged = dateChanged || frequency !== version.frequency;
    const common = { recurrenceId, name: name.trim(), amountCents: parseMoney(amount), frequency, validFrom: anchorDate, anchorDate: scheduleChanged ? anchorDate : version.anchorDate, ...(isIncome ? {} : { envelopeId }) };
    const command = recurrence.archived ? { type: 'reactivate-recurrence' as const, ...common, main: isIncome && main } : { type: 'update-recurrence' as const, ...common };
    void execute(command).then(onClose).catch(problem => setError(errorMessage(problem))).finally(() => setBusy(false));
  }}>
    <p className="muted">Le nuove impostazioni valgono dalla scadenza indicata. Le registrazioni precedenti non cambiano.</p>
    <label className="field">Nome<input required maxLength={120} value={name} onChange={event => setName(event.target.value)} /></label>
    <MoneyInput label="Importo" value={amount} onChange={setAmount} />
    <div className="form-grid"><label className="field">Frequenza<select value={frequency} onChange={event => setFrequency(event.target.value as typeof frequency)}><option value="monthly">Ogni mese</option><option value="yearly">Ogni anno</option></select></label><label className="field">Prima nuova scadenza<input type="date" min={nextDate(today())} required value={anchorDate} onChange={event => { setAnchorDate(event.target.value); setDateChanged(true); }} /></label></div>
    {!isIncome && <label className="field">Busta<select value={envelopeId} onChange={event => setEnvelopeId(event.target.value)}>{envelopes.map(envelope => <option key={envelope.id} value={envelope.id}>{envelope.name}</option>)}</select></label>}
    {recurrence.archived && isIncome && !snapshot.settings?.mainRecurrenceId && <label className="check-field"><input type="checkbox" checked={main} onChange={event => setMain(event.target.checked)} /><span><strong>Entrata principale</strong><small>Quando viene registrata, esnupi prova ad applicare il piano mensile.</small></span></label>}
    {error && <p role="alert" className="error-message">{error}</p>}
    <div className="dialog-footer"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Annulla</button><button className="button primary" disabled={busy}>{busy ? 'Salvataggio…' : recurrence.archived ? 'Riattiva' : 'Salva modifiche'}</button></div>
  </form></Dialog>;
}

function PlanEditor() {
  const { snapshot, execute } = useApp();
  const currentMonth = monthOf(today());
  const envelopes = snapshot.envelopes.filter(envelope => !envelope.archived).sort((a, b) => a.order - b.order);
  const currentTemplate = snapshot.templates.filter(template => template.effectiveMonth <= currentMonth).sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth) || b.updatedAt.localeCompare(a.updatedAt))[0];
  const currentPlan = snapshot.monthlyPlans.find(plan => plan.month === currentMonth);
  const initial = useMemo(() => Object.fromEntries(envelopes.map(envelope => [envelope.id, moneyValue(currentTemplate?.allocations.find(item => item.envelopeId === envelope.id)?.amountCents ?? 0)])), [currentTemplate?.id, envelopes.map(item => item.id).join(':')]);
  const [effectiveMonth, setEffectiveMonth] = useState(currentMonth);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const allocations = (): Allocation[] => envelopes.map(envelope => ({ envelopeId: envelope.id, amountCents: amountOrZero(values[envelope.id] ?? '') }));
  const requested = sum(envelopes.map(envelope => amountOrZero(values[envelope.id] ?? '')));
  const available = project(snapshot, today()).unassigned;
  const applied = sum(currentPlan?.allocations.map(item => item.amountCents) ?? []);
  const planChanged = currentPlan?.state === 'applied' && envelopes.some(envelope => amountOrZero(values[envelope.id] ?? '') !== (currentPlan.allocations.find(item => item.envelopeId === envelope.id)?.amountCents ?? 0));
  const save = async () => { await execute({ type: 'save-plan-template', effectiveMonth, allocations: allocations() }); setMessage('Piano salvato.'); };
  const apply = async () => { await execute({ type: 'apply-plan', month: currentMonth, date: today(), allocations: allocations() }); setMessage('Quote del mese assegnate.'); };
  const revise = async () => { await execute({ type: 'revise-plan', month: currentMonth, date: today(), allocations: allocations() }); setMessage('Quote del mese aggiornate.'); };
  return <section className="panel plan-panel"><div className="section-heading"><div><h2>Piano mensile</h2><p className="muted">Importi da assegnare alle buste quando arriva l’entrata principale.</p></div>{currentPlan && <span className={`status-tag ${currentPlan.state}`}>{currentPlan.state === 'applied' ? 'APPLICATO' : currentPlan.state === 'needs-review' ? 'DA RIVEDERE' : 'IN ATTESA'}</span>}</div>
    <label className="field compact-field">Valido da<input type="month" min={currentMonth} value={effectiveMonth} onChange={event => setEffectiveMonth(event.target.value)} /></label>
    <div className="plan-grid">{envelopes.map(envelope => <MoneyInput key={envelope.id} label={envelope.name} value={values[envelope.id] ?? ''} required={false} hint="Lascia vuoto per non assegnare." onChange={value => { setValues(current => ({ ...current, [envelope.id]: value })); setMessage(''); }} />)}</div>
    <div className="plan-summary"><span>Totale quote <strong>{formatMoney(requested)}</strong></span>{currentPlan?.state === 'applied' ? <span>Applicate questo mese <strong>{formatMoney(applied)}</strong></span> : <span>Da assegnare ora <strong className={available < requested ? 'negative' : ''}>{formatMoney(available)}</strong></span>}</div>
    {currentPlan?.state === 'needs-review' && <p className="warning">Il piano non è stato applicato perché i soldi da assegnare non coprivano tutte le quote. Modifica gli importi e conferma manualmente.</p>}
    {planChanged && <p className="small muted">Aggiorna quote del mese registra soltanto le differenze per {new Intl.DateTimeFormat('it-IT', { month: 'long' }).format(new Date(`${currentMonth}-15T12:00:00`))}. Per usare gli stessi importi nei mesi successivi, salva anche il piano.</p>}
    {error && <p role="alert" className="error-message">{error}</p>}<p role="status" className="success-message">{message}</p>
    <div className="button-row"><button className="button secondary" disabled={busy} onClick={() => { setBusy(true); setError(''); void save().catch(problem => setError(errorMessage(problem))).finally(() => setBusy(false)); }}>{busy ? 'Salvataggio…' : 'Salva piano'}</button>{currentPlan?.state !== 'applied' && currentTemplate && <button className="button primary" disabled={busy || requested > available} onClick={() => { setBusy(true); setError(''); void apply().catch(problem => setError(errorMessage(problem))).finally(() => setBusy(false)); }}>{currentPlan?.state === 'needs-review' ? 'Conferma quote del mese' : 'Applica al mese corrente'}</button>}{currentPlan?.state === 'applied' && <button className="button primary" disabled={busy || !planChanged} onClick={() => { setBusy(true); setError(''); void revise().catch(problem => setError(errorMessage(problem))).finally(() => setBusy(false)); }}>Aggiorna quote del mese</button>}</div>
  </section>;
}

export function Recurrences() {
  const { snapshot } = useApp();
  const [creating, setCreating] = useState(false);
  const [archiving, setArchiving] = useState<{ id: string; name: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const horizon = endOfMonth(shiftMonth(monthOf(today()), 12));
  return <><section className="panel recurrence-panel"><div className="section-heading"><div><h2>Entrate e uscite ricorrenti</h2><p className="muted">Le registrazioni dovute vengono aggiunte quando apri l’app.</p></div><button className="button secondary" onClick={() => setCreating(true)}><Icon name="plus" />Nuova ricorrenza</button></div>
    {!snapshot.recurrences.length ? <div className="empty-state"><h3>Nessuna ricorrenza</h3><p className="muted">Aggiungi l’entrata mensile o un abbonamento.</p></div> : <div className="recurrence-list">{snapshot.recurrences.map(recurrence => {
      const version = snapshot.recurrenceVersions.filter(item => item.ruleId === recurrence.id).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0]!;
      const envelope = snapshot.envelopes.find(item => item.id === version.envelopeId);
      const next = recurrence.archived ? undefined : dueDates(version, today(), horizon).find(date => !snapshot.occurrences.some(occurrence => occurrenceKey(occurrence.ruleId, occurrence.scheduledDate) === occurrenceKey(recurrence.id, date)));
      return <article className="recurrence-row" key={recurrence.id}><span className={`transaction-icon ${version.kind === 'income' ? 'incoming' : ''}`}><Icon name={version.kind === 'income' ? 'plus' : 'repeat'} /></span><div><h3>{recurrence.name}</h3><p className="small muted">{version.frequency === 'monthly' ? 'Ogni mese' : 'Ogni anno'}{envelope ? ` · ${envelope.name}` : ''}{snapshot.settings?.mainRecurrenceId === recurrence.id ? ' · Entrata principale' : ''}</p></div><strong>{version.kind === 'income' ? '+' : '−'}{formatMoney(version.amountCents)}</strong><div className="recurrence-next">{recurrence.archived ? <span className="status-tag">DISATTIVATA</span> : <><span className="small muted">Prossima</span><span>{next ? formatDate(next) : 'Nessuna'}</span></>}</div><div className="recurrence-actions"><button className="text-button" onClick={() => setEditing(recurrence.id)}>{recurrence.archived ? 'Riattiva' : 'Modifica'}</button>{!recurrence.archived && <button className="text-button danger-text" onClick={() => setArchiving({ id: recurrence.id, name: recurrence.name })}>Disattiva</button>}</div></article>;
    })}</div>}
  </section><PlanEditor />{creating && <NewRecurrenceDialog onClose={() => setCreating(false)} />}{editing && <EditRecurrenceDialog recurrenceId={editing} onClose={() => setEditing(null)} />}{archiving && <ArchiveDialog recurrenceId={archiving.id} name={archiving.name} onClose={() => setArchiving(null)} />}</>;
}
