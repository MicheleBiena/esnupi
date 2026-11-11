import { useState } from 'react';
import { useApp } from '../../app/AppProvider';
import { errorMessage } from '../../app/browser';
import { Dialog } from '../../shared/ui/Dialog';
import { BackupPanel } from './BackupPanel';

const CONFIRMATION = 'ELIMINA';

export function Settings() {
  const { reset } = useApp();
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const close = () => { if (!busy) { setConfirming(false); setConfirmation(''); setError(''); } };

  return <section className="settings-stack">
    <section className="panel settings-panel"><BackupPanel /></section>
    <section className="panel settings-panel danger-zone" aria-labelledby="reset-title">
      <h2 id="reset-title">Elimina tutti i dati</h2>
      <p className="muted">Cancella saldo, buste, movimenti, obiettivi e impostazioni salvati in questo browser.</p>
      <button className="button danger" onClick={() => setConfirming(true)}>Elimina tutti i dati</button>
    </section>
    {confirming && <Dialog title="Eliminare tutti i dati?" onClose={close} busy={busy}>
      <p><strong>L’operazione è permanente.</strong> Se vuoi conservare una copia, annulla ed esporta prima un backup.</p>
      <label className="field confirmation-field">Scrivi <strong>{CONFIRMATION}</strong> per confermare
        <input autoFocus autoComplete="off" value={confirmation} onChange={event => setConfirmation(event.target.value)} />
      </label>
      {error && <p role="alert" className="error-message">{error}</p>}
      <div className="dialog-footer"><button className="button secondary" type="button" disabled={busy} onClick={close}>Annulla</button><button className="button danger" type="button" disabled={busy || confirmation !== CONFIRMATION} onClick={() => {
        setBusy(true); setError('');
        void reset().catch(problem => setError(errorMessage(problem))).finally(() => setBusy(false));
      }}>{busy ? 'Eliminazione…' : 'Elimina definitivamente'}</button></div>
    </Dialog>}
  </section>;
}
