import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  loadBoardCalibrationProfile,
  saveBoardCalibrationProfile,
} from '../application/calibrationProfileStore';
import type {
  BoardCalibrationProfile,
  CalibrationRingKey,
  CalibrationStatus,
  NormalizedPoint,
} from '../domain/types';
import {
  calibrationRingKeys,
  clampCalibrationProfile,
  createDefaultCalibrationProfile,
  updateCalibrationRingRatio,
  validateCalibrationProfile,
} from '../domain/profile';
import { removePreviewMirror } from '../domain/coordinateTransform';

export type BoardCalibrationEditorApi = {
  profile: BoardCalibrationProfile;
  savedProfile: BoardCalibrationProfile;
  selectedRing: CalibrationRingKey;
  status: CalibrationStatus;
  dirty: boolean;
  invalidReasons: string[];
  setSelectedRing: (ring: CalibrationRingKey) => void;
  setPreviewMirrored: (previewMirrored: boolean) => void;
  moveCenter: (deltaX: number, deltaY: number) => void;
  setCenter: (point: NormalizedPoint) => void;
  setCenterX: (centerX: number) => void;
  setCenterY: (centerY: number) => void;
  scaleOuter: (delta: number) => void;
  setOuterRadius: (outerRadius: number) => void;
  rotate: (deltaDeg: number) => void;
  setRotationDeg: (rotationDeg: number) => void;
  adjustSelectedRing: (delta: number) => void;
  updateRing: (ring: CalibrationRingKey, delta: number) => void;
  setRingRatio: (ring: CalibrationRingKey, ratio: number) => void;
  nudgeByKeyboard: (key: string, shiftKey?: boolean) => void;
  applyPointerCenter: (screenPoint: NormalizedPoint) => void;
  resetToDefault: () => void;
  undoChange: () => void;
  revertToSaved: () => void;
  save: () => Promise<void>;
  reload: () => Promise<void>;
};

