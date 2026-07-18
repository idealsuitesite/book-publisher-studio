import type { LayoutOptionDTO, ManuscriptOptionsDTO } from 'shared-types';

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
          ? 'border-zinc-900 bg-zinc-100 dark:border-zinc-50 dark:bg-zinc-900'
          : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 accent-zinc-900 dark:accent-zinc-50"
      />
      <span className="flex flex-col">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{label}</span>
        {sublabel && <span className="text-xs text-zinc-500 dark:text-zinc-400">{sublabel}</span>}
      </span>
    </label>
  );
}

export function FormatSelector({ options, selectedLayout, selectedTheme, onLayoutChange, onThemeChange }: FormatSelectorProps) {
  const categories = Array.from(new Set(options.layouts.map((layout) => layout.category)));

  return (
    <div className="flex w-full max-w-2xl flex-col divide-y divide-zinc-200 rounded-2xl border-2 border-zinc-300 text-left dark:divide-zinc-800 dark:border-zinc-700">
      <div className="flex flex-col gap-3 px-8 py-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Layout</h3>
        {categories.map((category) => (
          <div key={category} className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
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
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Theme</h3>
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
    </div>
  );
}
