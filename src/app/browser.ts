import type { CommandContext } from '../domain/types';

export function today(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function commandContext(commandId: string = crypto.randomUUID()): CommandContext {
  return { commandId, today: today(), now: new Date().toISOString(), newId: () => crypto.randomUUID() };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Salvataggio non riuscito. Riprova senza chiudere il modulo.';
}
