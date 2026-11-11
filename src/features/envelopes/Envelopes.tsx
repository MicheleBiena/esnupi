import { useRef, useState } from 'react';
import { useApp } from '../../app/AppProvider';
import { errorMessage, today } from '../../app/browser';
import { policyAt, project } from '../../domain/ledger';
import { formatMoney, parseMoney } from '../../domain/money';
import { monthOf } from '../../domain/calendar';
import { Dialog } from '../../shared/ui/Dialog';
import { MoneyInput } from '../../shared/ui/MoneyInput';
import { Icon } from '../../shared/ui/Icon';
import type { Envelope } from '../../domain/types';

export function TransferDialog({ toEnvelopeId, onClose }: { toEnvelopeId?: string | undefined; onClose(): void }) {
  const { snapshot, execute } = useApp();
  const activeEnvelopes = snapshot.envelopes.filter(envelope => !envelope.archived).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const [from, setFrom] = useState('free');
  const [to, setTo] = useState(toEnvelopeId ?? activeEnvelopes[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const commandId = useRef(crypto.randomUUID());
  const balance = project(snapshot, today());
  const options = [{ id: 'free', name: 'Soldi da assegnare', amount: balance.unassigned }, ...activeEnvelopes.map(envelope => ({ id: envelope.id, name: envelope.name, amount: balance.envelopes.get(envelope.id) ?? 0 }))];
  const close = () => { if (!amount || window.confirm('Chiudere senza salvare lo spostamento?')) onClose(); };
  return <Dialog title="Sposta soldi" onClose={close} busy={busy}><p className="muted">Spostare soldi tra buste non cambia il tuo saldo totale.</p><form onSubmit={event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    void (async () => {
      await execute({ type: 'transfer', date: today(), amountCents: parseMoney(amount), fromEnvelopeId: from === 'free' ? null : from, toEnvelopeId: to === 'free' ? null : to }, commandId.current);
      onClose();
    })().catch(problem => setError(errorMessage(problem))).finally(() => setBusy(false));
  }}>
    <label className="field">Da dove?<select value={from} onChange={event => setFrom(event.target.value)}>{options.map(option => <option key={option.id} value={option.id}>{option.name} · {formatMoney(option.amount)}</option>)}</select></label>
    <label className="field">Verso quale busta?<select value={to} onChange={event => setTo(event.target.value)}>{options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
    <MoneyInput label="Quanto vuoi spostare?" value={amount} onChange={setAmount} />
    {error && <p role="alert" className="error-message">{error}</p>}
    <div className="dialog-footer"><button className="button primary" disabled={busy}>{busy ? 'Salvataggio…' : 'Sposta soldi'}</button></div>
  </form></Dialog>;
}

function CreateEnvelopeDialog({ onClose }: { onClose(): void }) {
  const { execute } = useApp();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'spending' | 'saving'>('spending');
  const [rollover, setRollover] = useState<'carry' | 'release-positive'>('carry');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const commandId = useRef(crypto.randomUUID());
  return <Dialog title="Una nuova busta" busy={busy} onClose={() => { if (!name || window.confirm('Chiudere senza creare la busta?')) onClose(); }}><form onSubmit={event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    void execute({ type: 'create-envelope', name: name.trim(), kind, rollover }, commandId.current).then(onClose).catch(problem => setError(errorMessage(problem))).finally(() => setBusy(false));
  }}>
    <label className="field">Nome della busta<input required maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="Per esempio: Vacanze" /></label>
    <label className="field">A cosa serve?<select value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="spending">Spese</option><option value="saving">Risparmio</option></select></label>
    <label className="field">A fine mese<select value={rollover} onChange={event => setRollover(event.target.value as typeof rollover)}><option value="carry">Conserva i soldi in questa busta</option><option value="release-positive">Restituisci l’avanzo ai soldi da assegnare</option></select></label>
    <p className="small muted">Un eventuale scoperto resta visibile anche nel mese successivo.</p>
    {error && <p role="alert" className="error-message">{error}</p>}<button className="button primary" disabled={busy}>{busy ? 'Creazione…' : 'Crea busta'}</button>
  </form></Dialog>;
}

function EditEnvelopeDialog({ envelope, onClose }: { envelope: Envelope; onClose(): void }) {
  const { snapshot, execute } = useApp();
  const currentMonth = monthOf(today());
  const available = project(snapshot, today()).envelopes.get(envelope.id) ?? 0;
  const initialRollover = policyAt(snapshot.policies, envelope.id, currentMonth)?.rollover ?? 'carry';
  const [name, setName] = useState(envelope.name);
  const [rollover, setRollover] = useState<'carry' | 'release-positive'>(initialRollover);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const changed = name !== envelope.name || rollover !== initialRollover;
  const close = () => { if (!changed || window.confirm('Chiudere senza salvare le modifiche?')) onClose(); };
  if (confirmArchive) return <Dialog title="Archivia busta" onClose={() => setConfirmArchive(false)} busy={busy}><p><strong>{envelope.name}</strong> non comparirà più tra le buste attive. I movimenti passati resteranno nel diario.</p>{error && <p role="alert" className="error-message">{error}</p>}<div className="dialog-footer"><button className="button secondary" disabled={busy} onClick={() => setConfirmArchive(false)}>Indietro</button><button className="button danger" disabled={busy} onClick={() => { setBusy(true); setError(''); void execute({ type: 'archive-envelope', envelopeId: envelope.id }).then(onClose).catch(problem => setError(errorMessage(problem))).finally(() => setBusy(false)); }}>{busy ? 'Archiviazione…' : 'Archivia busta'}</button></div></Dialog>;
  return <Dialog title="Modifica busta" onClose={close} busy={busy}><form onSubmit={event => { event.preventDefault(); if (busy) return; setBusy(true); setError(''); void execute({ type: 'update-envelope', envelopeId: envelope.id, name: name.trim(), rollover, effectiveMonth: currentMonth }).then(onClose).catch(problem => setError(errorMessage(problem))).finally(() => setBusy(false)); }}>
    <label className="field">Nome della busta<input required maxLength={120} value={name} onChange={event => setName(event.target.value)} /></label>
    <label className="field">Da questo mese<select value={rollover} onChange={event => setRollover(event.target.value as typeof rollover)}><option value="carry">Conserva i soldi in questa busta</option><option value="release-positive">Restituisci l’avanzo ai soldi da assegnare</option></select></label>
    <p className="small muted">La modifica non cambia i mesi precedenti.</p>
    {error && <p role="alert" className="error-message">{error}</p>}
    <div className="dialog-footer split-footer"><button type="button" className="text-button danger-text" disabled={busy || available !== 0 || envelope.kind === 'goal'} onClick={() => { setError(''); setConfirmArchive(true); }}>Archivia busta</button><span className="dialog-footer-main"><button type="button" className="button secondary" disabled={busy} onClick={close}>Annulla</button><button className="button primary" disabled={busy || !changed}>{busy ? 'Salvataggio…' : 'Salva modifiche'}</button></span></div>
    {available !== 0 && <p className="small muted">Per archiviare, porta prima il saldo della busta a zero.</p>}{envelope.kind === 'goal' && <p className="small muted">La busta di un obiettivo si gestisce dalla pagina Obiettivi.</p>}
  </form></Dialog>;
}

export function EnvelopeCards({ compact = false, onEdit }: { compact?: boolean; onEdit?(envelope: Envelope): void }) {
  const { snapshot } = useApp();
  const [transfer, setTransfer] = useState<string | null>(null);
  const balance = project(snapshot, today());
  const envelopes = snapshot.envelopes.filter(envelope => !envelope.archived).sort((a, b) => a.order - b.order);
  return <><div className={`envelope-grid ${compact ? 'compact' : ''}`}>{(compact ? envelopes.slice(0, 4) : envelopes).map(envelope => {
    const available = balance.envelopes.get(envelope.id) ?? 0;
    return <article key={envelope.id} className={`envelope-card tone-${envelope.color}`}><div className="envelope-top"><span className="icon-tile"><Icon name={envelope.kind === 'goal' ? 'target' : 'envelope'} /></span><span className="tag">{envelope.kind === 'saving' ? 'RISPARMIO' : envelope.kind === 'goal' ? 'OBIETTIVO' : 'SPESE'}</span></div><h3>{envelope.name}</h3><p className={`envelope-amount ${available < 0 ? 'negative' : ''}`}>{formatMoney(available)}</p><p className="small muted">{available < 0 ? 'Da coprire' : policyAt(snapshot.policies, envelope.id, monthOf(today()))?.rollover === 'release-positive' ? 'Avanzo da riassegnare a fine mese' : 'Si conserva per il prossimo mese'}</p><div className="card-actions"><button className="text-button" onClick={() => setTransfer(envelope.id)}>{available < 0 ? 'Copri la differenza' : 'Sposta soldi'}<Icon name="arrow" size={16} /></button>{onEdit && <button className="text-button" onClick={() => onEdit(envelope)}>Modifica</button>}</div></article>;
  })}</div>{transfer && <TransferDialog toEnvelopeId={transfer} onClose={() => setTransfer(null)} />}</>;
}

export function Envelopes() {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Envelope | null>(null);
  return <><div className="section-heading actions-only"><button className="button secondary" onClick={() => setCreating(true)}><Icon name="plus" />Nuova busta</button></div><EnvelopeCards onEdit={setEditing} />{creating && <CreateEnvelopeDialog onClose={() => setCreating(false)} />}{editing && <EditEnvelopeDialog envelope={editing} onClose={() => setEditing(null)} />}</>;
}
