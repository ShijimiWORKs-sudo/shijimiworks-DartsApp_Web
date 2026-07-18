import type { CapturedBoardImage } from '../../domain/types';
import { normalizeCapturedImageSource } from '../../application/CameraCaptureService';
import type { CameraAnalysisFrame, CameraFrameSource } from '../application/CameraFrameSource';
import { decodeImageToGrayscaleFrame } from './WebCameraFrameSource';

type DirectCanvasCameraFrameSourceDependencies = {
  getVideoElement: () => HTMLVideoElement | null;
  fallbackCaptureImage?: () => Promise<CapturedBoardImage | null>;
  maxSize?: number;
  now?: () => Date;
};

export class DirectCanvasCameraFrameSource implements CameraFrameSource {
  readonly diagnostics = {
    preferredSource: 'direct-canvas',
    lastSource: 'none' as 'none' | 'direct-canvas' | 'data-uri-fallback',
    lastError: null as string | null,
  };

  private readonly canvas: HTMLCanvasElement;

  constructor(private readonly dependencies: DirectCanvasCameraFrameSourceDependencies) {
    this.canvas = document.createElement('canvas');
  }

  async captureFrame(options?: { maxSize?: number }): Promise<CameraAnalysisFrame> {
    const video = this.dependencies.getVideoElement();
    if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      try {
        const frame = this.captureVideoFrame(
          video,
          options?.maxSize ?? this.dependencies.maxSize ?? 320,
        );
        this.diagnostics.lastSource = 'direct-canvas';
        this.diagnostics.lastError = null;
        return frame;
      } catch (error) {
        this.diagnostics.lastError = error instanceof Error ? error.message : String(error);
      }
    }

    if (!this.dependencies.fallbackCaptureImage) {
      throw new Error(this.diagnostics.lastError ?? 'DIRECT_CANVAS_VIDEO_UNAVAILABLE');
    }

    const fallback = await this.dependencies.fallbackCaptureImage();
    if (!fallback) {
      throw new Error('CAMERA_FRAME_UNAVAILABLE');
    }
    const normalized = normalizeCapturedImageSource(fallback);
    this.diagnostics.lastSource = 'data-uri-fallback';
    return decodeImageToGrayscaleFrame({
      frameId: fallback.id,
      capturedAt: fallback.capturedAt,
      source: normalized.src,
      sourceKind: normalized.encoding,
      mimeType: normalized.mimeType,
      capturedWidth: fallback.width,
      capturedHeight: fallback.height,
      uriPrefixKind: normalized.uriPrefixKind,
      base64Kind: normalized.base64Kind,
      maxSize: options?.maxSize ?? this.dependencies.maxSize ?? 320,
    });
  }

  dispose() {
    this.canvas.width = 1;
    this.canvas.height = 1;
  }

  private captureVideoFrame(video: HTMLVideoElement, maxSize: number): CameraAnalysisFrame {
    const sourceMaxSize = Math.max(maxSize, 640);
    const sourceScale = Math.min(1, sourceMaxSize / Math.max(video.videoWidth, video.videoHeight));
    const sourceWidth = Math.max(1, Math.round(video.videoWidth * sourceScale));
    const sourceHeight = Math.max(1, Math.round(video.videoHeight * sourceScale));
    const sourceFrame = this.drawVideoToFrame(video, sourceWidth, sourceHeight);
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

  private drawVideoToFrame(
    video: HTMLVideoElement,
    width: number,
    height: number,
  ): CameraAnalysisFrame {
    this.canvas.width = width;
    this.canvas.height = height;
    const context = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('WEB_CANVAS_CONTEXT_UNAVAILABLE');
    }
    context.drawImage(video, 0, 0, width, height);
    const data = context.getImageData(0, 0, width, height).data;
    const grayPixels = new Uint8Array(width * height);
    for (let index = 0; index < grayPixels.length; index += 1) {
      const offset = index * 4;
      grayPixels[index] = Math.round(
        data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114,
      );
    }
    const now = this.dependencies.now?.() ?? new Date();
    return {
      frameId: `direct-canvas-${now.getTime()}`,
      width,
      height,
      grayPixels,
      capturedAt: now.toISOString(),
      sourceKind: 'direct-canvas',
      mimeType: 'image/raw-gray',
      capturedWidth: video.videoWidth,
      capturedHeight: video.videoHeight,
      analysisWidth: width,
      analysisHeight: height,
      decodeStatus: 'success',
    };
  }
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
