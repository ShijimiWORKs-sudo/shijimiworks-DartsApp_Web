import type { CountUpGameService } from '../../../game/application/services/CountUpGameService';
import type { CricketGameService } from '../../../game/application/services/CricketGameService';
import type { MatchGameService } from '../../../game/application/services/MatchGameService';
import type { ZeroOneGameService } from '../../../game/application/services/ZeroOneGameService';
import type { CameraDartInput } from '../domain/types';

export type LocalCameraGameMode = 'count_up' | 'zero_one' | 'cricket' | 'match';

export type CameraLocalGameServices = {
  countUp: Pick<CountUpGameService, 'recordDart'>;
  zeroOne: Pick<ZeroOneGameService, 'recordDart'>;
  cricket: Pick<CricketGameService, 'recordDart'>;
  match: Pick<MatchGameService, 'recordDart'>;
};

export class CameraLocalGameAdapter {
  constructor(private readonly services: CameraLocalGameServices) {}

  recordCandidate(input: {
    mode: LocalCameraGameMode;
    gameId: string;
    dart: CameraDartInput;
  }): Promise<unknown> {
    const dartInput = {
      area: input.dart.area,
      segmentNumber: input.dart.segmentNumber,
      inputSource: input.dart.inputSource,
      clientActionId: input.dart.clientActionId,
    };

    if (input.mode === 'count_up') {
      return this.services.countUp.recordDart(input.gameId, dartInput);
    }
    if (input.mode === 'zero_one') {
      return this.services.zeroOne.recordDart(input.gameId, dartInput);
    }
    if (input.mode === 'cricket') {
      return this.services.cricket.recordDart(input.gameId, dartInput);
    }
    return this.services.match.recordDart(input.gameId, dartInput);
  }
}
