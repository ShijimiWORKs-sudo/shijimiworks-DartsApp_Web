import type { CameraFacing } from '../domain/types';

export type WebCameraResolutionPreset = {
  width: number;
  height: number;
};

export type WebCameraStreamDiagnostics = {
  requestedResolution: string;
  actualVideoWidth: number | null;
  actualVideoHeight: number | null;
  trackWidth: number | null;
  trackHeight: number | null;
  frameRate: number | null;
  frameSource: 'web-media-stream';
  fallbackReason: string | null;
};

export type OpenPreferredWebCameraStreamResult = {
  stream: MediaStream;
  diagnostics: WebCameraStreamDiagnostics;
};

export const webCameraResolutionFallbacks: WebCameraResolutionPreset[] = [
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
  { width: 640, height: 480 },
];

export function createWebVideoConstraints(
  preset: WebCameraResolutionPreset,
  facing: CameraFacing,
): MediaStreamConstraints {
  return {
    video: {
      width: { ideal: preset.width },
      height: { ideal: preset.height },
      frameRate: { ideal: 30, max: 30 },
      facingMode: facing === 'back' ? { ideal: 'environment' } : { ideal: 'user' },
    },
    audio: false,
  };
}

export async function openPreferredWebCameraStream(input: {
  facing: CameraFacing;
  mediaDevices?: Pick<MediaDevices, 'getUserMedia'>;
}): Promise<OpenPreferredWebCameraStreamResult> {
  const mediaDevices =
    input.mediaDevices ?? (typeof navigator === 'undefined' ? undefined : navigator.mediaDevices);
  if (!mediaDevices?.getUserMedia) {
    throw new Error('WEB_MEDIA_DEVICES_UNAVAILABLE');
  }

  const failures: string[] = [];
  for (const preset of webCameraResolutionFallbacks) {
    try {
      const stream = await mediaDevices.getUserMedia(
        createWebVideoConstraints(preset, input.facing),
      );
      const settings = stream.getVideoTracks()[0]?.getSettings?.() ?? {};
      const actualWidth = normalizeMetric(settings.width);
      const actualHeight = normalizeMetric(settings.height);
      const fallbackReason =
        failures.length > 0
          ? failures.join(' / ')
          : actualWidth &&
              actualHeight &&
              (actualWidth < preset.width || actualHeight < preset.height)
            ? `requested ${formatResolution(preset)} but track reported ${actualWidth}×${actualHeight}`
            : null;

      return {
        stream,
        diagnostics: {
          requestedResolution: formatResolution(preset),
          actualVideoWidth: null,
          actualVideoHeight: null,
          trackWidth: actualWidth,
          trackHeight: actualHeight,
          frameRate: normalizeMetric(settings.frameRate),
          frameSource: 'web-media-stream',
          fallbackReason,
        },
      };
    } catch (error) {
      failures.push(`${formatResolution(preset)}: ${formatWebCameraError(error)}`);
    }
  }

  throw new Error(`WEB_CAMERA_STREAM_UNAVAILABLE: ${failures.join(' / ')}`);
}

export function mergeWebVideoMetrics(
  diagnostics: WebCameraStreamDiagnostics,
  input: {
    videoWidth: number;
    videoHeight: number;
    frameRate?: number | null;
  },
): WebCameraStreamDiagnostics {
  const actualVideoWidth = input.videoWidth > 0 ? input.videoWidth : diagnostics.actualVideoWidth;
  const actualVideoHeight =
    input.videoHeight > 0 ? input.videoHeight : diagnostics.actualVideoHeight;
  return {
    ...diagnostics,
    actualVideoWidth,
    actualVideoHeight,
    frameRate: input.frameRate ?? diagnostics.frameRate,
    fallbackReason:
      diagnostics.fallbackReason ??
      buildVideoFallbackReason(
        diagnostics.requestedResolution,
        actualVideoWidth,
        actualVideoHeight,
      ),
  };
}

function buildVideoFallbackReason(
  requestedResolution: string,
  actualVideoWidth: number | null,
  actualVideoHeight: number | null,
) {
  if (!actualVideoWidth || !actualVideoHeight || requestedResolution === '640×480') {
    return null;
  }
  const [requestedWidthText, requestedHeightText] = requestedResolution.split('×');
  const requestedWidth = Number(requestedWidthText);
  const requestedHeight = Number(requestedHeightText);
  if (actualVideoWidth >= requestedWidth && actualVideoHeight >= requestedHeight) {
    return null;
  }
  return `requested ${requestedResolution} but video reported ${actualVideoWidth}×${actualVideoHeight}`;
}

function normalizeMetric(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatResolution(preset: WebCameraResolutionPreset) {
  return `${preset.width}×${preset.height}`;
}

function formatWebCameraError(error: unknown) {
  if (error instanceof Error) {
    return error.name ? `${error.name} ${error.message}` : error.message;
  }
  return String(error);
}
