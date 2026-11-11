import { useRef, useState } from 'react';
import { useApp } from '../../app/AppProvider';
import { errorMessage, today } from '../../app/browser';
import { parseMoney } from '../../domain/money';
import { MoneyInput } from '../../shared/ui/MoneyInput';
import { Icon } from '../../shared/ui/Icon';
import { BackupPanel } from '../settings/BackupPanel';

export function Onboarding() {
  const { execute } = useApp();
  const [balance, setBalance] = useState('');
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const commandId = useRef(crypto.randomUUID());
  return <div className="welcome-layout">
    <section className="welcome-copy"><h1>Configura esnupi</h1><p>Inserisci saldo e data di partenza. Potrai poi assegnare i soldi alle buste e registrare entrate e spese.</p><div className="artwork-placeholder" aria-hidden="true">Placeholder grafica</div><div className="privacy-note"><Icon name="shield" /><p>I dati restano in questo browser.<br />Non serve un account.</p></div></section>
    <section className="panel setup-panel"><h2>Saldo iniziale</h2><p className="muted">Inserisci il saldo disponibile alla data di partenza, inclusi i risparmi.</p>
      <form onSubmit={event => {
        event.preventDefault(); if (busy) return; setBusy(true); setError('');
        void (async () => { await execute({ type: 'setup', date, balanceCents: parseMoney(balance) }, commandId.current); })().catch(problem => setError(errorMessage(problem))).finally(() => setBusy(false));
      }}>
        <MoneyInput label="Il tuo saldo iniziale" value={balance} onChange={setBalance} hint="Puoi inserire anche 0 €. I soldi si assegnano alle buste dopo la configurazione." />
        <label className="field">Data di partenza<input type="date" value={date} max={today()} required onChange={event => setDate(event.target.value)} /></label>
        <p className="small muted">Buste iniziali: Spese quotidiane, Svago, Abbonamenti e Risparmi. Puoi aggiungerne altre.</p>
        {error && <p role="alert" className="error-message">{error}</p>}
        <button className="button primary full-width" disabled={busy}>{busy ? 'Salvataggio…' : 'Salva e inizia'}<Icon name="arrow" /></button>
      </form>
      <div className="setup-import"><BackupPanel importOnly /></div>
    </section>
  </div>;
}
