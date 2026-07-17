import type { CameraCapturedPicture, CameraPictureOptions, PermissionResponse } from 'expo-camera';
import { Platform } from 'react-native';

import type {
  CameraAvailabilityState,
  CameraFacing,
  CameraPermissionState,
  CameraRuntimePlatform,
  CapturedBoardImage,
} from '../domain/types';

export type CameraAvailabilityChecker = () => Promise<boolean>;

type PermissionLike = Pick<PermissionResponse, 'granted' | 'canAskAgain'>;

type CapturedBoardImageInput = {
  picture: CameraCapturedPicture;
  facing: CameraFacing;
  platform: CameraRuntimePlatform;
  now: Date;
  id: string;
};

export async function checkCameraAvailability(
  checker: CameraAvailabilityChecker,
): Promise<CameraAvailabilityState> {
  try {
    return (await checker()) ? 'available' : 'unavailable';
  } catch (error) {
    console.warn('Camera availability check failed.', error);
    return 'error';
  }
}

export function resolveCameraPermissionState(
  permission: PermissionLike | null,
  availability: CameraAvailabilityState,
): CameraPermissionState {
  if (availability === 'checking') {
    return 'loading';
  }

  if (availability === 'unavailable') {
    return 'unavailable';
  }

  if (availability === 'error') {
    return 'error';
  }

  if (!permission) {
    return 'loading';
  }

  if (permission.granted) {
    return 'granted';
  }

  return permission.canAskAgain ? 'denied' : 'blocked';
}

export function getNextCameraFacing(facing: CameraFacing): CameraFacing {
  return facing === 'back' ? 'front' : 'back';
}

export function createCameraPictureOptions(platform: CameraRuntimePlatform): CameraPictureOptions {
  return {
    quality: 0.85,
    skipProcessing: false,
    exif: false,
    base64: platform === 'web',
  };
}

export function getCameraRuntimePlatform(os: typeof Platform.OS): CameraRuntimePlatform {
  if (os === 'ios' || os === 'android' || os === 'web') {
    return os;
  }

  return 'web';
}

export function createCapturedBoardImage({
  picture,
  facing,
  platform,
  now,
  id,
}: CapturedBoardImageInput): CapturedBoardImage {
  const uri = picture.uri;
  const base64Data = picture.base64 ?? extractBase64FromDataUri(uri);

  return {
    id,
    uri,
    width: picture.width,
    height: picture.height,
    capturedAt: now.toISOString(),
    platform,
    facing,
    mimeType: 'image/jpeg',
    base64Included: platform === 'web' && Boolean(base64Data),
    base64Data: platform === 'web' ? base64Data : undefined,
  };
}

function extractBase64FromDataUri(uri: string) {
  if (!uri.startsWith('data:')) {
    return undefined;
  }

  return uri.split(',')[1] || undefined;
}
