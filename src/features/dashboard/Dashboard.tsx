import { useApp } from '../../app/AppProvider';
import { today } from '../../app/browser';
import { monthView } from '../../domain/ledger';
import { formatMoney, sum } from '../../domain/money';
import { EnvelopeCards } from '../envelopes/Envelopes';
import { TransactionList } from '../transactions/TransactionList';
import { Icon } from '../../shared/ui/Icon';

export function Dashboard({ month, current }: { month: string; current: boolean }) {
  const { snapshot } = useApp();
  const view = monthView(snapshot, month, today());
  const saved = sum(snapshot.envelopes.filter(envelope => envelope.kind !== 'spending').map(envelope => Math.max(0, view.balance.envelopes.get(envelope.id) ?? 0)));
  const deficits = [...view.balance.envelopes.values()].filter(value => value < 0).length;
  return <>
    <div className="metrics-grid"><section className="metric-card metric-main"><span className="eyebrow">SALDO TOTALE</span><output aria-label="Saldo totale" className="metric-value">{formatMoney(view.balance.cash)}</output><span className="small">Include tutti i soldi nelle buste.</span></section><section className="metric-card"><span className="eyebrow">DA ASSEGNARE</span><output aria-label="Soldi da assegnare" className="metric-value">{formatMoney(view.balance.unassigned)}</output><a href="#/buste" className="text-button">Gestisci buste<Icon name="arrow" size={16} /></a></section><section className="metric-card metric-savings"><span className="eyebrow">RISPARMI E OBIETTIVI</span><output aria-label="Soldi accantonati" className="metric-value">{formatMoney(saved)}</output><span className="small">Inclusi nel saldo totale.</span></section></div>
    {(deficits > 0 || view.balance.cash < 0 || view.balance.unassigned < 0) && <div className="warning"><strong>C’è una differenza da sistemare.</strong> {deficits > 0 ? `${deficits} ${deficits === 1 ? 'busta da coprire' : 'buste da coprire'}. ` : ''}{view.balance.cash < 0 ? 'Il saldo totale è negativo. ' : ''}{view.balance.unassigned < 0 ? 'Hai assegnato più soldi di quelli disponibili. ' : ''}<a href="#/buste">Apri le buste</a></div>}
    {current && <section><div className="section-heading"><h2>Le tue buste</h2><a className="text-button" href="#/buste">Vedi tutte<Icon name="arrow" size={16} /></a></div><EnvelopeCards compact /></section>}
    <div className="dashboard-bottom"><section className="panel"><div className="section-heading"><h2>Ultimi movimenti</h2><a href="#/movimenti" className="text-button">Vedi movimenti<Icon name="arrow" size={16} /></a></div><TransactionList month={month} limit={5} /></section><aside className="panel month-note"><h2>Riepilogo del mese</h2><div className="note-row"><span>Entrate</span><strong>{formatMoney(view.income)}</strong></div><div className="note-row"><span>Uscite, al netto dei rimborsi</span><strong>{formatMoney(view.expenses)}</strong></div></aside></div>
  </>;
}
