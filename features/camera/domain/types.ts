export type CameraPermissionState =
  'loading' | 'granted' | 'denied' | 'blocked' | 'unavailable' | 'error';

export type CameraFacing = 'back' | 'front';

export type CameraRuntimePlatform = 'ios' | 'android' | 'web';

export type CapturedBoardImageSourceKind =
  'data-uri' | 'raw-base64' | 'blob-url' | 'remote-url' | 'file-uri' | 'unknown';

export type CapturedBoardImageBase64Encoding = 'data-uri' | 'raw-base64';

export type CapturedBoardImage = {
  id: string;
  uri: string;
  width: number;
  height: number;
  capturedAt: string;
  platform: CameraRuntimePlatform;
  facing: CameraFacing;
  mimeType: string;
  sourceKind: CapturedBoardImageSourceKind;
  base64Included: boolean;
  base64Encoding?: CapturedBoardImageBase64Encoding;
  dataUri?: string;
  rawBase64?: string;
};

export type CameraAvailabilityState = 'checking' | 'available' | 'unavailable' | 'error';

export type CameraCaptureErrorReason = 'not_ready' | 'capture_failed';
