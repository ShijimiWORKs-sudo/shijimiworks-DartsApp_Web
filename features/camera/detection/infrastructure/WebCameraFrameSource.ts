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

  async captureFrame(options?: { maxSize?: number }): Promise<CameraAnalysisFrame> {
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
      maxSize: options?.maxSize ?? this.dependencies.maxSize ?? 320,
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
  const sourceMaxSize = Math.max(maxSize, 640);
  const sourceScale = Math.min(1, sourceMaxSize / Math.max(image.width, image.height));
  const sourceWidth = Math.max(1, Math.round(image.width * sourceScale));
  const sourceHeight = Math.max(1, Math.round(image.height * sourceScale));
  const sourceFrame = drawImageToFrame({
    image,
    width: sourceWidth,
    height: sourceHeight,
    input,
  });
  const scale = Math.min(1, maxSize / Math.max(sourceFrame.width, sourceFrame.height));
  const width = Math.max(1, Math.round(sourceFrame.width * scale));
  const height = Math.max(1, Math.round(sourceFrame.height * scale));
  const analysisFrame =
    width === sourceFrame.width && height === sourceFrame.height
      ? sourceFrame
      : resizeFramePixels(sourceFrame, width, height);

  return {
    ...analysisFrame,
    sourceFrame:
      analysisFrame.width === sourceFrame.width && analysisFrame.height === sourceFrame.height
        ? undefined
        : sourceFrame,
  };
}

function drawImageToFrame(input: {
  image: HTMLImageElement;
  width: number;
  height: number;
  input: {
    frameId: string;
    capturedAt: string;
    sourceKind?: string;
    mimeType?: string;
    capturedWidth?: number;
    capturedHeight?: number;
    uriPrefixKind?: string;
    base64Kind?: string;
  };
}): CameraAnalysisFrame {
  const canvas = document.createElement('canvas');
  canvas.width = input.width;
  canvas.height = input.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('WEB_CANVAS_CONTEXT_UNAVAILABLE');
  }

  context.drawImage(input.image, 0, 0, input.width, input.height);
  const data = context.getImageData(0, 0, input.width, input.height).data;
  const grayPixels = new Uint8Array(input.width * input.height);
  for (let index = 0; index < grayPixels.length; index += 1) {
    const offset = index * 4;
    grayPixels[index] = Math.round(
      data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114,
    );
  }

  return {
    frameId: input.input.frameId,
    width: input.width,
    height: input.height,
    grayPixels,
    capturedAt: input.input.capturedAt,
    sourceKind: input.input.sourceKind,
    mimeType: input.input.mimeType,
    capturedWidth: input.input.capturedWidth ?? input.image.width,
    capturedHeight: input.input.capturedHeight ?? input.image.height,
    analysisWidth: input.width,
    analysisHeight: input.height,
    uriPrefixKind: input.input.uriPrefixKind,
    base64Kind: input.input.base64Kind,
    decodeStatus: 'success',
  };
}

function resizeFramePixels(
  sourceFrame: CameraAnalysisFrame,
  width: number,
  height: number,
): CameraAnalysisFrame {
  const grayPixels = new Uint8Array(width * height);
  const scaleX = sourceFrame.width / width;
  const scaleY = sourceFrame.height / height;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(sourceFrame.width - 1, Math.floor(x * scaleX));
      const sourceY = Math.min(sourceFrame.height - 1, Math.floor(y * scaleY));
      grayPixels[y * width + x] = sourceFrame.grayPixels[sourceY * sourceFrame.width + sourceX];
    }
  }
  return {
    ...sourceFrame,
    width,
    height,
    grayPixels,
    analysisWidth: width,
    analysisHeight: height,
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
