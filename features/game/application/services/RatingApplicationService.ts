import type { RatingEvaluationApplyResult, RatingRepository } from '../ports';
import { calculateRatingUpdate } from '../../domain/rating';

export type RatingApplicationServicePort = {
  applyEvaluation(
    evaluationId: string,
    calculationDateTime?: string,
  ): Promise<RatingEvaluationApplyResult>;
  processPending(input?: {
    limit?: number;
    calculationDateTime?: string;
  }): Promise<RatingEvaluationApplyResult[]>;
};

type RatingClock = () => string;

export class RatingApplicationService implements RatingApplicationServicePort {
  private readonly accountLocks = new Map<string, Promise<unknown>>();

  constructor(
    private readonly repository: RatingRepository,
    private readonly clock: RatingClock = () => new Date().toISOString(),
  ) {}

  async applyEvaluation(
    evaluationId: string,
    calculationDateTime = this.clock(),
  ): Promise<RatingEvaluationApplyResult> {
    return this.repository.applyEvaluationUpdate(evaluationId, calculationDateTime, (input) =>
      calculateRatingUpdate(input),
    );
  }

  async processPending(input: { limit?: number; calculationDateTime?: string } = {}) {
    const refs = await this.repository.listPendingEvaluationRefs(input.limit ?? 20);
    const results: RatingEvaluationApplyResult[] = [];

    for (const ref of refs) {
      const result = await this.runForAccount(ref.accountId, () =>
        this.applyEvaluation(ref.evaluationId, input.calculationDateTime ?? this.clock()),
      );
      results.push(result);
    }

    return results;
  }

  private async runForAccount<T>(accountId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.accountLocks.get(accountId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(task);
    this.accountLocks.set(accountId, next);

    try {
      return await next;
    } finally {
      if (this.accountLocks.get(accountId) === next) {
        this.accountLocks.delete(accountId);
      }
    }
  }
}
