import { useApp } from '../../app/AppProvider';
import { today } from '../../app/browser';
import { formatDate } from '../../domain/calendar';
import { monthView } from '../../domain/ledger';
import { formatMoney } from '../../domain/money';
import { refundableAmount } from '../../domain/refunds';
import type { Operation } from '../../domain/types';
import { Icon } from '../../shared/ui/Icon';

export type MovementFilter = 'all' | 'income' | 'expense' | 'refund' | 'automatic';

export function TransactionList({ month, limit, query = '', filter = 'all', envelopeId = '', onEdit, onDelete, onRefund }: {
  month: string; limit?: number; query?: string; filter?: MovementFilter; envelopeId?: string;
  onEdit?(operation: Operation): void; onDelete?(operation: Operation): void; onRefund?(operation: Operation): void;
}) {
  const { snapshot } = useApp();
  const all = monthView(snapshot, month, today()).operations.filter(operation => operation.kind === 'income' || operation.kind === 'expense' || operation.kind === 'refund');
  const needle = query.trim().toLocaleLowerCase('it-IT');
  const operations = all.filter(operation => {
    const envelope = snapshot.envelopes.find(item => item.id === operation.envelopeDeltas[0]?.envelopeId);
    const matchesText = !needle || `${operation.description} ${envelope?.name ?? ''}`.toLocaleLowerCase('it-IT').includes(needle);
    const matchesType = filter === 'all' || filter === 'automatic' ? filter === 'all' || operation.origin === 'recurring' : operation.kind === filter;
    const matchesEnvelope = !envelopeId || operation.envelopeDeltas.some(leg => leg.envelopeId === envelopeId);
    return matchesText && matchesType && matchesEnvelope;
  });
  if (!operations.length) return <div className="empty-state"><h3>{all.length ? 'Nessun movimento corrisponde ai filtri' : 'Nessun movimento nel mese selezionato'}</h3><p className="muted">{all.length ? 'Modifica o azzera i filtri per vedere altri movimenti.' : 'Usa «Aggiungi movimento» per registrare un’entrata o una spesa.'}</p></div>;
  return <ul className="transaction-list">{operations.slice(0, limit).map(operation => {
    const envelope = snapshot.envelopes.find(item => item.id === operation.envelopeDeltas[0]?.envelopeId);
    const correctable = (operation.origin === 'manual' || operation.origin === 'recurring') && (operation.kind === 'income' || operation.kind === 'expense');
    const refundable = operation.kind === 'expense' ? refundableAmount(snapshot, operation.id) : 0;
    const hasActions = correctable && (onEdit || onDelete || (onRefund && refundable > 0)) || operation.kind === 'refund' && !!(onRefund || onDelete);
    return <li key={operation.id}><span className={`transaction-icon ${operation.cashDeltaCents > 0 ? 'incoming' : ''}`}><Icon name={operation.cashDeltaCents > 0 ? 'plus' : 'journal'} /></span><div className="transaction-description"><strong>{operation.description}</strong><span className="small muted">{formatDate(operation.effectiveDate)} · {envelope?.name ?? 'Entrata'}{operation.origin === 'recurring' ? ' · Automatica' : operation.kind === 'refund' ? ' · Rimborso' : ''}</span></div><strong className="transaction-amount">{operation.cashDeltaCents > 0 ? '+' : '−'}{formatMoney(Math.abs(operation.cashDeltaCents))}</strong>{hasActions && <div className="transaction-actions">{onRefund && operation.kind === 'expense' && refundable > 0 && <button className="text-button" onClick={() => onRefund(operation)}>Rimborsa</button>}{onRefund && operation.kind === 'refund' && <button className="text-button" onClick={() => onRefund(operation)}>Modifica</button>}{onEdit && operation.kind !== 'refund' && <button className="text-button" onClick={() => onEdit(operation)}>{operation.origin === 'recurring' ? 'Correggi' : 'Modifica'}</button>}{onDelete && <button className="text-button danger-text" onClick={() => onDelete(operation)}>Elimina</button>}</div>}</li>;
  })}</ul>;
}
