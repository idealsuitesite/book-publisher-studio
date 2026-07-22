import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FrontMatterEditor } from './FrontMatterEditor';
import type { FrontMatterDTO } from 'shared-types';

const frontMatter: FrontMatterDTO = {
  titlePage: { title: 'Faith Alone', author: 'Ruan Carlos', subtitle: 'An Essay' },
  copyrightPage: { text: '© 2026 Ruan Carlos', isbn: '978-1-4028-9462-6' },
};

describe('FrontMatterEditor (Phase 3b)', () => {
  it('seeds the form from the stored sections and shows presence in the summary', () => {
    render(<FrontMatterEditor frontMatter={frontMatter} disabled={false} onApply={() => {}} />);

    expect(screen.getByText(/title page · copyright page/)).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Faith Alone');
    expect(screen.getByLabelText('Author')).toHaveValue('Ruan Carlos');
    expect(screen.getByLabelText('Copyright line')).toHaveValue('© 2026 Ruan Carlos');
    expect(screen.getByLabelText('ISBN')).toHaveValue('978-1-4028-9462-6');
  });

  it('Save submits the WHOLE section — fields the author did not touch are carried, not wiped', async () => {
    const onApply = vi.fn();
    render(<FrontMatterEditor frontMatter={frontMatter} disabled={false} onApply={onApply} />);

    await userEvent.clear(screen.getByLabelText('Title'));
    await userEvent.type(screen.getByLabelText('Title'), 'A Better Title');
    await userEvent.click(screen.getByRole('button', { name: 'Save title page' }));

    expect(onApply).toHaveBeenCalledWith({
      titlePage: { title: 'A Better Title', subtitle: 'An Essay', author: 'Ruan Carlos', tagline: '' },
    });
  });

  it('Remove page submits null for that section only', async () => {
    const onApply = vi.fn();
    render(<FrontMatterEditor frontMatter={frontMatter} disabled={false} onApply={onApply} />);

    const copyrightSection = screen.getByRole('region', { name: 'Copyright page' });
    await userEvent.click(within(copyrightSection).getByRole('button', { name: 'Remove page' }));

    expect(onApply).toHaveBeenCalledWith({ copyrightPage: null });
  });

  it('Save title page is disabled while title or author is empty (mirrors the route/op rule)', async () => {
    render(<FrontMatterEditor frontMatter={frontMatter} disabled={false} onApply={() => {}} />);

    await userEvent.clear(screen.getByLabelText('Author'));
    expect(screen.getByRole('button', { name: 'Save title page' })).toBeDisabled();
  });

  it('with no stored sections the summary says so and Remove buttons are absent', () => {
    render(<FrontMatterEditor frontMatter={undefined} disabled={false} onApply={() => {}} />);

    expect(screen.getByText(/no title page · no copyright page/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove page' })).toBeNull();
  });
});
