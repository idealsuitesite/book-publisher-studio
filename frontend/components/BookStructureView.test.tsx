import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BookDTO } from 'shared-types';
import { BookStructureView } from './BookStructureView';

function book(overrides: Partial<BookDTO> = {}): BookDTO {
  return {
    id: 'b1',
    metadata: { title: 'The Long Road', author: 'Jane Doe', language: 'en' },
    mainContent: [
      { type: 'chapter', id: 'c1', number: 1, title: 'Beginnings', content: [] },
      { type: 'chapter', id: 'c2', number: 2, title: 'Middles', content: [] },
    ],
    wordCount: 12030,
    pageCount: 41,
    readingTime: 61,
    ...overrides,
  } as BookDTO;
}

describe('BookStructureView', () => {
  it('shows the real title and author from the imported book', () => {
    render(<BookStructureView book={book()} filename="large-book.docx" onReset={() => {}} />);
    expect(screen.getByRole('heading', { name: 'The Long Road' })).toBeInTheDocument();
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
  });

  it('shows the source filename so the user knows which file this is', () => {
    render(<BookStructureView book={book()} filename="large-book.docx" onReset={() => {}} />);
    expect(screen.getByText(/large-book\.docx/)).toBeInTheDocument();
  });

  it('formats large word counts for readability rather than printing a raw number', () => {
    render(<BookStructureView book={book()} filename="x.docx" onReset={() => {}} />);
    expect(screen.getByText('12,030')).toBeInTheDocument();
  });

  it('lists chapters with their real numbers and titles', () => {
    render(<BookStructureView book={book()} filename="x.docx" onReset={() => {}} />);
    expect(screen.getByText('Chapter 1: Beginnings')).toBeInTheDocument();
    expect(screen.getByText('Chapter 2: Middles')).toBeInTheDocument();
  });

  it('omits a statistic entirely when the backend did not provide it', () => {
    render(
      <BookStructureView
        book={book({ wordCount: undefined, pageCount: undefined, readingTime: undefined })}
        filename="x.docx"
        onReset={() => {}}
      />
    );
    expect(screen.queryByText('Words')).not.toBeInTheDocument();
    expect(screen.queryByText('Pages')).not.toBeInTheDocument();
  });

  it('distinguishes a zero statistic from a missing one', () => {
    render(<BookStructureView book={book({ pageCount: 0 })} filename="x.docx" onReset={() => {}} />);
    expect(screen.getByText('Pages')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('lets the user start over, by keyboard as well as by mouse', async () => {
    const onReset = vi.fn();
    const user = userEvent.setup();
    render(<BookStructureView book={book()} filename="x.docx" onReset={onReset} />);

    await user.click(screen.getByRole('button', { name: 'Import another file' }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  // CTO decision (2026-07-18): the Import panel answers "what did I import?", never "show me
  // the whole book". Its height must not be proportional to the manuscript - a 500-page book
  // was burying Validation/Layout/Preview under its own table of contents.
  describe('structure disclosure', () => {
    it('collapses the structure by default, showing a count instead of the whole TOC', () => {
      render(<BookStructureView book={book()} filename="large-book.docx" onReset={() => {}} />);

      expect(screen.getByText('Structure — 2 parts')).toBeInTheDocument();
      expect(document.querySelector('details')?.open).toBe(false);
    });

    it('reveals the full structure on demand', async () => {
      const user = userEvent.setup();
      render(<BookStructureView book={book()} filename="large-book.docx" onReset={() => {}} />);

      await user.click(screen.getByText(/Structure — 2 parts/));

      expect(document.querySelector('details')?.open).toBe(true);
      expect(screen.getByText('Chapter 1: Beginnings')).toBeVisible();
    });

    it('caps the expanded list height so a huge book still cannot dominate the panel', () => {
      const many = Array.from({ length: 40 }, (_, i) => ({
        type: 'chapter' as const,
        id: `c-${i}`,
        number: i + 1,
        title: `Chapter ${i + 1}`,
        content: [],
      }));
      render(
        <BookStructureView book={book({ mainContent: many })} filename="big.docx" onReset={() => {}} />
      );

      expect(screen.getByText('Structure — 40 parts')).toBeInTheDocument();
      expect(document.querySelector('details ul')?.className).toContain('max-h-64');
      expect(document.querySelector('details ul')?.className).toContain('overflow-y-auto');
    });
  });
});
