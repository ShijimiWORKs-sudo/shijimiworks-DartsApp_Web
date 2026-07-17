import {
  normalizeCapturedImageSource,
  parseDataUri,
  type NormalizedImageSource,
} from '../../application/CameraCaptureService';
import type { CapturedBoardImage } from '../../domain/types';
import type { CameraAnalysisFrame, CameraFrameSource } from '../application/CameraFrameSource';

type WebCameraFrameSourceDependencies = {
  captureImage: () => Promise<CapturedBoardImage | null>;
  maxSize?: number;
};

export class WebCameraFrameSource implements CameraFrameSource {
  constructor(private readonly dependencies: WebCameraFrameSourceDependencies) {}

  async captureFrame(): Promise<CameraAnalysisFrame> {
    const image = await this.dependencies.captureImage();
    if (!image) {
      throw new Error('CAMERA_FRAME_UNAVAILABLE');
    }

    const normalized = normalizeCapturedImageSource(image);
    logImageSourceDiagnostics(normalized);

    return decodeImageToGrayscaleFrame({
      frameId: image.id,
      capturedAt: image.capturedAt,
      source: normalized.src,
      sourceKind: normalized.encoding,
      mimeType: normalized.mimeType,
      capturedWidth: image.width,
      capturedHeight: image.height,
      uriPrefixKind: normalized.uriPrefixKind,
      base64Kind: normalized.base64Kind,
      maxSize: this.dependencies.maxSize ?? 96,
    });
  }
}

export async function decodeImageToGrayscaleFrame(input: {
  frameId: string;
  capturedAt: string;
  source: string;
  sourceKind?: string;
  mimeType?: string;
  capturedWidth?: number;
  capturedHeight?: number;
  uriPrefixKind?: string;
  base64Kind?: string;
  maxSize?: number;
  timeoutMs?: number;
}): Promise<CameraAnalysisFrame> {
  validateImageSource(input.source);
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    throw new Error('WEB_CANVAS_UNAVAILABLE');
  }

  const image = await loadImage(input.source, input.timeoutMs ?? 5000);
  const maxSize = input.maxSize ?? 96;
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('WEB_CANVAS_CONTEXT_UNAVAILABLE');
  }

  context.drawImage(image, 0, 0, width, height);
  const data = context.getImageData(0, 0, width, height).data;
  const grayPixels = new Uint8Array(width * height);
  for (let index = 0; index < grayPixels.length; index += 1) {
    const offset = index * 4;
    grayPixels[index] = Math.round(
      data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114,
    );
  }

  return {
    frameId: input.frameId,
    width,
    height,
    grayPixels,
    capturedAt: input.capturedAt,
    sourceKind: input.sourceKind,
    mimeType: input.mimeType,
    capturedWidth: input.capturedWidth ?? image.width,
    capturedHeight: input.capturedHeight ?? image.height,
    analysisWidth: width,
    analysisHeight: height,
    uriPrefixKind: input.uriPrefixKind,
    base64Kind: input.base64Kind,
    decodeStatus: 'success',
  };
}

function loadImage(source: string, timeoutMs: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const image = new Image();

    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      image.onload = null;
      image.onerror = null;
      callback();
    };

    image.onload = () => {
      const decode = typeof image.decode === 'function' ? image.decode() : Promise.resolve();
      void decode
        .then(() => settle(() => resolve(image)))
        .catch(() => settle(() => reject(new Error('WEB_IMAGE_DECODE_FAILED'))));
    };
    image.onerror = () => settle(() => reject(new Error('WEB_IMAGE_DECODE_FAILED')));
    timeout = setTimeout(() => {
      settle(() => reject(new Error('WEB_IMAGE_DECODE_TIMEOUT')));
    }, timeoutMs);
    image.src = source;
  });
}

function validateImageSource(source: string) {
  if (!source.trim()) {
    throw new Error('WEB_IMAGE_SOURCE_EMPTY');
  }

  if (source.startsWith('data:')) {
    const parsed = parseDataUri(source);
    if (!parsed.mimeType.startsWith('image/')) {
      throw new Error('WEB_IMAGE_MIME_UNSUPPORTED');
    }
  }
}

function logImageSourceDiagnostics(normalized: NormalizedImageSource) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  const preview =
    normalized.encoding === 'raw-base64' || normalized.encoding === 'data-uri'
      ? `${normalized.src.slice(0, 32)}...`
      : normalized.src.split(':')[0];
  console.info('[camera-frame-source]', {
    sourceKind: normalized.encoding,
    mimeType: normalized.mimeType,
    uriPrefixKind: normalized.uriPrefixKind,
    base64Kind: normalized.base64Kind,
    preview,
  });
}
