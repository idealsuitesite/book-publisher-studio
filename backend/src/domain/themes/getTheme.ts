import type { Theme } from '../models/Theme';
import { ClassicTheme } from './ClassicTheme';

const THEMES: Record<string, Theme> = {
  classic: ClassicTheme,
};

export function getTheme(name: string): Theme {
  const theme = THEMES[name];
  if (!theme) {
    throw new Error(`Unknown theme: ${name}`);
  }
  return theme;
}
