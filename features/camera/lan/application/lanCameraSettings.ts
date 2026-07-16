import AsyncStorage from '@react-native-async-storage/async-storage';

const LAN_CAMERA_NODE_SETTINGS_KEY = 'DartsApp:lanCameraNodeSettings';

export type LanCameraNodeSettings = {
  relayHost: string;
  relayPort: number;
  cameraNodeName: string;
};

export const defaultLanCameraNodeSettings: LanCameraNodeSettings = {
  relayHost: '127.0.0.1',
  relayPort: 8120,
  cameraNodeName: 'Camera Node',
};

export async function loadLanCameraNodeSettings(): Promise<LanCameraNodeSettings> {
  const raw = await AsyncStorage.getItem(LAN_CAMERA_NODE_SETTINGS_KEY);
  if (!raw) {
    return defaultLanCameraNodeSettings;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LanCameraNodeSettings>;
    return {
      relayHost:
        typeof parsed.relayHost === 'string' && parsed.relayHost.length > 0
          ? parsed.relayHost
          : defaultLanCameraNodeSettings.relayHost,
      relayPort:
        typeof parsed.relayPort === 'number'
          ? parsed.relayPort
          : defaultLanCameraNodeSettings.relayPort,
      cameraNodeName:
        typeof parsed.cameraNodeName === 'string' && parsed.cameraNodeName.length > 0
          ? parsed.cameraNodeName
          : defaultLanCameraNodeSettings.cameraNodeName,
    };
  } catch {
    return defaultLanCameraNodeSettings;
  }
}

export async function saveLanCameraNodeSettings(settings: LanCameraNodeSettings) {
  await AsyncStorage.setItem(LAN_CAMERA_NODE_SETTINGS_KEY, JSON.stringify(settings));
}
