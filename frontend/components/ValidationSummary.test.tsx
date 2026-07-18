import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ImportReportDTO } from 'shared-types';
import { ValidationSummary } from './ValidationSummary';

function report(overrides: Partial<ImportReportDTO> = {}): ImportReportDTO {
  return {
    status: 'success',
    statistics: { chapters: 15, images: 0, tables: 0, words: 12030 },
    warnings: [],
    errors: [],
    issues: [],
    score: {
      overall: 85,
      categories: { structure: 100, metadata: 55, typography: 90, accessibility: 95 },
    },
    ...overrides,
  } as ImportReportDTO;
}

const issue = (severity: string, code: string, message: string) =>
  ({ code, message, location: 'metadata', severity }) as never;

describe('ValidationSummary', () => {
  it('shows the real overall score', () => {
    render(<ValidationSummary report={report()} />);
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('renders every score category with its real value', () => {
    render(<ValidationSummary report={report()} />);
    expect(screen.getByText('Metadata')).toBeInTheDocument();
    expect(screen.getByText('55')).toBeInTheDocument();
  });

  it('uses readable severity labels rather than shouting the raw enum', () => {
    render(
      <ValidationSummary
        report={report({ issues: [issue('ERROR', 'MISSING_TITLE', 'Book title is not set')] })}
      />
    );
    expect(screen.getByText(/Critical/)).toBeInTheDocument();
    expect(screen.queryByText('ERROR')).not.toBeInTheDocument();
  });

  it('shows each real finding message', () => {
    render(
      <ValidationSummary
        report={report({ issues: [issue('WARNING', 'MISSING_ISBN', 'Book ISBN is not set')] })}
      />
    );
    expect(screen.getByText(/Book ISBN is not set/)).toBeInTheDocument();
  });

  it('groups findings by severity', () => {
    render(
      <ValidationSummary
        report={report({
          issues: [
            issue('ERROR', 'A', 'an error'),
            issue('WARNING', 'B', 'a warning'),
            issue('INFO', 'C', 'a note'),
          ],
        })}
      />
    );
    expect(screen.getByText(/Critical/)).toBeInTheDocument();
    expect(screen.getByText(/Warning/)).toBeInTheDocument();
    expect(screen.getByText(/Information/)).toBeInTheDocument();
  });

  it('handles a clean report with no findings at all', () => {
    render(<ValidationSummary report={report({ issues: [] })} />);
    expect(screen.queryByText(/Critical/)).not.toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
  });
});
