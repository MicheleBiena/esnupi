export type ErrorCode = 'INVALID_MONEY' | 'INVALID_DATE' | 'INVALID_DATA' | 'INSUFFICIENT_FUNDS' | 'COVERAGE_REQUIRED' | 'ALREADY_APPLIED' | 'NOT_FOUND';

export class DomainError extends Error {
  constructor(public readonly code: ErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
