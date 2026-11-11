import { useRef, useState } from 'react';
import { useApp } from '../../app/AppProvider';
import { errorMessage, today } from '../../app/browser';
import { exportBackup, inspectBackup, MAX_BACKUP_BYTES } from '../../infrastructure/backup/backup';
import type { Snapshot } from '../../domain/types';
import { Dialog } from '../../shared/ui/Dialog';
import { Icon } from '../../shared/ui/Icon';

export function BackupPanel({ importOnly = false }: { importOnly?: boolean }) {
  const { snapshot, execute, restore } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [candidate, setCandidate] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const download = async () => {
    if (!snapshot.settings || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const blob = new Blob([exportBackup(snapshot, new Date().toISOString())], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `esnupi-backup-${today()}.json`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      await execute({ type: 'record-backup-export' });
      setMessage('Download avviato. Conserva il file in un posto sicuro.');
    } catch (problem) { setError(errorMessage(problem)); }
    finally { setBusy(false); }
  };
  const lastExport = snapshot.settings?.lastExportAt ? new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(snapshot.settings.lastExportAt)) : null;
  return <div className="backup-panel">
    {!importOnly && <><h2>Backup dei dati</h2><p className="muted">I dati sono salvati in questo browser. Esporta un backup per recuperarli o trasferirli su un altro PC.</p><p className="small muted">Il file contiene dati finanziari leggibili. La cancellazione dei dati del sito elimina l’archivio locale.</p></>}
    {!importOnly && <p className="small muted">{lastExport ? `Ultimo download avviato: ${lastExport}.` : 'Nessun backup esportato da questo archivio.'}</p>}
    <div className="button-row">{!importOnly && <button className="button primary" onClick={() => { void download(); }} disabled={!snapshot.settings || busy}><Icon name="download" />{busy ? 'Esportazione…' : 'Esporta backup'}</button>}
      <button className="button secondary" onClick={() => input.current?.click()} disabled={busy}>{importOnly ? 'Ho già un backup' : 'Importa backup'}</button>
    </div>
    <input ref={input} className="visually-hidden" type="file" accept=".json,application/json" aria-label="Scegli backup esnupi" onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
      setError(''); setMessage(''); setBusy(true);
      void (async () => {
        if (file.size > MAX_BACKUP_BYTES) throw new Error('Il backup supera il limite di 10 MB.');
        setCandidate(inspectBackup(await file.text()));
      })().catch(problem => setError(errorMessage(problem))).finally(() => setBusy(false));
    }} />
    {error && <p role="alert" className="error-message">{error}</p>}
    <p role="status" className="success-message">{message}</p>
    {candidate && <Dialog title="Ripristina backup" busy={busy} onClose={() => setCandidate(null)}>
      <p>Il backup contiene {candidate.envelopes.length} buste e {candidate.operations.length} movimenti.</p>
      <p><strong>Il ripristino sostituisce tutti i dati di questo browser.</strong> Esporta prima una copia del archivio attuale se vuoi conservarlo.</p>
      <div className="button-row">{snapshot.settings && <button className="button secondary" disabled={busy} onClick={() => { void download(); }}>Esporta prima una copia</button>}<button className="button primary" disabled={busy} onClick={() => {
        setBusy(true); setError('');
        void restore(candidate).then(() => { setCandidate(null); setMessage('Dati ripristinati.'); }).catch(problem => setError(errorMessage(problem))).finally(() => setBusy(false));
      }}>{busy ? 'Ripristino…' : 'Sostituisci e ripristina'}</button></div>
      {error && <p role="alert" className="error-message">{error}</p>}
    </Dialog>}
  </div>;
}
