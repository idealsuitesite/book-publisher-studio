import type { LayoutOptionDTO, ManuscriptOptionsDTO, TypographyOverrideDTO } from 'shared-types';
import { Badge, Card, cx } from '@/components/ui';

/**
 * Layout presets and the theme gallery (PRODUCT_EXPERIENCE §4.3–4.4). The radios died: a
 * premium tool shows presets, chosen visually. Every card is real — the tile's proportions
 * come from the layout's real dimensions (widthPt/heightPt, the same registry the export
 * pipeline uses), the mm and inches are computed from them, and the KDP badge marks the
 * platform presets. The theme gallery ships honest: Classic is the registry's one resident,
 * shown in its own face; the rest is a designed slot, never seven fake cards.
 */
interface FormatSelectorProps {
  options: ManuscriptOptionsDTO;
  selectedLayout: string;
  selectedTheme: string;
  /** The per-project accent override (hex), or undefined for the theme's own accent. */
  selectedAccent?: string;
  /** The per-project typography override, or undefined for the theme's own typography. */
  selectedTypography?: TypographyOverrideDTO;
  onLayoutChange: (name: string) => void;
  onThemeChange: (name: string) => void;
  /** Set (hex) or clear (null) the accent override. */
  onAccentChange: (hex: string | null) => void;
  /** Set (an object) or clear (null) the typography override. */
  onTypographyChange: (typography: TypographyOverrideDTO | null) => void;
}

/** The four CTO-locked presets (MINI_DR_TYPOGRAPHY_TUNING): names, not point values — a name
 * tells the author what they get; the re-inking Proof shows them the page-count cost live. */
const TEXT_SIZE_PRESETS: Array<{ value: NonNullable<TypographyOverrideDTO['preset']>; label: string }> = [
  { value: 'compact', label: 'Compact' },
  { value: 'standard', label: 'Standard' },
  { value: 'comfort', label: 'Comfort' },
  { value: 'large', label: 'Large print' },
];

const FONT_ROLE_LABELS: Array<{ value: 'serif' | 'sans'; label: string }> = [
  { value: 'serif', label: 'Gelasio (serif)' },
  { value: 'sans', label: 'Inter (sans)' },
];

const CATEGORY_LABELS: Record<LayoutOptionDTO['category'], string> = {
  standard: 'Standard',
  kdp: 'Amazon KDP',
};

const PT_PER_INCH = 72;
const MM_PER_INCH = 25.4;

function dims(layout: LayoutOptionDTO): { label: string; ratio: number } | null {
  if (!layout.widthPt || !layout.heightPt) return null;
  const widthIn = layout.widthPt / PT_PER_INCH;
  const heightIn = layout.heightPt / PT_PER_INCH;
  const mm = `${Math.round(widthIn * MM_PER_INCH)} × ${Math.round(heightIn * MM_PER_INCH)} mm`;
  const inches = `${trim(widthIn)}″ × ${trim(heightIn)}″`;
  return { label: `${mm} · ${inches}`, ratio: layout.widthPt / layout.heightPt };
}

