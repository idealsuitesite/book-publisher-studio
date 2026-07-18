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
});
