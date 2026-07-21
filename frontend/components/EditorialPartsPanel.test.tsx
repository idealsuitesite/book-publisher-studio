import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditorialPartsPanel } from './EditorialPartsPanel';
import type { DetectedEditorialPart } from '@/lib/editorialParts';

/**
 * The Proof's editorial-control panel (MINI_DR_EDITORIAL_PARTS): present parts show their REAL
 * detected title (ADR-0049 honesty — the author sees what was detected and from which title),
 * absent parts read as "—", and every recognised category is listed so present/absent is answerable.
 */
describe('EditorialPartsPanel', () => {
  it('shows detected parts as present with their real titles, undetected as absent', () => {
    const parts: DetectedEditorialPart[] = [
      { key: 'introduction', label: 'Introduction', placement: 'front', detectedTitle: 'INTRODUCTION' },
      { key: 'conclusion', label: 'Conclusion', placement: 'back', detectedTitle: 'Conclusion: Nothing but Faith' },
    ];
    render(<EditorialPartsPanel editorialParts={parts} />);

    expect(screen.getByText('2 present')).toBeInTheDocument();
    // The honest evidence: the real manuscript title each detection came from.
    expect(screen.getByText('“INTRODUCTION”')).toBeInTheDocument();
    expect(screen.getByText('“Conclusion: Nothing but Faith”')).toBeInTheDocument();
    // Bibliography is absent on this book — the CTO's "present or not" answered for it.
    expect(screen.getByText('Bibliography')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('lists every recognised category even with nothing detected', () => {
    render(<EditorialPartsPanel editorialParts={[]} />);
    expect(screen.getByText('0 present')).toBeInTheDocument();
    expect(screen.getByText('Preface')).toBeInTheDocument();
    expect(screen.getByText('Bibliography')).toBeInTheDocument();
    expect(screen.getByText('Front matter')).toBeInTheDocument();
    expect(screen.getByText('Back matter')).toBeInTheDocument();
  });
});
