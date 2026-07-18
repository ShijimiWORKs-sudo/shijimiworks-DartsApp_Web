import type { CameraCapturedPicture, CameraPictureOptions, PermissionResponse } from 'expo-camera';
import { Platform } from 'react-native';

import type {
  CameraAvailabilityState,
  CameraFacing,
  CameraPermissionState,
  CameraRuntimePlatform,
  CapturedBoardImage,
  CapturedBoardImageSourceKind,
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

export type ParsedDataUri = {
  mimeType: string;
  encoding: 'base64';
  payload: string;
};

export type NormalizedImageSource = {
  src: string;
  mimeType: string;
  encoding: 'data-uri' | 'raw-base64' | 'blob-url' | 'remote-url' | 'file-uri';
  uriPrefixKind: CapturedBoardImageUriPrefixKind;
  base64Kind: 'none' | 'raw-base64' | 'data-uri';
};

type CapturedBoardImageUriPrefixKind = Exclude<CapturedBoardImageSourceKind, 'raw-base64'>;

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
  const uriData = tryParseDataUri(uri);
  const base64Data = picture.base64?.trim();
  const base64DataUri = base64Data?.startsWith('data:') ? tryParseDataUri(base64Data) : null;
  const rawBase64 =
    platform === 'web' && base64Data && !base64Data.startsWith('data:')
      ? normalizeRawBase64(base64Data)
      : undefined;
  const dataUri =
    platform === 'web' ? (uriData ? uri : base64DataUri ? base64Data : undefined) : undefined;
  const mimeType = inferCapturedImageMimeType({
    format: (picture as CameraCapturedPicture & { format?: string }).format,
    uri,
    base64: base64Data,
    fallback: rawBase64 ? inferMimeTypeFromRawBase64(rawBase64) : undefined,
  });
  const sourceKind = resolveCapturedSourceKind({ uri, dataUri, rawBase64 });

  return {
    id,
    uri,
    width: picture.width,
    height: picture.height,
    capturedAt: now.toISOString(),
    platform,
    facing,
    mimeType,
    sourceKind,
    base64Included: platform === 'web' && Boolean(dataUri || rawBase64),
    base64Encoding: dataUri ? 'data-uri' : rawBase64 ? 'raw-base64' : undefined,
    dataUri,
    rawBase64,
  };
}

export function normalizeCapturedImageSource(image: CapturedBoardImage): NormalizedImageSource {
  if (image.uri.startsWith('data:')) {
    const parsed = parseDataUri(image.uri);
    return {
      src: image.uri,
      mimeType: parsed.mimeType,
      encoding: 'data-uri',
      uriPrefixKind: 'data-uri',
      base64Kind: 'data-uri',
    };
  }

  if (image.dataUri?.startsWith('data:')) {
    const parsed = parseDataUri(image.dataUri);
    return {
      src: image.dataUri,
      mimeType: parsed.mimeType,
      encoding: 'data-uri',
      uriPrefixKind: getUriPrefixKind(image.uri),
      base64Kind: 'data-uri',
    };
  }

  if (image.rawBase64) {
    const rawBase64 = normalizeRawBase64(image.rawBase64);
    if (!rawBase64) {
      throw new Error('WEB_IMAGE_SOURCE_EMPTY');
    }
    const mimeType = normalizeImageMimeType(image.mimeType);
    return {
      src: `data:${mimeType};base64,${rawBase64}`,
      mimeType,
      encoding: 'raw-base64',
      uriPrefixKind: getUriPrefixKind(image.uri),
      base64Kind: 'raw-base64',
    };
  }

  if (image.uri.startsWith('blob:')) {
    return {
      src: image.uri,
      mimeType: normalizeImageMimeType(image.mimeType),
      encoding: 'blob-url',
      uriPrefixKind: 'blob-url',
      base64Kind: 'none',
    };
  }

  if (image.uri.startsWith('http://') || image.uri.startsWith('https://')) {
    return {
      src: image.uri,
      mimeType: normalizeImageMimeType(image.mimeType),
      encoding: 'remote-url',
      uriPrefixKind: 'remote-url',
      base64Kind: 'none',
    };
  }

  if (image.uri.startsWith('file:')) {
    return {
      src: image.uri,
      mimeType: normalizeImageMimeType(image.mimeType),
      encoding: 'file-uri',
      uriPrefixKind: 'file-uri',
      base64Kind: 'none',
    };
  }

  throw new Error('WEB_IMAGE_SOURCE_EMPTY');
}

