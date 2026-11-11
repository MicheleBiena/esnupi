import { DomainError } from './errors';
import type { CommandContext, Operation, Snapshot } from './types';

const groupKinds = new Set<Operation['kind']>(['income', 'expense', 'allocation', 'transfer', 'release']);

function editableGroup(snapshot: Snapshot, operationId: string): Operation[] {
  const target = snapshot.operations.find(operation => operation.id === operationId);
  if (!target) throw new DomainError('NOT_FOUND', 'Il movimento non esiste.');
  if (target.origin !== 'manual' || (target.kind !== 'income' && target.kind !== 'expense')) {
    throw new DomainError('INVALID_DATA', 'Puoi modificare soltanto entrate e uscite manuali.');
  }
  if (target.occurrenceId || target.planMonth || target.goalId || target.refundOf) throw new DomainError('INVALID_DATA', 'Questo movimento è collegato ad altri dati e non può essere modificato qui.');
  if (snapshot.operations.some(operation => operation.refundOf === target.id)) throw new DomainError('INVALID_DATA', 'Una spesa rimborsata non può essere modificata o eliminata.');
  const group = snapshot.operations.filter(operation => operation.commandId === target.commandId);
  if (group.some(operation => operation.origin !== 'manual' || !groupKinds.has(operation.kind) || operation.occurrenceId || operation.planMonth || operation.goalId || operation.refundOf)) {
    throw new DomainError('INVALID_DATA', 'Il gruppo di operazioni collegato non può essere modificato.');
  }
  if (group.filter(operation => operation.kind === 'income' || operation.kind === 'expense').length !== 1) {
    throw new DomainError('INVALID_DATA', 'Il gruppo di operazioni non è riconoscibile.');
  }
  return group;
}

export function removeMovementGroup(snapshot: Snapshot, operationId: string, context?: CommandContext, action: 'update' | 'delete' = 'update'): Operation {
  const group = editableGroup(snapshot, operationId);
  const target = group.find(operation => operation.id === operationId)!;
  if (context) {
    for (const previous of group) snapshot.history.push({ id: context.newId(), commandId: context.commandId, changedAt: context.now, previous, action });
  }
  const ids = new Set(group.map(operation => operation.id));
  snapshot.operations = snapshot.operations.filter(operation => !ids.has(operation.id));
  return target;
}

export function snapshotWithoutMovementGroup(snapshot: Snapshot, operationId: string): Snapshot {
  const draft = structuredClone(snapshot);
  removeMovementGroup(draft, operationId);
  return draft;
}

export function snapshotWithoutMovement(snapshot: Snapshot, operationId: string): Snapshot {
  const operation = snapshot.operations.find(item => item.id === operationId);
  if (!operation) throw new DomainError('NOT_FOUND', 'Il movimento non esiste.');
  if (operation.origin === 'manual') return snapshotWithoutMovementGroup(snapshot, operationId);
  if (operation.origin !== 'recurring' || !operation.occurrenceId || (operation.kind !== 'income' && operation.kind !== 'expense')) throw new DomainError('INVALID_DATA', 'Il movimento non può essere corretto qui.');
  const draft = structuredClone(snapshot);
  draft.operations = draft.operations.filter(item => item.id !== operationId);
  return draft;
}
