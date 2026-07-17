export type CameraPermissionState =
  'loading' | 'granted' | 'denied' | 'blocked' | 'unavailable' | 'error';

export type CameraFacing = 'back' | 'front';

export type CameraRuntimePlatform = 'ios' | 'android' | 'web';

export type CapturedBoardImage = {
  id: string;
  uri: string;
  width: number;
  height: number;
  capturedAt: string;
  platform: CameraRuntimePlatform;
  facing: CameraFacing;
  mimeType: 'image/jpeg';
  base64Included: boolean;
  base64Data?: string;
};

export type CameraAvailabilityState = 'checking' | 'available' | 'unavailable' | 'error';

export type CameraCaptureErrorReason = 'not_ready' | 'capture_failed';
