import type { BackgroundTheme, UiTheme } from '../types';

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  mutedCard: string;
  onBackground: string;
  onBackgroundMuted: string;
  onCard: string;
  onCardMuted: string;
  primary: string;
  primaryDark: string;
  primarySoft: string;
  accent: string;
  info: string;
  text: string;
  textMuted: string;
  border: string;
  warning: string;
  danger: string;
};

export const defaultUiTheme: UiTheme = 'gray';
export const defaultBackgroundTheme: BackgroundTheme = 'white';

export const backgroundThemeOptions: {
  id: BackgroundTheme;
  label: string;
  hex: string;
  rgb: string;
}[] = [
  { id: 'black', label: '黒', hex: '#040000', rgb: 'R004 G000 B000' },
  { id: 'brown', label: 'ブラウン', hex: '#955629', rgb: 'R149 G086 B041' },
  { id: 'purple', label: '紫', hex: '#A64A97', rgb: 'R166 G074 B151' },
  { id: 'orange', label: 'オレンジ', hex: '#F6AD3C', rgb: 'R246 G173 B060' },
  { id: 'white', label: '白', hex: '#FFFFFF', rgb: 'R255 G255 B255' },
];

export const backgroundThemeColors: Record<BackgroundTheme, string> = backgroundThemeOptions.reduce(
  (accumulator, option) => ({
    ...accumulator,
    [option.id]: option.hex,
  }),
  {} as Record<BackgroundTheme, string>,
);

export function getOnBackgroundTextColor(backgroundTheme: BackgroundTheme) {
  return backgroundTheme === 'black' || backgroundTheme === 'brown' || backgroundTheme === 'purple'
    ? '#ffffff'
    : '#111827';
}

export function getOnBackgroundMutedTextColor(backgroundTheme: BackgroundTheme) {
  return backgroundTheme === 'black' || backgroundTheme === 'brown' || backgroundTheme === 'purple'
    ? '#f3f4f6'
    : '#647067';
}

export const themes: Record<UiTheme, ThemeColors> = {
  light: {
    background: '#f7fbf8',
    surface: '#ffffff',
    surfaceMuted: '#edf7f0',
    mutedCard: '#edf7f0',
    onBackground: '#111827',
    onBackgroundMuted: '#647067',
    onCard: '#111827',
    onCardMuted: '#647067',
    primary: '#16a66a',
    primaryDark: '#087243',
    primarySoft: '#dff6e9',
    accent: '#111827',
    info: '#3b82f6',
    text: '#111827',
    textMuted: '#647067',
    border: '#dbe8df',
    warning: '#d78b00',
    danger: '#c24141',
  },
  gray: {
    background: '#eef1f3',
    surface: '#ffffff',
    surfaceMuted: '#e7ecea',
    mutedCard: '#e7ecea',
    onBackground: '#111827',
    onBackgroundMuted: '#667085',
    onCard: '#111827',
    onCardMuted: '#667085',
    primary: '#16a66a',
    primaryDark: '#087243',
    primarySoft: '#dff6e9',
    accent: '#111827',
    info: '#3b82f6',
    text: '#111827',
    textMuted: '#667085',
    border: '#d6dde1',
    warning: '#f59e0b',
    danger: '#c24141',
  },
};

export const colors = themes[defaultUiTheme];

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};
