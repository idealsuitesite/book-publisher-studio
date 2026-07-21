import type { Theme } from '../models/Theme';
import { ClassicTheme } from './ClassicTheme';
import { ModernTheme } from './ModernTheme';
import { UnknownThemeError } from '../../shared/errors/UnknownThemeError';

const THEMES: Record<string, Theme> = {
  classic: ClassicTheme,
  modern: ModernTheme,
};

export function getTheme(name: string): Theme {
  const theme = THEMES[name];
  if (!theme) {
    throw new UnknownThemeError(`Unknown theme: ${name}`);
  }
  return theme;
}

/**
 * The theme a render should use: the named theme, with an optional per-project accent override
 * applied over it (MINI_DR_PER_THEME_ACCENT). This is the SINGLE place the override is applied, so
 * the export and publish tails stay identical by construction. Colour-only — it replaces
 * `colors.accent` and nothing else, for ANY theme (including Classic), so it moves no geometry
 * (R2-free). No override (`undefined`) returns the theme unchanged — `resolveTheme(name) ===
 * getTheme(name)` by construction, which keeps the raw-bytes routes' behaviour untouched.
 */
export function resolveTheme(name: string, accentOverride?: string): Theme {
  const theme = getTheme(name);
  if (!accentOverride) return theme;
  return { ...theme, colors: { ...theme.colors, accent: accentOverride } };
}

// Additive, read-only (Sprint 7 commit 2, Decision 5) - exposes the same registry getTheme()
// already looks up by name, so a discovery endpoint can enumerate real theme names instead of
// hand-duplicating this list in Presentation. No new business logic, no behavior change to
// getTheme() itself.
export function listThemeNames(): string[] {
  return Object.keys(THEMES);
}
