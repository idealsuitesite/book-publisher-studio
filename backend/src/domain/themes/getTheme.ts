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

// Additive, read-only (Sprint 7 commit 2, Decision 5) - exposes the same registry getTheme()
// already looks up by name, so a discovery endpoint can enumerate real theme names instead of
// hand-duplicating this list in Presentation. No new business logic, no behavior change to
// getTheme() itself.
export function listThemeNames(): string[] {
  return Object.keys(THEMES);
}
