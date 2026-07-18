import type { CapturedBoardImage } from '../../domain/types';
import { normalizeCapturedImageSource } from '../../application/CameraCaptureService';
import type { CameraAnalysisFrame, CameraFrameSource } from '../application/CameraFrameSource';
import { decodeImageToGrayscaleFrame } from './WebCameraFrameSource';

type DirectCanvasCameraFrameSourceDependencies = {
  getVideoElement?: () => HTMLVideoElement | null;
  fallbackCaptureImage?: () => Promise<CapturedBoardImage | null>;
  maxSize?: number;
};

export class DirectCanvasCameraFrameSource implements CameraFrameSource {
  readonly diagnostics = {
    preferredSource: 'fallback',
    lastSource: 'none' as 'none' | 'data-uri-fallback',
    lastError: null as string | null,
  };

  constructor(private readonly dependencies: DirectCanvasCameraFrameSourceDependencies) {}

  async captureFrame(options?: { maxSize?: number }): Promise<CameraAnalysisFrame> {
    if (!this.dependencies.fallbackCaptureImage) {
      throw new Error('DIRECT_CANVAS_UNAVAILABLE_ON_NATIVE');
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
    this.diagnostics.lastSource = 'none';
  }
}