function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function PresetCard({
  layout,
  checked,
  onChange,
}: {
  layout: LayoutOptionDTO;
  checked: boolean;
  onChange: () => void;
}) {
  const d = dims(layout);
  return (
    <button
      onClick={onChange}
      aria-pressed={checked}
      className={cx(
        'flex items-center gap-4 rounded-lg border px-4 py-3 text-left transition-colors duration-[var(--motion-micro)]',
        checked
          ? 'border-app-accent bg-app-surface-2 shadow-[var(--shadow-sheet)]'
          : 'border-app-border hover:border-app-text-muted'
      )}
    >
      {/* The miniature: TRUE trim proportions from the real dimensions, drawn as a sheet. */}
      {d && (
        <span
          aria-hidden
          className={cx(
            'flex h-14 shrink-0 flex-col justify-start gap-[3px] rounded-[2px] border p-[5px]',
            checked ? 'border-app-accent bg-app-surface-3' : 'border-app-border bg-app-surface-2'
          )}
          style={{ aspectRatio: `${d.ratio}` }}
        >
          <span className="block h-[3px] w-3/5 rounded-sm bg-app-text-muted opacity-60" />
          <span className="block h-[2px] w-full rounded-sm bg-app-border" />
          <span className="block h-[2px] w-full rounded-sm bg-app-border" />
          <span className="block h-[2px] w-4/5 rounded-sm bg-app-border" />
        </span>
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium text-app-text">{layout.label}</span>
          {layout.category === 'kdp' && <Badge severity="info">KDP</Badge>}
        </span>
        {d && <span className="text-xs tabular-nums text-app-text-muted">{d.label}</span>}
      </span>
    </button>
  );
}

export function FormatSelector({
  options,
  selectedLayout,
  selectedTheme,
  selectedAccent,
  selectedTypography,
  onLayoutChange,
  onThemeChange,
  onAccentChange,
  onTypographyChange,
}: FormatSelectorProps) {
  // Merge-and-set: each control patches its own field over the current override. If every field
  // ends up unset (e.g. both fonts back to "Theme default" with no preset), degrade to a CLEAR —
  // the backend rightly rejects an override that touches nothing.
  const patchTypography = (patch: Partial<TypographyOverrideDTO>) => {
    const merged = { ...selectedTypography, ...patch };
    const hasAny = merged.preset !== undefined || merged.bodyFont !== undefined || merged.headingFont !== undefined;
    onTypographyChange(hasAny ? merged : null);
  };
  const categories = Array.from(new Set(options.layouts.map((layout) => layout.category)));

  return (
    <Card className="flex max-w-2xl flex-col divide-y divide-app-border text-left">
      <div className="flex flex-col gap-4 px-8 py-6">
        <h3 className="text-lg font-semibold text-app-text">Layout</h3>
        {categories.map((category) => (
          <div key={category} className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-app-text-muted">
              {CATEGORY_LABELS[category]}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {options.layouts
                .filter((layout) => layout.category === category)
                .map((layout) => (
                  <PresetCard
                    key={layout.name}
                    layout={layout}
                    checked={selectedLayout === layout.name}
                    onChange={() => onLayoutChange(layout.name)}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 px-8 py-6">
        <h3 className="text-lg font-semibold text-app-text">Theme</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {options.themes.map((theme) => (
            <button
              key={theme.name}
              onClick={() => onThemeChange(theme.name)}
              aria-pressed={selectedTheme === theme.name}
              className={cx(
                'flex flex-col gap-1 rounded-lg border px-4 py-3 text-left transition-colors duration-[var(--motion-micro)]',
                selectedTheme === theme.name
                  ? 'border-app-accent bg-app-surface-2 shadow-[var(--shadow-sheet)]'
                  : 'border-app-border hover:border-app-text-muted'
              )}
            >
              {/* The theme speaks in its own face - a real sample, not a swatch. */}
              <span className="text-base text-app-text" style={{ fontFamily: 'var(--font-book), Georgia, serif' }}>
                {theme.label}
              </span>
              <span className="text-xs text-app-text-muted" style={{ fontFamily: 'var(--font-book), Georgia, serif' }}>
                The quick brown fox — Chapitre Un
              </span>
            </button>
          ))}
          {/* The honest slot (PRODUCT_EXPERIENCE §10.7): the gallery architecture invites;
              the content backlog is design work, never fake cards. */}
          <div className="flex flex-col justify-center gap-1 rounded-lg border border-dashed border-app-border px-4 py-3">
            <span className="text-sm text-app-text-muted">More themes are being set.</span>
            <span className="text-xs text-app-text-muted">Classic is the first resident.</span>
          </div>
        </div>
      </div>

      {/* Typography (MINI_DR_TYPOGRAPHY_TUNING): text-size presets + font pairing. GEOMETRY-
          moving, unlike the accent — the Proof re-inks and its page count IS the disclosure
          (the CTO's chosen honesty: the author watches the book lengthen live). */}
      <div className="flex flex-col gap-3 px-8 py-6">
        <h3 className="text-lg font-semibold text-app-text">Typography</h3>
        <p className="text-xs text-app-text-muted">
          Text size and fonts over your chosen theme. The Proof shows the page count change live.
        </p>
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-app-text-muted">Text size</p>
          <div className="flex flex-wrap gap-2">
            {TEXT_SIZE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => patchTypography({ preset: preset.value })}
                aria-pressed={(selectedTypography?.preset ?? 'standard') === preset.value}
                className={cx(
                  'rounded-lg border px-3 py-1.5 text-sm transition-colors duration-[var(--motion-micro)]',
                  (selectedTypography?.preset ?? 'standard') === preset.value
                    ? 'border-app-accent bg-app-surface-2 font-medium text-app-text shadow-[var(--shadow-sheet)]'
                    : 'border-app-border text-app-text-muted hover:border-app-text-muted'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 text-xs text-app-text-muted">
            Body font
            <select
              value={selectedTypography?.bodyFont ?? ''}
              onChange={(e) => patchTypography({ bodyFont: (e.target.value || undefined) as 'serif' | 'sans' | undefined })}
              className="rounded border border-app-border bg-app-surface-1 px-2 py-1 text-sm text-app-text"
            >
              <option value="">Theme default</option>
              {FONT_ROLE_LABELS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-app-text-muted">
            Heading font
            <select
              value={selectedTypography?.headingFont ?? ''}
              onChange={(e) => patchTypography({ headingFont: (e.target.value || undefined) as 'serif' | 'sans' | undefined })}
              className="rounded border border-app-border bg-app-surface-1 px-2 py-1 text-sm text-app-text"
            >
              <option value="">Theme default</option>
              {FONT_ROLE_LABELS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {selectedTypography && (
          <button
            onClick={() => onTypographyChange(null)}
            className="w-fit text-sm text-app-text-muted underline hover:text-app-text"
          >
            Reset to theme default
          </button>
        )}
      </div>

      {/* Accent (MINI_DR_PER_THEME_ACCENT): the one theme value an author can tune. Colour-only,
          so the Proof re-inks with no page shift. */}
      <div className="flex flex-col gap-3 px-8 py-6">
        <h3 className="text-lg font-semibold text-app-text">Accent</h3>
        <p className="text-xs text-app-text-muted">
          Recolours headings and titles over your chosen theme. You&apos;ll see it in the Proof.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="color"
            aria-label="Accent colour"
            value={selectedAccent ?? '#000000'}
            onChange={(event) => onAccentChange(event.target.value)}
            className="h-9 w-14 cursor-pointer rounded border border-app-border bg-transparent"
          />
          <span className="text-sm tabular-nums text-app-text-muted">{selectedAccent ?? 'Theme default'}</span>
          {selectedAccent && (
            <button
              onClick={() => onAccentChange(null)}
              className="text-sm text-app-text-muted underline hover:text-app-text"
            >
              Reset to theme default
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
