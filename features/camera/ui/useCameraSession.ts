import { useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import {
  checkCameraAvailability,
  createCameraPictureOptions,
  createCapturedBoardImage,
  getCameraRuntimePlatform,
  getNextCameraFacing,
  resolveCameraPermissionState,
} from '../application/CameraCaptureService';
import type {
  CameraAvailabilityState,
  CameraFacing,
  CameraPermissionState,
  CapturedBoardImage,
} from '../domain/types';
import {
  mergeWebVideoMetrics,
  openPreferredWebCameraStream,
  type WebCameraStreamDiagnostics,
} from './WebCameraStream';

type CameraSessionState = {
  availability: CameraAvailabilityState;
  facing: CameraFacing;
  permissionState: CameraPermissionState;
  isFocused: boolean;
  isReady: boolean;
  isCapturing: boolean;
  shouldMountCamera: boolean;
  canTakePicture: boolean;
  errorMessage: string | null;
  webStream: MediaStream | null;
  webDiagnostics: WebCameraStreamDiagnostics | null;
  requestCameraAccess: () => Promise<void>;
  markCameraReady: () => void;
  handleMountError: () => void;
  switchFacing: () => void;
  capturePicture: (camera: CameraView | null) => Promise<CapturedBoardImage | null>;
  setWebVideoElement: (video: HTMLVideoElement | null) => void;
  getWebVideoElement: () => HTMLVideoElement | null;
  recordWebVideoMetrics: (input: {
    videoWidth: number;
    videoHeight: number;
    frameRate?: number | null;
  }) => void;
};

export function useCameraSession(): CameraSessionState {
  const [permission, requestPermission] = useCameraPermissions();
  const [availability, setAvailability] = useState<CameraAvailabilityState>('checking');
  const [facing, setFacing] = useState<CameraFacing>('back');
  const [isFocused, setIsFocused] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [webStream, setWebStream] = useState<MediaStream | null>(null);
  const [webDiagnostics, setWebDiagnostics] = useState<WebCameraStreamDiagnostics | null>(null);
  const webStreamRef = useRef<MediaStream | null>(null);
  const webVideoElementRef = useRef<HTMLVideoElement | null>(null);
  const platform = getCameraRuntimePlatform(Platform.OS);
  const isWeb = Platform.OS === 'web';

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsFocused(true);
      setIsReady(false);
      setErrorMessage(null);

      void checkCameraAvailability(() => CameraView.isAvailableAsync()).then((state) => {
        if (!cancelled) {
          setAvailability(state);
        }
      });

      return () => {
        cancelled = true;
        setIsFocused(false);
        setIsReady(false);
        setIsCapturing(false);
        stopWebStream(webStreamRef.current);
        webStreamRef.current = null;
        webVideoElementRef.current = null;
        setWebStream(null);
      };
    }, []),
  );

  const permissionState = useMemo(
    () => resolveCameraPermissionState(permission, availability),
    [availability, permission],
  );
  const shouldMountCamera = isFocused && permissionState === 'granted';
  const canTakePicture = shouldMountCamera && isReady && !isCapturing;

  useEffect(() => {
    if (!isWeb) {
      return;
    }

    if (!shouldMountCamera) {
      stopWebStream(webStreamRef.current);
      webStreamRef.current = null;
      setWebStream(null);
      setIsReady(false);
      return;
    }

    let cancelled = false;
    setIsReady(false);
    setErrorMessage(null);
    stopWebStream(webStreamRef.current);
    webStreamRef.current = null;
    setWebStream(null);

    void openPreferredWebCameraStream({ facing })
      .then(({ stream, diagnostics }) => {
        if (cancelled) {
          stopWebStream(stream);
          return;
        }
        stopWebStream(webStreamRef.current);
        webStreamRef.current = stream;
        setWebStream(stream);
        setWebDiagnostics(diagnostics);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        console.warn('Web camera stream failed.', error);
        setIsReady(false);
        setErrorMessage(
          'Webカメラを起動できませんでした。ブラウザまたは端末の設定を確認してください。',
        );
      });

    return () => {
      cancelled = true;
    };
  }, [facing, isWeb, shouldMountCamera]);

  const requestCameraAccess = useCallback(async () => {
    setErrorMessage(null);
    try {
      await requestPermission();
    } catch (error) {
      console.warn('Camera permission request failed.', error);
      setErrorMessage('カメラ権限を確認できませんでした。設定を確認してください。');
    }
  }, [requestPermission]);

  const markCameraReady = useCallback(() => {
    setIsReady(true);
    setErrorMessage(null);
  }, []);

  const handleMountError = useCallback(() => {
    setIsReady(false);
    setErrorMessage('カメラを起動できませんでした。ブラウザまたは端末の設定を確認してください。');
  }, []);

  const switchFacing = useCallback(() => {
    setFacing((current) => getNextCameraFacing(current));
    setIsReady(false);
    setErrorMessage(null);
  }, []);

  const setWebVideoElement = useCallback((video: HTMLVideoElement | null) => {
    webVideoElementRef.current = video;
  }, []);

  const getWebVideoElement = useCallback(() => webVideoElementRef.current, []);

  const recordWebVideoMetrics = useCallback(
    (input: { videoWidth: number; videoHeight: number; frameRate?: number | null }) => {
      setWebDiagnostics((current) => (current ? mergeWebVideoMetrics(current, input) : current));
    },
    [],
  );

  const capturePicture = useCallback(
    async (camera: CameraView | null) => {
      if (!camera || !canTakePicture) {
        setErrorMessage('カメラの準備が完了してから撮影してください。');
        return null;
      }

      setIsCapturing(true);
      setErrorMessage(null);
      try {
        const picture = (await camera.takePictureAsync(createCameraPictureOptions(platform))) as
          CameraCapturedPicture | undefined;

        if (!picture?.uri) {
          setErrorMessage('撮影画像を取得できませんでした。もう一度お試しください。');
          return null;
        }

        return createCapturedBoardImage({
          picture,
          facing,
          platform,
          now: new Date(),
          id: crypto.randomUUID(),
        });
      } catch (error) {
        console.warn('Camera capture failed.', error);
        setErrorMessage('撮影できませんでした。少し待ってからもう一度お試しください。');
        return null;
      } finally {
        setIsCapturing(false);
      }
    },
    [canTakePicture, facing, platform],
  );

  return {
    availability,
    facing,
    permissionState,
    isFocused,
    isReady,
    isCapturing,
    shouldMountCamera,
    canTakePicture,
    errorMessage,
    webStream,
    webDiagnostics,
    requestCameraAccess,
    markCameraReady,
    handleMountError,
    switchFacing,
    capturePicture,
    setWebVideoElement,
    getWebVideoElement,
    recordWebVideoMetrics,
  };
}

function stopWebStream(stream: MediaStream | null) {
  for (const track of stream?.getTracks?.() ?? []) {
    track.stop();
  }
}
