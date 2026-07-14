import type { ThemeColors } from '../constants/theme';

export type AppButtonVariant =
  'primary' | 'secondary' | 'danger' | 'countUp' | 'zeroOne' | 'cricket';

type AppButtonVariantColors = {
  backgroundColor: string;
  labelColor: string;
  borderColor?: string;
};

const white = '#FFFFFF';

export const gameModeButtonColors = {
  countUp: {
    backgroundColor: '#15803D',
    labelColor: white,
  },
  zeroOne: {
    backgroundColor: '#1D4ED8',
    labelColor: white,
  },
  cricket: {
    backgroundColor: '#B91C1C',
    labelColor: white,
  },
} as const satisfies Record<'countUp' | 'zeroOne' | 'cricket', AppButtonVariantColors>;

export function resolveAppButtonVariantColors(
  variant: AppButtonVariant,
  theme: ThemeColors,
): AppButtonVariantColors {
  if (variant === 'secondary') {
    return {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      labelColor: theme.primaryDark,
    };
  }

  if (variant === 'danger') {
    return {
      backgroundColor: theme.danger,
      labelColor: white,
    };
  }

  if (variant === 'countUp' || variant === 'zeroOne' || variant === 'cricket') {
    return gameModeButtonColors[variant];
  }

  return {
    backgroundColor: theme.primary,
    labelColor: white,
  };
}
