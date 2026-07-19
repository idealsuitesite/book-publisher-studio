/**
 * The severity vocabulary shared by Alert and Badge.
 *
 * These four are not invented: they are the severities the product already produces —
 * ValidationSummary renders ERROR/WARNING/INFO/SUGGESTION from the backend's
 * ValidationIssueDTO, and PublishingReport produces ERROR/WARNING. One vocabulary serves
 * both, and it maps onto the four AppTheme severity tokens defined at Commit 1.
 *
 * Deliberately UI-only: these are visual tones, not domain concepts. This file must never
 * import a DTO or map backend severities itself — that translation belongs to whichever
 * feature component consumes it, keeping ui/ free of domain knowledge (ADR-0037's rule in
 * frontend form).
 */
export type Severity = 'error' | 'warning' | 'info' | 'success';

export const SEVERITY_TEXT: Record<Severity, string> = {
  error: 'text-app-error',
  warning: 'text-app-warning',
  info: 'text-app-info',
  success: 'text-app-success',
};

export const SEVERITY_BORDER: Record<Severity, string> = {
  error: 'border-app-error',
  warning: 'border-app-warning',
  info: 'border-app-info',
  success: 'border-app-success',
};
