export const WEB_DESKTOP_BREAKPOINT = 1024;
export const WEB_COMPACT_WIDTH = 1280;
export const WEB_WIDE_BREAKPOINT = 1600;
export const WEB_DESKTOP_MAX_CONTENT_WIDTH = 1440;
export const WEB_WIDE_MAX_CONTENT_WIDTH = 1680;

export type RuntimePlatform = 'android' | 'ios' | 'web' | 'windows' | 'macos' | string;

export type WebPrimaryNavigationItem = {
  href: '/home' | '/game' | '/account/profile';
  label: 'HOME' | 'GAME' | 'ACCOUNT';
};

export const webPrimaryNavigationItems: WebPrimaryNavigationItem[] = [
  { href: '/home', label: 'HOME' },
  { href: '/game', label: 'GAME' },
  { href: '/account/profile', label: 'ACCOUNT' },
];

export function isDesktopWebLayout(platform: RuntimePlatform, width: number): boolean {
  return platform === 'web' && width >= WEB_DESKTOP_BREAKPOINT;
}

export function getWebGameSettingsShellDirection(
  platform: RuntimePlatform,
  width: number,
): 'row' | 'column' {
  return isDesktopWebLayout(platform, width) ? 'row' : 'column';
}

export function shouldShowWebTopNavigation(
  platform: RuntimePlatform,
  width: number,
  showNav: boolean,
): boolean {
  return showNav && isDesktopWebLayout(platform, width);
}

export function shouldShowBottomNavigation(
  platform: RuntimePlatform,
  width: number,
  showNav: boolean,
): boolean {
  return showNav && !isDesktopWebLayout(platform, width);
}

export function getWebContentMaxWidth(width: number): number {
  const preferredMax =
    width >= WEB_WIDE_BREAKPOINT ? WEB_WIDE_MAX_CONTENT_WIDTH : WEB_DESKTOP_MAX_CONTENT_WIDTH;
  return Math.max(0, Math.min(preferredMax, width - 64));
}

export function getWebGameActionColumnWidth(width: number): number {
  if (width >= WEB_WIDE_BREAKPOINT) {
    return 520;
  }
  if (width >= WEB_COMPACT_WIDTH) {
    return 460;
  }
  return 420;
}

export function isSupportRouteInWebPrimaryNavigation(href: string): boolean {
  return webPrimaryNavigationItems.some((item) => item.href === href);
}
