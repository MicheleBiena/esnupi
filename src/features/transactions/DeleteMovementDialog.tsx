import { useState } from 'react';
import { useApp } from '../../app/AppProvider';
import { errorMessage } from '../../app/browser';
import { formatDate } from '../../domain/calendar';
import { formatMoney } from '../../domain/money';
import type { Operation } from '../../domain/types';
import { Dialog } from '../../shared/ui/Dialog';

export function DeleteMovementDialog({ operation, onClose }: { operation: Operation; onClose(): void }) {
  const { execute } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const automatic = operation.origin === 'recurring';
  const refund = operation.kind === 'refund';
  return <Dialog title={refund ? 'Elimina rimborso' : automatic ? 'Elimina registrazione' : 'Elimina movimento'} onClose={onClose} busy={busy}>
    <p><strong>{operation.description}</strong><br />{formatDate(operation.effectiveDate)} · {formatMoney(Math.abs(operation.cashDeltaCents))}</p>
    <p>{refund ? 'Il rimborso sarà eliminato. La spesa originale resterà nel diario.' : automatic ? 'La registrazione sarà eliminata e non verrà generata di nuovo. La ricorrenza resta attiva per le altre scadenze.' : 'Il movimento sarà eliminato. Se la spesa aveva una copertura, saranno eliminati anche gli spostamenti collegati.'}</p>
    {error && <p role="alert" className="error-message">{error}</p>}
    <div className="dialog-footer"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Annulla</button><button type="button" className="button danger" disabled={busy} onClick={() => {
      setBusy(true); setError('');
      void execute(refund ? { type: 'delete-refund', refundId: operation.id } : automatic ? { type: 'skip-occurrence', operationId: operation.id } : { type: 'delete-movement', operationId: operation.id }).then(onClose).catch(problem => setError(errorMessage(problem))).finally(() => setBusy(false));
    }}>{busy ? 'Eliminazione…' : refund ? 'Elimina rimborso' : automatic ? 'Elimina registrazione' : 'Elimina movimento'}</button></div>
  </Dialog>;
}
