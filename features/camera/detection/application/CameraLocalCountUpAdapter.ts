import type { CountUpGameService } from '../../../game/application/services/CountUpGameService';
import type { CountUpDartInput, CountUpGameState } from '../../../game/domain/countUp';
import type { BullRule, DartArea, InputSource } from '../../../game/domain/types';
import { DetectionEngine } from './DetectionEngine';
import type { CameraDetectionCandidate, DartInputSource } from '../domain/types';

export type CameraLocalCountUpStartInput = {
  bullRule: BullRule;
  ownerName?: string;
};

export type CameraLocalCountUpDart = {
  area: DartArea;
  segmentNumber: number | null;
  source: DartInputSource;
  candidateId?: string;
};

export class CameraLocalCountUpAdapter {
  private readonly detectionEngine = new DetectionEngine();

  constructor(private readonly countUp: CountUpGameService) {}

  startGame(input: CameraLocalCountUpStartInput): Promise<CountUpGameState> {
    return this.countUp.startGame(input);
  }

  loadGame(gameId: string): Promise<CountUpGameState> {
    return this.countUp.loadGame(gameId);
  }

  recordCandidate(input: {
    gameId: string;
    candidate: CameraDetectionCandidate;
    source?: Extract<DartInputSource, 'camera_confirmed' | 'camera_corrected'>;
  }): Promise<CountUpGameState> {
    const dart = this.detectionEngine.toCameraDartInput({
      ...input.candidate,
      type: 'detection_candidate',
    });
    return this.recordDart(input.gameId, {
      area: dart.area,
      segmentNumber: dart.segmentNumber,
      source: input.source ?? 'camera_confirmed',
      candidateId: dart.candidateId,
    });
  }

  recordManual(gameId: string, input: { area: DartArea; segmentNumber: number | null }) {
    return this.recordDart(gameId, {
      area: input.area,
      segmentNumber: input.segmentNumber,
      source: 'manual',
    });
  }

  recordCorrected(
    gameId: string,
    input: { area: DartArea; segmentNumber: number | null; candidateId?: string },
  ) {
    return this.recordDart(gameId, {
      area: input.area,
      segmentNumber: input.segmentNumber,
      source: 'camera_corrected',
      candidateId: input.candidateId,
    });
  }

  recordMiss(gameId: string) {
    return this.recordManual(gameId, { area: 'miss', segmentNumber: null });
  }

  undoDart(gameId: string): Promise<CountUpGameState> {
    return this.countUp.undoDart(gameId);
  }

  redoDart(gameId: string, dartId: string): Promise<CountUpGameState> {
    return this.countUp.redoDart(gameId, dartId);
  }

  confirmTurn(gameId: string): Promise<CountUpGameState> {
    return this.countUp.confirmTurn(gameId);
  }

  pauseGame(gameId: string): Promise<CountUpGameState> {
    return this.countUp.pauseGame(gameId);
  }

  resumeGame(gameId: string): Promise<CountUpGameState> {
    return this.countUp.resumeGame(gameId);
  }

  abortGame(gameId: string): Promise<void> {
    return this.countUp.abortGame(gameId);
  }

  private recordDart(gameId: string, dart: CameraLocalCountUpDart): Promise<CountUpGameState> {
    const input: CountUpDartInput = {
      area: dart.area,
      segmentNumber: dart.segmentNumber,
      inputSource: mapDartInputSource(dart.source),
      clientActionId: createCameraClientActionId(dart),
    };
    return this.countUp.recordDart(gameId, input);
  }
}

export function mapDartInputSource(source: DartInputSource): InputSource {
  if (source === 'camera_confirmed') {
    return 'photo_detected';
  }
  if (source === 'camera_corrected') {
    return 'photo_adjusted';
  }
  return 'manual_segment';
}

function createCameraClientActionId(dart: CameraLocalCountUpDart) {
  const suffix = dart.candidateId ?? `${Date.now()}:${Math.random()}`;
  return `camera-count-up:${dart.source}:${suffix}`;
}
