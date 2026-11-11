import { useRef, useState } from 'react';
import { useApp } from '../../app/AppProvider';
import { errorMessage, today } from '../../app/browser';
import { formatDate } from '../../domain/calendar';
import { formatMoney, parseMoney } from '../../domain/money';
import { refundableAmount } from '../../domain/refunds';
import type { Operation } from '../../domain/types';
import { Dialog } from '../../shared/ui/Dialog';
import { MoneyInput } from '../../shared/ui/MoneyInput';

const moneyValue = (cents: number) => String(cents / 100).replace('.', ',');

export function RefundDialog({ operation, onClose }: { operation: Operation; onClose(): void }) {
  const { snapshot, execute } = useApp();
  const refund = operation.kind === 'refund' ? operation : undefined;
  const expense = refund ? snapshot.operations.find(item => item.id === refund.refundOf && item.kind === 'expense')! : operation;
  const remaining = refundableAmount(snapshot, expense.id) + (refund?.cashDeltaCents ?? 0);
  const defaultDescription = refund?.description ?? `Rimborso: ${expense.description}`;
  const [amount, setAmount] = useState(refund ? moneyValue(refund.cashDeltaCents) : '');
  const [description, setDescription] = useState(defaultDescription);
  const [date, setDate] = useState(refund?.effectiveDate ?? today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const commandId = useRef(crypto.randomUUID());
  const changed = refund ? amount !== moneyValue(refund.cashDeltaCents) || description !== refund.description || date !== refund.effectiveDate : !!amount || description !== defaultDescription;
  const close = () => { if (!changed || window.confirm('Chiudere senza salvare il rimborso?')) onClose(); };
  return <Dialog title={refund ? 'Modifica rimborso' : 'Registra rimborso'} onClose={close} busy={busy}><form onSubmit={event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    const common = { date, amountCents: parseMoney(amount), description: description.trim() };
    void execute(refund ? { type: 'update-refund', refundId: refund.id, ...common } : { type: 'refund', expenseId: expense.id, ...common }, commandId.current)
      .then(onClose).catch(problem => setError(errorMessage(problem))).finally(() => setBusy(false));
  }}>
    <p className="muted">Spesa del {formatDate(expense.effectiveDate)}. Importo disponibile per questo rimborso: <strong>{formatMoney(remaining)}</strong>.</p>
    <MoneyInput label="Importo rimborsato" value={amount} onChange={setAmount} hint={`Massimo ${formatMoney(remaining)}.`} />
    <label className="field">Descrizione<input required maxLength={120} value={description} onChange={event => setDescription(event.target.value)} /></label>
    <label className="field">Data del rimborso<input type="date" min={expense.effectiveDate} max={today()} required value={date} onChange={event => setDate(event.target.value)} /></label>
    {error && <p role="alert" className="error-message">{error}</p>}
    <div className="dialog-footer"><button type="button" className="button secondary" disabled={busy} onClick={close}>Annulla</button><button className="button primary" disabled={busy}>{busy ? 'Salvataggio…' : refund ? 'Salva modifiche' : 'Salva rimborso'}</button></div>
  </form></Dialog>;
}
