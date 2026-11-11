import { useState } from 'react';
import { useApp } from '../../app/AppProvider';
import type { Operation } from '../../domain/types';
import { TransactionList } from './TransactionList';
import type { MovementFilter } from './TransactionList';

export function Movements({ month, onEdit, onDelete, onRefund }: { month: string; onEdit(operation: Operation): void; onDelete(operation: Operation): void; onRefund(operation: Operation): void }) {
  const { snapshot } = useApp();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MovementFilter>('all');
  const [envelopeId, setEnvelopeId] = useState('');
  const filtered = !!query || filter !== 'all' || !!envelopeId;
  const reset = () => { setQuery(''); setFilter('all'); setEnvelopeId(''); };
  return <section className="panel"><div className="movement-filters" aria-label="Filtri movimenti">
    <label className="field">Cerca<input type="search" value={query} placeholder="Descrizione o busta" onChange={event => setQuery(event.target.value)} /></label>
    <label className="field">Tipo<select value={filter} onChange={event => setFilter(event.target.value as MovementFilter)}><option value="all">Tutti</option><option value="income">Entrate</option><option value="expense">Uscite</option><option value="refund">Rimborsi</option><option value="automatic">Automatici</option></select></label>
    <label className="field">Busta<select value={envelopeId} onChange={event => setEnvelopeId(event.target.value)}><option value="">Tutte le buste</option>{snapshot.envelopes.map(envelope => <option key={envelope.id} value={envelope.id}>{envelope.name}</option>)}</select></label>
    <button className="text-button filter-reset" disabled={!filtered} onClick={reset}>Azzera filtri</button>
  </div><TransactionList month={month} query={query} filter={filter} envelopeId={envelopeId} onEdit={onEdit} onDelete={onDelete} onRefund={onRefund} /></section>;
}
