export class GameDatabaseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'GameDatabaseError';
    this.cause = options?.cause;
  }
}

export class NotImplementedError extends Error {
  constructor(featureName: string) {
    super(`${featureName} is not implemented in Phase 1.`);
    this.name = 'NotImplementedError';
  }
}
