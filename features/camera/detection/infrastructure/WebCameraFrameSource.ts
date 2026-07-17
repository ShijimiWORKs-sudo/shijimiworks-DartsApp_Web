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

    const source = image.base64Data
      ? `data:${image.mimeType};base64,${image.base64Data}`
      : image.uri;
    if (!source.startsWith('data:')) {
      throw new Error('CAMERA_FRAME_REQUIRES_WEB_BASE64');
    }

    return decodeImageToGrayscaleFrame({
      frameId: image.id,
      capturedAt: image.capturedAt,
      source,
      maxSize: this.dependencies.maxSize ?? 96,
    });
  }
}

export async function decodeImageToGrayscaleFrame(input: {
  frameId: string;
  capturedAt: string;
  source: string;
  maxSize?: number;
}): Promise<CameraAnalysisFrame> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    throw new Error('WEB_CANVAS_UNAVAILABLE');
  }

  const image = await loadImage(input.source);
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
  };
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('WEB_IMAGE_DECODE_FAILED'));
    image.src = source;
  });
}
