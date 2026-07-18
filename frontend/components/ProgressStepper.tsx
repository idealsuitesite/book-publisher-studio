// Sprint 7 commit 11 - a real checklist of where the user is in the flow, not a fake fixed
// progress bar. Every step's "done" state is derived from real UploadDropzone state (a real
// import response, a real selection, a real generated preview, a real completed download) -
// never assumed complete just because a panel is visible.
interface Step {
  label: string;
  done: boolean;
}

interface ProgressStepperProps {
  steps: Step[];
}

export function ProgressStepper({ steps }: ProgressStepperProps) {
  return (
    <div className="flex w-full max-w-2xl flex-wrap items-center gap-x-1.5 gap-y-2 rounded-2xl border-2 border-zinc-300 px-6 py-4 text-sm dark:border-zinc-700">
      {steps.map((step, index) => (
        <span key={step.label} className="flex items-center gap-1.5">
          <span
            className={`transition-colors duration-300 ${
              step.done ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-600'
            }`}
          >
            {step.done ? '✓' : '○'}
          </span>
          <span
            className={`transition-colors duration-300 ${
              step.done ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-400 dark:text-zinc-600'
            }`}
          >
            {step.label}
          </span>
          {index < steps.length - 1 && <span className="mx-1 text-zinc-300 dark:text-zinc-700">→</span>}
        </span>
      ))}
    </div>
  );
}
