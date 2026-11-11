import { useRef, useState } from 'react';
import { useApp } from '../../app/AppProvider';
import { errorMessage, today } from '../../app/browser';
import { localDate } from '../../domain/calendar';
import { project } from '../../domain/ledger';
import { formatMoney, parseMoney, sum } from '../../domain/money';
import { snapshotWithoutMovement } from '../../domain/movements';
import type { Operation } from '../../domain/types';
import { Dialog } from '../../shared/ui/Dialog';
import { MoneyInput } from '../../shared/ui/MoneyInput';

const previewAmount = (value: string): number => { try { return parseMoney(value); } catch { return 0; } };
const inputMoney = (cents: number) => String(Math.abs(cents) / 100).replace('.', ',');

export function MovementDialog({ operation, onClose }: { operation?: Operation; onClose(): void }) {
  const { snapshot, execute } = useApp();
  const activeEnvelopes = snapshot.envelopes.filter(envelope => !envelope.archived).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const [kind, setKind] = useState<'expense' | 'income'>(operation?.kind === 'income' ? 'income' : 'expense');
  const [amount, setAmount] = useState(() => operation ? inputMoney(operation.cashDeltaCents) : '');
  const [description, setDescription] = useState(operation?.description ?? '');
  const [date, setDate] = useState(operation?.effectiveDate ?? today);
  const [envelopeId, setEnvelopeId] = useState(operation?.envelopeDeltas[0]?.envelopeId ?? activeEnvelopes.find(envelope => envelope.kind === 'spending')?.id ?? activeEnvelopes[0]?.id ?? '');
  const [sources, setSources] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const commandId = useRef(crypto.randomUUID());
  let previewDate = today(); try { previewDate = localDate(date); } catch { /* Safe preview until the date is valid. */ }
  const previewSnapshot = operation ? snapshotWithoutMovement(snapshot, operation.id) : snapshot;
  const balance = project(previewSnapshot, previewDate);
  const expenseCents = previewAmount(amount);
  const deficit = kind === 'expense' ? Math.max(0, sum([expenseCents, -(balance.envelopes.get(envelopeId) ?? 0)])) : 0;
  const selected = sum(Object.values(sources).map(previewAmount));
  const automatic = operation?.origin === 'recurring';
  const changed = operation ? amount !== inputMoney(operation.cashDeltaCents) || description !== operation.description || date !== operation.effectiveDate || envelopeId !== operation.envelopeDeltas[0]?.envelopeId : !!(amount || description);
  const close = () => { if (!changed || window.confirm('Chiudere senza salvare le modifiche?')) onClose(); };
  const availableSources = [
    { id: 'free', name: 'Soldi da assegnare', amount: balance.unassigned },
    ...activeEnvelopes.filter(envelope => envelope.id !== envelopeId).map(envelope => ({ id: envelope.id, name: envelope.name, amount: balance.envelopes.get(envelope.id) ?? 0 })),
  ].filter(source => source.amount > 0);

  return <Dialog title={operation?.origin === 'recurring' ? 'Correggi registrazione' : operation ? 'Modifica movimento' : 'Un nuovo movimento'} onClose={close} busy={busy}><form onSubmit={event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    void (async () => {
      const common = { date, amountCents: parseMoney(amount), description: description.trim() };
      const coverage = Object.entries(sources).filter(([, value]) => value.trim() && parseMoney(value) > 0).map(([id, value]) => ({ sourceEnvelopeId: id === 'free' ? null : id, amountCents: parseMoney(value) }));
      if (operation?.origin === 'recurring') await execute({ type: 'update-occurrence', operationId: operation.id, ...common, ...(kind === 'expense' ? { envelopeId } : {}) }, commandId.current);
      else if (operation) await execute({ type: 'update-movement', operationId: operation.id, ...common, ...(kind === 'expense' ? { envelopeId } : {}), coverage }, commandId.current);
      else await execute(kind === 'income' ? { type: 'income', ...common } : { type: 'expense', ...common, envelopeId, coverage }, commandId.current);
      onClose();
    })().catch(problem => setError(errorMessage(problem))).finally(() => setBusy(false));
  }}>
    <fieldset className="segmented" disabled={!!operation}><legend className="visually-hidden">Tipo di movimento</legend><label><input type="radio" name="kind" checked={kind === 'expense'} onChange={() => { setKind('expense'); setSources({}); }} />Uscita</label><label><input type="radio" name="kind" checked={kind === 'income'} onChange={() => { setKind('income'); setSources({}); }} />Entrata</label></fieldset>
    <MoneyInput label="Importo" value={amount} onChange={setAmount} />
    <label className="field">Descrizione<input value={description} required maxLength={120} placeholder={kind === 'expense' ? 'Per esempio: spesa al supermercato' : 'Per esempio: entrata mensile'} onChange={event => setDescription(event.target.value)} /></label>
    <div className="form-grid"><label className="field">Data<input type="date" value={date} min={snapshot.settings?.startDate} max={today()} required onChange={event => { setDate(event.target.value); setSources({}); }} /></label>
      {kind === 'expense' && <label className="field">Da quale busta?<select value={envelopeId} onChange={event => { setEnvelopeId(event.target.value); setSources({}); }}>{activeEnvelopes.map(envelope => <option key={envelope.id} value={envelope.id}>{envelope.name}</option>)}</select></label>}
    </div>
    {deficit > 0 && automatic && <p className="warning">La busta resterà sotto di {formatMoney(deficit)}. Dopo il salvataggio puoi scegliere da dove coprire la differenza.</p>}
    {deficit > 0 && !automatic && <fieldset className="coverage-box"><legend>Questa busta ha bisogno di {formatMoney(deficit)}</legend>
      <p className="small">Scegli da dove prendere la differenza. I risparmi si spostano soltanto se lo decidi tu.</p>
      {availableSources.map(source => <MoneyInput key={source.id} label={`${source.name} · disponibili ${formatMoney(source.amount)}`} value={sources[source.id] ?? ''} required={false} hint="Lascia vuoto per non usare questa sorgente." onChange={value => setSources(current => ({ ...current, [source.id]: value }))} />)}
      {balance.cash < expenseCents && <p className="warning">Il saldo totale non basta. Puoi registrare comunque la spesa reale: lo scoperto resterà visibile.</p>}
      <p className="small"><strong>Ancora da coprire: {formatMoney(Math.max(0, deficit - selected))}</strong></p>
    </fieldset>}
    {error && <p role="alert" className="error-message">{error}</p>}
    <div className="dialog-footer"><button type="button" className="button secondary" disabled={busy} onClick={close}>Annulla</button><button className="button primary" disabled={busy}>{busy ? 'Salvataggio…' : operation ? 'Salva modifiche' : 'Salva movimento'}</button></div>
  </form></Dialog>;
}
