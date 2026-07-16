import type { RatingRecalculationResult, RatingRepository } from '../ports';
import { calculateRatingUpdate } from '../../domain/rating';

type RatingClock = () => string;

export class RatingRecalculationService {
  constructor(
    private readonly repository: RatingRepository,
    private readonly clock: RatingClock = () => new Date().toISOString(),
  ) {}

  async recalculateFromEvaluation(
    evaluationId: string,
    calculationDateTime = this.clock(),
  ): Promise<RatingRecalculationResult> {
    return this.repository.recalculateFromEvaluation(evaluationId, calculationDateTime, (input) =>
      calculateRatingUpdate(input),
    );
  }
}
