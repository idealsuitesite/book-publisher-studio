import type { LayoutOptionDTO, ManuscriptOptionsDTO } from 'shared-types';
import { Card } from '@/components/ui';

// Sprint 7 commit 8 - real format/layout selector, populated from GET /api/manuscripts/options
// (fetched once by UploadDropzone). Selection is held in the parent's state, ready for commit
// 9's export/preview call - no request fires from this component itself. Deliberately no page
// estimate here (that needs a real LayoutEngine.paginate() run, which only happens inside the
// export pipeline - commit 9's job, not fabricated here).
interface FormatSelectorProps {
  options: ManuscriptOptionsDTO;
  selectedLayout: string;
  selectedTheme: string;
  onLayoutChange: (name: string) => void;
  onThemeChange: (name: string) => void;
}

const CATEGORY_LABELS: Record<LayoutOptionDTO['category'], string> = {
  standard: 'Standard',
  kdp: 'Amazon KDP',
};

function RadioCard({
  name,
  label,
  sublabel,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors ${
        checked
          ? 'border-app-accent bg-app-surface-2'
          : 'border-app-border hover:border-app-text-muted'
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 accent-app-accent"
      />
      <span className="flex flex-col">
        <span className="text-sm font-medium text-app-text">{label}</span>
        {sublabel && <span className="text-xs text-app-text-muted">{sublabel}</span>}
      </span>
    </label>
  );
}

export function FormatSelector({ options, selectedLayout, selectedTheme, onLayoutChange, onThemeChange }: FormatSelectorProps) {
  const categories = Array.from(new Set(options.layouts.map((layout) => layout.category)));

  return (
    <Card className="flex max-w-2xl flex-col divide-y divide-app-border text-left">
      <div className="flex flex-col gap-3 px-8 py-6">
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
                  <RadioCard
                    key={layout.name}
                    name="layout"
                    label={layout.label}
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
            <RadioCard
              key={theme.name}
              name="theme"
              label={theme.label}
              checked={selectedTheme === theme.name}
              onChange={() => onThemeChange(theme.name)}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}
