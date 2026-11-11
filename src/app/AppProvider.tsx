import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Command, Repository } from '../application/ports';
import { emptySnapshot } from '../domain/types';
import type { Snapshot } from '../domain/types';
import { openRepository } from '../infrastructure/db/repository';
import { commandContext, errorMessage, today } from './browser';

interface AppState {
  snapshot: Snapshot; loading: boolean; startupError: string | null;
  execute(command: Command, commandId?: string): Promise<void>;
  restore(snapshot: Snapshot): Promise<void>;
  reset(): Promise<void>;
}
const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [startupError, setStartupError] = useState<string | null>(null);
  const repository = useRef<Repository | null>(null);
  const broadcast = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    let active = true;
    let opened: Repository | null = null;
    let currentDay = today();
    let timer: ReturnType<typeof setInterval> | undefined;
    let onVisible: (() => void) | undefined;
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('esnupi:changes');
    broadcast.current = channel;
    const refresh = async () => {
      try { const next = await opened?.loadSnapshot(); if (active && next) setSnapshot(next); }
      catch (error) { if (active) setStartupError(errorMessage(error)); }
    };
    if (channel) channel.onmessage = () => { void refresh(); };
    void openRepository().then(async repo => {
      opened = repo;
      if (!active) { repo.close(); return; }
      repository.current = repo;
      await refresh();
      const loaded = await repo.loadSnapshot();
      if (loaded.settings) {
        const reconciled = await repo.runCommand({ type: 'reconcile' }, commandContext());
        if (active) setSnapshot(reconciled);
      }
      const reconcileVisible = async () => {
        const current = await repo.loadSnapshot();
        if (!current.settings) return;
        const next = await repo.runCommand({ type: 'reconcile' }, commandContext());
        if (active) { setSnapshot(next); broadcast.current?.postMessage('reconciled'); }
      };
      onVisible = () => { if (document.visibilityState === 'visible') void reconcileVisible().catch(error => { if (active) setStartupError(errorMessage(error)); }); };
      document.addEventListener('visibilitychange', onVisible);
      timer = setInterval(() => {
        const nextDay = today();
        if (nextDay === currentDay || !active) return;
        currentDay = nextDay;
        void repo.runCommand({ type: 'reconcile' }, commandContext()).then(next => {
          if (active) { setSnapshot(next); broadcast.current?.postMessage('reconciled'); }
        }).catch(error => { if (active) setStartupError(errorMessage(error)); });
      }, 60_000);
    }).catch(error => { if (active) setStartupError(errorMessage(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; if (timer) clearInterval(timer); if (onVisible) document.removeEventListener('visibilitychange', onVisible); opened?.close(); channel?.close(); repository.current = null; };
  }, []);

  const execute = useCallback(async (command: Command, commandId?: string) => {
    if (!repository.current) throw new Error('Archivio non disponibile. Ricarica la pagina e riprova.');
    const next = await repository.current.runCommand(command, commandContext(commandId));
    setSnapshot(next);
    broadcast.current?.postMessage('committed');
  }, []);

  const restore = useCallback(async (next: Snapshot) => {
    if (!repository.current) throw new Error('Archivio non disponibile.');
    await repository.current.restoreBackup(next);
    setSnapshot(next);
    broadcast.current?.postMessage('restored');
  }, []);

  const reset = useCallback(async () => {
    if (!repository.current) throw new Error('Archivio non disponibile.');
    await repository.current.reset();
    setSnapshot(emptySnapshot());
    broadcast.current?.postMessage('reset');
  }, []);

  return <AppContext.Provider value={{ snapshot, loading, startupError, execute, restore, reset }}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const context = useContext(AppContext);
  if (!context) throw new Error('AppProvider mancante.');
  return context;
}
