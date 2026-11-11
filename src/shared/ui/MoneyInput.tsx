import { useId, useState } from 'react';
import { parseMoney } from '../../domain/money';
import { errorMessage } from '../../app/browser';

export function MoneyInput({ label, value, onChange, required = true, hint }: { label: string; value: string; onChange(value: string): void; required?: boolean; hint?: string }) {
  const id = useId();
  const [error, setError] = useState('');
  return <div className="field"><label htmlFor={id}>{label}</label><div className="money-input"><input id={id} value={value} required={required} inputMode="decimal" placeholder="0,00" maxLength={20} aria-invalid={!!error} aria-describedby={`${id}-help`} onChange={event => { onChange(event.target.value); if (error) setError(''); }} onBlur={() => {
    try { if (value.trim()) parseMoney(value); setError(''); } catch (problem) { setError(errorMessage(problem)); }
  }} /><span aria-hidden="true">€</span></div><small id={`${id}-help`} className={error ? 'field-error' : 'muted'}>{error || hint || 'Usa la virgola per i centesimi, per esempio 12,50.'}</small></div>;
}
