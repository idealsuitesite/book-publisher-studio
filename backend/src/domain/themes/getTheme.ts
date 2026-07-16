import type { Theme } from '../models/Theme';
import { ClassicTheme } from './ClassicTheme';
import { UnknownThemeError } from '../../shared/errors/UnknownThemeError';

const THEMES: Record<string, Theme> = {
  classic: ClassicTheme,
};

export function getTheme(name: string): Theme {
  const theme = THEMES[name];
  if (!theme) {
    throw new UnknownThemeError(`Unknown theme: ${name}`);
  }
  return theme;
}