export function useBoardCalibrationEditor(): BoardCalibrationEditorApi {
  const [profile, setProfile] = useState(() => createDefaultCalibrationProfile());
  const [savedProfile, setSavedProfile] = useState(profile);
  const [selectedRing, setSelectedRing] = useState<CalibrationRingKey>('outer');
  const historyRef = useRef<BoardCalibrationProfile[]>([]);

  const validation = useMemo(() => validateCalibrationProfile(profile), [profile]);
  const dirty = JSON.stringify(profile) !== JSON.stringify(savedProfile);
  const status: CalibrationStatus = validation.valid ? (dirty ? 'editing' : 'saved') : 'invalid';

  const commitProfile = useCallback((nextProfile: BoardCalibrationProfile) => {
    setProfile((current) => {
      historyRef.current.push(current);
      return clampCalibrationProfile(nextProfile);
    });
  }, []);

  const reload = useCallback(async () => {
    const loaded = await loadBoardCalibrationProfile();
    historyRef.current = [];
    setProfile(loaded);
    setSavedProfile(loaded);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(async () => {
    const saved = await saveBoardCalibrationProfile(profile);
    historyRef.current = [];
    setProfile(saved);
    setSavedProfile(saved);
  }, [profile]);

  const setPreviewMirrored = useCallback(
    (previewMirrored: boolean) => commitProfile({ ...profile, previewMirrored }),
    [commitProfile, profile],
  );

  const moveCenter = useCallback(
    (deltaX: number, deltaY: number) =>
      commitProfile({
        ...profile,
        centerX: profile.centerX + deltaX,
        centerY: profile.centerY + deltaY,
      }),
    [commitProfile, profile],
  );

  const setCenter = useCallback(
    (point: NormalizedPoint) =>
      commitProfile({
        ...profile,
        centerX: point.x,
        centerY: point.y,
      }),
    [commitProfile, profile],
  );

  const setCenterX = useCallback(
    (centerX: number) =>
      commitProfile({
        ...profile,
        centerX,
      }),
    [commitProfile, profile],
  );

  const setCenterY = useCallback(
    (centerY: number) =>
      commitProfile({
        ...profile,
        centerY,
      }),
    [commitProfile, profile],
  );

  const scaleOuter = useCallback(
    (delta: number) => commitProfile({ ...profile, outerRadius: profile.outerRadius + delta }),
    [commitProfile, profile],
  );

  const setOuterRadius = useCallback(
    (outerRadius: number) => commitProfile({ ...profile, outerRadius }),
    [commitProfile, profile],
  );

  const rotate = useCallback(
    (deltaDeg: number) =>
      commitProfile({ ...profile, rotationDeg: profile.rotationDeg + deltaDeg }),
    [commitProfile, profile],
  );

  const setRotationDeg = useCallback(
    (rotationDeg: number) => commitProfile({ ...profile, rotationDeg }),
    [commitProfile, profile],
  );

  const updateRing = useCallback(
    (ring: CalibrationRingKey, delta: number) =>
      commitProfile(updateCalibrationRingRatio(profile, ring, delta)),
    [commitProfile, profile],
  );

  const adjustSelectedRing = useCallback(
    (delta: number) => updateRing(selectedRing, delta),
    [selectedRing, updateRing],
  );

  const setRingRatio = useCallback(
    (ring: CalibrationRingKey, ratio: number) => {
      if (ring === 'outer') {
        setOuterRadius(ratio);
        return;
      }
      const field = ringToProfileField(ring);
      commitProfile({ ...profile, [field]: ratio });
    },
    [commitProfile, profile, setOuterRadius],
  );

  const nudgeByKeyboard = useCallback(
    (key: string, shiftKey = false) => {
      const step = shiftKey ? 0.025 : 0.0025;
      if (key === 'ArrowLeft') {
        moveCenter(-step, 0);
      } else if (key === 'ArrowRight') {
        moveCenter(step, 0);
      } else if (key === 'ArrowUp') {
        moveCenter(0, -step);
      } else if (key === 'ArrowDown') {
        moveCenter(0, step);
      }
    },
    [moveCenter],
  );

  const applyPointerCenter = useCallback(
    (screenPoint: NormalizedPoint) => {
      setCenter(removePreviewMirror(screenPoint, profile.previewMirrored));
    },
    [profile.previewMirrored, setCenter],
  );

  const resetToDefault = useCallback(
    () => commitProfile(createDefaultCalibrationProfile()),
    [commitProfile],
  );

  const undoChange = useCallback(() => {
    const previous = historyRef.current.pop();
    if (previous) {
      setProfile(previous);
    }
  }, []);

  const revertToSaved = useCallback(() => {
    historyRef.current = [];
    setProfile(savedProfile);
  }, [savedProfile]);

  return {
    profile,
    savedProfile,
    selectedRing,
    status,
    dirty,
    invalidReasons: validation.reasons,
    setSelectedRing: (ring) => {
      if (calibrationRingKeys.includes(ring)) {
        setSelectedRing(ring);
      }
    },
    setPreviewMirrored,
    moveCenter,
    setCenter,
    setCenterX,
    setCenterY,
    scaleOuter,
    setOuterRadius,
    rotate,
    setRotationDeg,
    adjustSelectedRing,
    updateRing,
    setRingRatio,
    nudgeByKeyboard,
    applyPointerCenter,
    resetToDefault,
    undoChange,
    revertToSaved,
    save,
    reload,
  };
}

function ringToProfileField(ring: Exclude<CalibrationRingKey, 'outer'>) {
  switch (ring) {
    case 'double_outer':
      return 'doubleOuterRatio';
    case 'double_inner':
      return 'doubleInnerRatio';
    case 'triple_outer':
      return 'tripleOuterRatio';
    case 'triple_inner':
      return 'tripleInnerRatio';
    case 'outer_bull':
      return 'outerBullRatio';
    case 'inner_bull':
      return 'innerBullRatio';
  }
}
