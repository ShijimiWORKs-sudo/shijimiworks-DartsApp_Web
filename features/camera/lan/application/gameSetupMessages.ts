import {
  LAN_CAMERA_PROTOCOL_VERSION,
  type GameSetupRequest,
  type LanCameraGameSetupMode,
} from '../domain/protocol';

export function createGameSetupRequest(input: {
  sessionId: string;
  cameraNodeId: string;
  requestId: string;
  mode: LanCameraGameSetupMode;
  settings: Record<string, unknown>;
  now?: Date;
}): GameSetupRequest {
  return {
    type: 'game_setup_request',
    protocolVersion: LAN_CAMERA_PROTOCOL_VERSION,
    sessionId: input.sessionId,
    sentAt: (input.now ?? new Date()).toISOString(),
    cameraNodeId: input.cameraNodeId,
    requestId: input.requestId,
    mode: input.mode,
    settings: input.settings,
  };
}

export function canStartGameFromSetupMessage(messageType: string): boolean {
  return messageType === 'game_setup_accepted' || messageType === 'game_started';
}
