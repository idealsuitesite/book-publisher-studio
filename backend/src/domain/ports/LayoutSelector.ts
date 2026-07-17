import type { PageLayout } from '../models/PageLayout';

export interface LayoutSelectionCriteria {
  requestedLayoutName?: string; // today's only real input - mirrors getTheme()'s name lookup
}

export interface LayoutSelector {
  select(criteria: LayoutSelectionCriteria): PageLayout;
}
