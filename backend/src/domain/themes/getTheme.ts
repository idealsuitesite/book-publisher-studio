import type { Theme } from '../models/Theme';
import type { TypographyOverride } from '../models/Project';
import { ClassicTheme } from './ClassicTheme';
import { ModernTheme } from './ModernTheme';
import { NovelTheme } from './NovelTheme';
import { UnknownThemeError } from '../../shared/errors/UnknownThemeError';

/**
 * Preset → body-size OFFSET from the theme's own default (MINI_DR_TYPOGRAPHY_TUNING §2.1,
 * CTO-validated explicitly): for every current theme (both ship body 11pt, measured) this is
 * numerically the CTO's 10/11/12/13 mapping — and it guarantees "standard" always means the
 * theme's designed default, so a future theme with a different body keeps its identity.
 */
const PRESET_BODY_OFFSET_PT: Record<NonNullable<TypographyOverride['preset']>, number> = {
  compact: -1,
  standard: 0,
  comfort: 1,
  large: 2,
};

/**
 * Logical font roles → the same real font-name strings the shipped themes already use: 'Georgia'
 * is what ClassicTheme ships (the registry maps it to embedded Gelasio), 'Helvetica' is what
 * ModernTheme's headings ship (→ embedded Inter). Using the themes' own vocabulary keeps
 * DOCX/EPUB output carrying real, reader-recognisable font names — never the literal words
 * "serif"/"sans" as a font family.
 */
const FONT_ROLE_NAME: Record<'serif' | 'sans', string> = {
  serif: 'Georgia',
  sans: 'Helvetica',
};

const THEMES: Record<string, Theme> = {
  classic: ClassicTheme,
  modern: ModernTheme,
  novel: NovelTheme,
};

export function getTheme(name: string): Theme {
  const theme = THEMES[name];
  if (!theme) {
    throw new UnknownThemeError(`Unknown theme: ${name}`);
  }
  return theme;
}

/**
 * The theme a render should use: the named theme, with the optional per-project overrides applied
 * over it — the accent (MINI_DR_PER_THEME_ACCENT, colour-only/R2-free) and the typography
 * (MINI_DR_TYPOGRAPHY_TUNING, GEOMETRY-MOVING: preset sizes + font pairing). This is the SINGLE
 * place overrides are applied, so the export and publish tails — and, upstream of both, the
 * measurer and the renderer — see the same resolved theme by construction (charged == consumed
 * holds under overrides for that exact reason, proven on the corpus in the scope spike).
 *
 * Scaled sizes are FRACTIONAL ON PURPOSE (e.g. h1 = 28 × 12/11 = 30.545…): the body/heading
 * RATIO is what the CTO locked ("the ratio is what makes the hierarchy coherent"), and rounding
 * would drift it. Every consumer (PDFKit, docx, EPUB CSS) accepts fractional points — do not
 * "clean these up" into integers; that would be a ratio regression, not a tidy-up.
 *
 * No overrides (`undefined`) returns the theme unchanged — `resolveTheme(name) === getTheme(name)`
 * by construction, which keeps the raw-bytes routes' behaviour untouched.
 */
export function resolveTheme(name: string, accentOverride?: string, typographyOverride?: TypographyOverride): Theme {
  let theme = getTheme(name);

  if (typographyOverride) {
    const { preset, bodyFont, headingFont } = typographyOverride;
    if (preset && PRESET_BODY_OFFSET_PT[preset] !== 0) {
      const defaultBody = theme.fontSizes.body;
      const scale = (defaultBody + PRESET_BODY_OFFSET_PT[preset]) / defaultBody;
      theme = {
        ...theme,
        fontSizes: {
          h1: theme.fontSizes.h1 * scale,
          h2: theme.fontSizes.h2 * scale,
          h3: theme.fontSizes.h3 * scale,
          h4: theme.fontSizes.h4 * scale,
          h5: theme.fontSizes.h5 * scale,
          h6: theme.fontSizes.h6 * scale,
          body: defaultBody + PRESET_BODY_OFFSET_PT[preset],
          small: theme.fontSizes.small * scale,
        },
      };
    }
    if (bodyFont || headingFont) {
      theme = {
        ...theme,
        fonts: {
          body: bodyFont ? FONT_ROLE_NAME[bodyFont] : theme.fonts.body,
          heading: headingFont ? FONT_ROLE_NAME[headingFont] : theme.fonts.heading,
        },
      };
    }
  }

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
