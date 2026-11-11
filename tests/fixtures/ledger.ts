import { runCommand } from '../../src/application/commands/runCommand';
import type { Command } from '../../src/application/ports';
import { emptySnapshot } from '../../src/domain/types';
import type { CommandContext, Snapshot } from '../../src/domain/types';

export function fixture() {
  let serial = 0;
  const context = (date = '2026-01-31', commandId = `command-${serial++}`): CommandContext => ({ commandId, today: date, now: `${date}T12:00:00.000Z`, newId: () => `record-${serial++}` });
  const setup = (balanceCents = 80_000): Snapshot => runCommand(emptySnapshot(), { type: 'setup', date: '2026-01-01', balanceCents }, context());
  const command = (snapshot: Snapshot, command: Command, date?: string): Snapshot => runCommand(snapshot, command, context(date));
  return { context, setup, command };
}
