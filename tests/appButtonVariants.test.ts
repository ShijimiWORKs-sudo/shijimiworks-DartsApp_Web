import assert from 'node:assert/strict';
import test from 'node:test';

import { themes } from '../constants/theme';
import {
  gameModeButtonColors,
  resolveAppButtonVariantColors,
} from '../components/appButtonVariants';

test('game mode AppButton variants use fixed backgrounds and white labels across themes', () => {
  for (const theme of Object.values(themes)) {
    assert.deepEqual(resolveAppButtonVariantColors('countUp', theme), gameModeButtonColors.countUp);
    assert.deepEqual(resolveAppButtonVariantColors('zeroOne', theme), gameModeButtonColors.zeroOne);
    assert.deepEqual(resolveAppButtonVariantColors('cricket', theme), gameModeButtonColors.cricket);
    assert.deepEqual(resolveAppButtonVariantColors('match', theme), gameModeButtonColors.match);

    assert.equal(resolveAppButtonVariantColors('countUp', theme).labelColor, '#FFFFFF');
    assert.equal(resolveAppButtonVariantColors('zeroOne', theme).labelColor, '#FFFFFF');
    assert.equal(resolveAppButtonVariantColors('cricket', theme).labelColor, '#FFFFFF');
    assert.equal(resolveAppButtonVariantColors('match', theme).labelColor, '#FFFFFF');
  }
});

test('existing AppButton variants keep their theme-based colors', () => {
  const theme = themes.gray;

  assert.deepEqual(resolveAppButtonVariantColors('primary', theme), {
    backgroundColor: theme.primary,
    labelColor: '#FFFFFF',
  });
  assert.deepEqual(resolveAppButtonVariantColors('secondary', theme), {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    labelColor: theme.primaryDark,
  });
  assert.deepEqual(resolveAppButtonVariantColors('danger', theme), {
    backgroundColor: theme.danger,
    labelColor: '#FFFFFF',
  });
});
