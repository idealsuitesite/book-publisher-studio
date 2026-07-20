import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ProjectDTO } from 'shared-types';
import { StructureEditor } from './StructureEditor';

function project(overrides: Partial<ProjectDTO> = {}): ProjectDTO {
  const base = {
    id: 'p1',
    name: 'A Book',
    book: {
      metadata: { title: 'A Book', author: 'Jean' },
      mainContent: [
        {
          id: 'c1',
          type: 'chapter',
          number: 1,
          title: 'Intro',
          content: [{ type: 'paragraph', id: 'b1', text: 'one two three' }],
          sections: [
            { id: 's1', type: 'section', title: 'Background', content: [{ type: 'paragraph', id: 'b2', text: 'alpha beta' }] },
          ],
        },
        { id: 'c2', type: 'chapter', number: 2, title: 'Method', content: [], sections: [] },
      ],
    },
    report: { issues: [] },
    versions: [],
    publications: [],
    settings: { layoutName: 'letter', themeName: 'classic' },
    updatedAt: '2026-07-21T00:00:00.000Z',
  };
  return { ...base, ...overrides } as unknown as ProjectDTO;
}

describe('StructureEditor (read-only, phase 3 commit 3)', () => {
  it('lists chapters and their sections with real word counts', () => {
    render(<StructureEditor project={project()} />);

    expect(screen.getByText('Chapter 1: Intro')).toBeInTheDocument();
    expect(screen.getByText('Chapter 2: Method')).toBeInTheDocument();
    expect(screen.getByText('Background')).toBeInTheDocument();
    expect(screen.getByText('2 parts')).toBeInTheDocument();
    // Chapter 1 = its paragraph (3) + the section (2) = 5; the section itself = 2.
    expect(screen.getByText('5 words')).toBeInTheDocument();
    expect(screen.getByText('2 words')).toBeInTheDocument();
  });

  it('surfaces the ADR-0049 "0 chapters" banner when the report carries the finding', () => {
    const withFinding = project({
      report: {
        issues: [
          {
            code: 'UNSTRUCTURED_MANUSCRIPT',
            severity: 'ERROR',
            message: 'No chapters were detected in a book-length manuscript',
            suggestion: 'Apply Heading 1 styles to your chapter titles',
          },
        ],
      },
    } as unknown as Partial<ProjectDTO>);

    render(<StructureEditor project={withFinding} />);

    expect(screen.getByRole('alert')).toHaveTextContent('0 chapters detected — needs review');
    expect(screen.getByText(/No chapters were detected/)).toBeInTheDocument();
  });
});
