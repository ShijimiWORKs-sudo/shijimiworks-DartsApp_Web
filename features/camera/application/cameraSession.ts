import type { CapturedBoardImage } from '../domain/types';

let pendingCapturedImage: CapturedBoardImage | null = null;
let acceptedCapturedImage: CapturedBoardImage | null = null;

export function setPendingCapturedImage(image: CapturedBoardImage) {
  pendingCapturedImage = image;
}

export function getPendingCapturedImage() {
  return pendingCapturedImage;
}

export function clearPendingCapturedImage() {
  pendingCapturedImage = null;
}

export function acceptPendingCapturedImage() {
  acceptedCapturedImage = pendingCapturedImage;
  pendingCapturedImage = null;
  return acceptedCapturedImage;
}

export function getAcceptedCapturedImage() {
  return acceptedCapturedImage;
}

export function clearAcceptedCapturedImage() {
  acceptedCapturedImage = null;
}
