import type { NormalizedPoint } from '../types';

export type DisplaySize = {
  width: number;
  height: number;
};

export type DisplayRect = DisplaySize & {
  x: number;
  y: number;
};

export function calculateContainedImageRect(
  container: DisplaySize,
  image: DisplaySize,
): DisplayRect {
  if (!isPositiveSize(container)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  if (!isPositiveSize(image)) {
    return { x: 0, y: 0, width: container.width, height: container.height };
  }

  const scale = Math.min(container.width / image.width, container.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;

  return {
    x: (container.width - width) / 2,
    y: (container.height - height) / 2,
    width,
    height,
  };
}

export function normalizeTapPoint(
  tap: { x: number; y: number },
  imageRect: DisplayRect,
): NormalizedPoint | null {
  if (!isPositiveSize(imageRect)) {
    return null;
  }

  if (
    tap.x < imageRect.x ||
    tap.x > imageRect.x + imageRect.width ||
    tap.y < imageRect.y ||
    tap.y > imageRect.y + imageRect.height
  ) {
    return null;
  }

  return {
    x: clamp((tap.x - imageRect.x) / imageRect.width, 0, 1),
    y: clamp((tap.y - imageRect.y) / imageRect.height, 0, 1),
  };
}

export function denormalizePoint(point: NormalizedPoint, imageRect: DisplayRect) {
  return {
    x: imageRect.x + clamp(point.x, 0, 1) * imageRect.width,
    y: imageRect.y + clamp(point.y, 0, 1) * imageRect.height,
  };
}

function isPositiveSize(size: DisplaySize) {
  return size.width > 0 && size.height > 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
