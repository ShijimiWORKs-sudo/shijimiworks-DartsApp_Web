import AsyncStorage from '@react-native-async-storage/async-storage';

import type { BoardCalibrationProfile } from '../domain/types';
import {
  clampCalibrationProfile,
  createDefaultCalibrationProfile,
  validateCalibrationProfile,
} from '../domain/profile';

export const LOCAL_COUNT_UP_CALIBRATION_PROFILE_KEY =
  'dartsapp:camera:local-count-up:calibration-profile:v2';

export async function loadBoardCalibrationProfile(): Promise<BoardCalibrationProfile> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_COUNT_UP_CALIBRATION_PROFILE_KEY);
    if (!raw) {
      return createDefaultCalibrationProfile();
    }
    const parsed = JSON.parse(raw) as Partial<BoardCalibrationProfile>;
    const profile = clampCalibrationProfile(parsed);
    return validateCalibrationProfile(profile).valid ? profile : createDefaultCalibrationProfile();
  } catch (error) {
    console.warn('Failed to load board calibration profile.', error);
    return createDefaultCalibrationProfile();
  }
}

export async function saveBoardCalibrationProfile(
  profile: BoardCalibrationProfile,
): Promise<BoardCalibrationProfile> {
  const nextProfile = clampCalibrationProfile(profile);
  await AsyncStorage.setItem(LOCAL_COUNT_UP_CALIBRATION_PROFILE_KEY, JSON.stringify(nextProfile));
  return nextProfile;
}
