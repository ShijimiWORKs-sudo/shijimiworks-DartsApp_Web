import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getWebContentMaxWidth,
  getWebGameActionColumnWidth,
  isDesktopWebLayout,
  isSupportRouteInWebPrimaryNavigation,
  shouldShowBottomNavigation,
  shouldShowWebTopNavigation,
  webPrimaryNavigationItems,
  WEB_DESKTOP_BREAKPOINT,
} from '../../components/web/webLayout';

test('desktop web layout starts at 1024px only on web', () => {
  assert.equal(isDesktopWebLayout('web', WEB_DESKTOP_BREAKPOINT - 1), false);
  assert.equal(isDesktopWebLayout('web', WEB_DESKTOP_BREAKPOINT), true);
  assert.equal(isDesktopWebLayout('ios', 1440), false);
  assert.equal(isDesktopWebLayout('android', 1440), false);
});

test('desktop web uses top navigation and preserves native bottom navigation', () => {
  assert.equal(shouldShowWebTopNavigation('web', 1280, true), true);
  assert.equal(shouldShowBottomNavigation('web', 1280, true), false);

  assert.equal(shouldShowWebTopNavigation('web', 390, true), false);
  assert.equal(shouldShowBottomNavigation('web', 390, true), true);

  assert.equal(shouldShowWebTopNavigation('ios', 1280, true), false);
  assert.equal(shouldShowBottomNavigation('ios', 1280, true), true);
});

test('web primary navigation excludes support routes', () => {
  assert.deepEqual(
    webPrimaryNavigationItems.map((item) => item.href),
    ['/home', '/game', '/account/profile'],
  );
  assert.equal(isSupportRouteInWebPrimaryNavigation('/practice'), false);
  assert.equal(isSupportRouteInWebPrimaryNavigation('/records'), false);
  assert.equal(isSupportRouteInWebPrimaryNavigation('/analysis'), false);
  assert.equal(isSupportRouteInWebPrimaryNavigation('/consult'), false);
});

test('pc game layout keeps a bounded content area and action column', () => {
  assert.equal(getWebContentMaxWidth(1280), 1216);
  assert.equal(getWebContentMaxWidth(1920), 1680);
  assert.equal(getWebGameActionColumnWidth(1024), 420);
  assert.equal(getWebGameActionColumnWidth(1280), 460);
  assert.equal(getWebGameActionColumnWidth(1920), 520);
});
