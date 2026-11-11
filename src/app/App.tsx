import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useApp } from './AppProvider';
import { today } from './browser';
import { monthOf, shiftMonth } from '../domain/calendar';
import { Dashboard } from '../features/dashboard/Dashboard';
import { Envelopes } from '../features/envelopes/Envelopes';
import { Goals } from '../features/goals/Goals';
import { Onboarding } from '../features/onboarding/Onboarding';
import { Settings } from '../features/settings/Settings';
import { Recurrences } from '../features/recurrences/Recurrences';
import { DeleteMovementDialog } from '../features/transactions/DeleteMovementDialog';
import { MovementDialog } from '../features/transactions/MovementDialog';
import { Movements } from '../features/transactions/Movements';
import { RefundDialog } from '../features/transactions/RefundDialog';
import { Icon } from '../shared/ui/Icon';
import type { Operation } from '../domain/types';

const pages = [
  { path: '/mese', title: 'Il mio mese', icon: 'home', subtitle: 'Saldo, entrate e spese del mese.' },
  { path: '/movimenti', title: 'Movimenti', icon: 'journal', subtitle: 'Registra e consulta entrate e spese.' },
  { path: '/buste', title: 'Buste', icon: 'envelope', subtitle: 'Dividi il saldo tra spese, risparmi e obiettivi.' },
  { path: '/obiettivi', title: 'Obiettivi', icon: 'target', subtitle: 'Calcola quanto accantonare e quando raggiungere un importo.' },
  { path: '/ricorrenze', title: 'Ricorrenze', icon: 'repeat', subtitle: 'Entrate e spese periodiche.' },
  { path: '/impostazioni', title: 'Impostazioni', icon: 'settings', subtitle: 'Backup e dati locali.' },
] as const;
const subscribe = (callback: () => void) => { window.addEventListener('hashchange', callback); return () => window.removeEventListener('hashchange', callback); };
const getPath = () => location.hash.slice(1) || '/mese';

export function App() {
  const { snapshot, loading, startupError } = useApp();
  const path = useSyncExternalStore(subscribe, getPath);
  const page = pages.find(item => item.path === path);
  const [movement, setMovement] = useState<Operation | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Operation | null>(null);
  const [refunding, setRefunding] = useState<Operation | null>(null);
  const [month, setMonth] = useState(() => monthOf(today()));
  const main = useRef<HTMLElement>(null);
  useEffect(() => { main.current?.focus(); document.title = `${page?.title ?? 'esnupi'} — esnupi`; }, [path, page?.title, !!snapshot.settings]);

  if (loading) return <main className="startup"><span className="brand-word">esnupi<span>.</span></span><p role="status">Caricamento dati…</p></main>;
  if (startupError) return <main className="startup"><h1>Impossibile aprire l’archivio</h1><p role="alert">{startupError}</p><p>I dati non sono stati cancellati. Controlla che questo browser consenta il salvataggio dei dati del sito.</p><button className="button secondary" onClick={() => location.reload()}>Riprova</button></main>;

  const initialized = !!snapshot.settings;
  const monthLabel = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(new Date(`${month}-15T12:00:00`));
  const monthNavigation = <div className="month-switcher"><button className="icon-button" aria-label="Mese precedente" disabled={!snapshot.settings || month <= monthOf(snapshot.settings.startDate)} onClick={() => setMonth(shiftMonth(month, -1))}><Icon name="left" size={18} /></button><span>{monthLabel}</span><button className="icon-button" aria-label="Mese successivo" disabled={month >= monthOf(today())} onClick={() => setMonth(shiftMonth(month, 1))}><Icon name="right" size={18} /></button></div>;
  return <><a href="#main" className="skip-link" onClick={event => { event.preventDefault(); main.current?.focus(); }}>Vai al contenuto</a><div className={`app-shell ${initialized ? '' : 'is-welcome'}`}>
    <aside className="sidebar"><a href="#/mese" className="brand" aria-label="esnupi, il mio mese"><span className="brand-word">esnupi<span>.</span></span></a>
      {initialized ? <><nav aria-label="Navigazione principale">{pages.slice(0, 5).map(item => <a key={item.path} href={`#${item.path}`} aria-current={path === item.path ? 'page' : undefined}><Icon name={item.icon} />{item.title}{path === item.path && <span className="nav-dot" />}</a>)}</nav><div className="sidebar-bottom"><a href="#/impostazioni" className="settings-link" aria-current={path === '/impostazioni' ? 'page' : undefined}><Icon name="settings" />Impostazioni</a><span className="local-label"><span />Salvato in questo browser</span></div></> : <div className="sidebar-bottom"><span className="local-label"><Icon name="shield" size={16} />Dati locali</span></div>}
    </aside>
    <main id="main" ref={main} tabIndex={-1} className="main-content">
      {!initialized ? <Onboarding /> : !page ? <section className="panel empty-state"><h1>Questa pagina non c’è.</h1><a href="#/mese" className="button primary">Torna al mio mese</a></section> : <>
        <header className="page-header"><div><h1>{page.title}</h1><p className="muted">{page.subtitle}</p></div><button className="button primary" onClick={() => setMovement('new')}><Icon name="plus" />Aggiungi movimento</button></header>
        {(path === '/mese' || path === '/movimenti') && <div className="period-row">{monthNavigation}</div>}
        {path === '/mese' && <Dashboard month={month} current={month === monthOf(today())} />}
        {path === '/movimenti' && <Movements month={month} onEdit={setMovement} onDelete={setDeleting} onRefund={setRefunding} />}
        {path === '/buste' && <Envelopes />}
        {path === '/obiettivi' && <Goals />}
        {path === '/ricorrenze' && <Recurrences />}
        {path === '/impostazioni' && <Settings />}
      </>}
    </main>
  </div>{movement === 'new' ? <MovementDialog onClose={() => setMovement(null)} /> : movement ? <MovementDialog operation={movement} onClose={() => setMovement(null)} /> : null}{deleting && <DeleteMovementDialog operation={deleting} onClose={() => setDeleting(null)} />}{refunding && <RefundDialog operation={refunding} onClose={() => setRefunding(null)} />}</>;
}