export function parseDataUri(value: string): ParsedDataUri {
  if (!value.trim()) {
    throw new Error('WEB_IMAGE_SOURCE_EMPTY');
  }

  const match = value.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/i);
  if (!match) {
    throw new Error('WEB_IMAGE_DATA_URI_INVALID');
  }

  const mimeType = normalizeImageMimeType(match[1] || '');
  if (!match[2]) {
    throw new Error('WEB_IMAGE_DATA_URI_INVALID');
  }

  const payload = normalizeRawBase64(match[3]);
  if (!payload) {
    throw new Error('WEB_IMAGE_SOURCE_EMPTY');
  }

  return {
    mimeType,
    encoding: 'base64',
    payload,
  };
}

export function normalizeRawBase64(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('data:')) {
    return parseDataUri(trimmed).payload;
  }

  return trimmed.replace(/\s+/g, '');
}

export function inferCapturedImageMimeType(input: {
  format?: string;
  uri?: string;
  base64?: string;
  fallback?: string;
}) {
  const uriData = input.uri?.startsWith('data:') ? tryParseDataUri(input.uri) : null;
  if (uriData) {
    return uriData.mimeType;
  }

  const base64Data = input.base64?.trim();
  const base64DataUri = base64Data?.startsWith('data:') ? tryParseDataUri(base64Data) : null;
  if (base64DataUri) {
    return base64DataUri.mimeType;
  }

  const formatMimeType = mimeTypeFromFormat(input.format);
  if (formatMimeType) {
    return formatMimeType;
  }

  return input.fallback ?? 'image/jpeg';
}

function tryParseDataUri(value: string | undefined) {
  if (!value?.startsWith('data:')) {
    return null;
  }

  try {
    return parseDataUri(value);
  } catch {
    return null;
  }
}

function normalizeImageMimeType(value: string) {
  const mimeType = value.trim().toLowerCase();
  if (!mimeType) {
    return 'image/jpeg';
  }

  if (!mimeType.startsWith('image/')) {
    throw new Error('WEB_IMAGE_MIME_UNSUPPORTED');
  }

  return mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
}

function mimeTypeFromFormat(format: string | undefined) {
  if (!format) {
    return undefined;
  }

  const normalized = format.trim().toLowerCase();
  if (normalized === 'jpg' || normalized === 'jpeg') {
    return 'image/jpeg';
  }
  if (normalized === 'png') {
    return 'image/png';
  }
  if (normalized === 'webp') {
    return 'image/webp';
  }
  if (normalized.startsWith('image/')) {
    return normalizeImageMimeType(normalized);
  }
  return `image/${normalized}`;
}

function inferMimeTypeFromRawBase64(rawBase64: string) {
  if (rawBase64.startsWith('/9j/')) {
    return 'image/jpeg';
  }
  if (rawBase64.startsWith('iVBORw0KGgo')) {
    return 'image/png';
  }
  return undefined;
}

function resolveCapturedSourceKind(input: {
  uri: string;
  dataUri?: string;
  rawBase64?: string;
}): CapturedBoardImageSourceKind {
  if (input.uri.startsWith('data:') || input.dataUri) {
    return 'data-uri';
  }
  if (input.rawBase64) {
    return 'raw-base64';
  }
  return getUriPrefixKind(input.uri);
}

function getUriPrefixKind(uri: string): CapturedBoardImageUriPrefixKind {
  if (uri.startsWith('data:')) {
    return 'data-uri';
  }
  if (uri.startsWith('blob:')) {
    return 'blob-url';
  }
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return 'remote-url';
  }
  if (uri.startsWith('file:')) {
    return 'file-uri';
  }
  return 'unknown';
}
