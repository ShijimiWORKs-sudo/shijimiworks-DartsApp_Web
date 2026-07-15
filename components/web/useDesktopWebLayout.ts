import { Platform, useWindowDimensions } from 'react-native';

import { isDesktopWebLayout } from './webLayout';

export function useDesktopWebLayout(): boolean {
  const { width } = useWindowDimensions();
  return isDesktopWebLayout(Platform.OS, width);
}
