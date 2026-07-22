import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ProjectSummaryDTO } from 'shared-types';
import Home from './page';

vi.mock('@/lib/api-client', () => ({
  listProjects: vi.fn(),
  importManuscript: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { listProjects } = await import('@/lib/api-client');

const summary = (id: string, name: string): ProjectSummaryDTO =>
  ({ id, name, bookTitle: name, author: 'A', versionCount: 0, publishedTargets: [], updatedAt: '2026-07-21T00:00:00.000Z' }) as unknown as ProjectSummaryDTO;

beforeEach(() => vi.mocked(listProjects).mockReset());

/**
 * MINI_DR_HOME_STATE_LAYOUT (Option D): the Home re-weights by library state, no new routes.
 * Empty → the upload IS the screen; non-empty → the library leads with a primary import BUTTON
 * (not the full drop form competing for the first screen).
 */
describe('Home — conditional layout by library state', () => {
  it('empty library: the upload is the screen — full dropzone, no import button', async () => {
    vi.mocked(listProjects).mockResolvedValue({ projects: [] });
    render(<Home />);

    expect(await screen.findByText(/Drop your DOCX here/)).toBeInTheDocument();
    expect(screen.getByText(/No projects yet/)).toBeInTheDocument();
    expect(screen.queryByText('Import a manuscript')).toBeNull(); // the button belongs to the non-empty state
  });

  it('non-empty library: the library leads with a primary import button, not the full dropzone', async () => {
    vi.mocked(listProjects).mockResolvedValue({ projects: [summary('p1', 'My Book')] });
    render(<Home />);

    expect(await screen.findByText('My Book')).toBeInTheDocument(); // the library grid leads
    expect(screen.getByText('Import a manuscript')).toBeInTheDocument(); // import stays evident (a real button)
    expect(screen.queryByText(/Drop your DOCX here/)).toBeNull(); // the full drop form no longer competes
  });

  // HOME_TIGHTEN_SCOPE Point B1: the last-worked-on project (projects[0] — the server already
  // orders updated_at DESC) is the hero; the rest keep the compact grid under "All projects".
  it('two+ projects: the first is the hero with the primary Continue; the rest sit under "All projects"', async () => {
    // updatedAt = now, so the recency assertion holds whatever day the suite runs.
    const latest = { ...summary('p1', 'Latest Book'), updatedAt: new Date().toISOString() } as ProjectSummaryDTO;
    vi.mocked(listProjects).mockResolvedValue({ projects: [latest, summary('p2', 'Older Book')] });
    render(<Home />);

    expect(await screen.findByText('Latest Book')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Continue' })).toHaveTextContent('Latest Book');
    expect(screen.getByText('Continue →')).toBeInTheDocument(); // the hero's primary action
    expect(screen.getByText('Worked on today')).toBeInTheDocument(); // humanised recency, real updatedAt
    const grid = screen.getByRole('region', { name: 'All projects' });
    expect(grid).toHaveTextContent('Older Book');
    expect(grid).not.toHaveTextContent('Latest Book'); // the hero project appears once, never twice
  });

  it('a single project: the hero IS the library — no "All projects" section, no duplicate card', async () => {
    vi.mocked(listProjects).mockResolvedValue({ projects: [summary('p1', 'Only Book')] });
    render(<Home />);

    expect(await screen.findByText('Only Book')).toBeInTheDocument();
    expect(screen.getByText('Continue →')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'All projects' })).toBeNull();
    expect(screen.getAllByText('Only Book')).toHaveLength(1);
  });

  // HOME_TIGHTEN_SCOPE Point A: the promise lives at first contact, the task on return — never
  // both on the same screen, so the pitch cannot become wallpaper for a returning author.
  it('the empty (first-contact) screen states the promise; the returning screen states the task', async () => {
    vi.mocked(listProjects).mockResolvedValue({ projects: [] });
    const { unmount } = render(<Home />);
    expect(await screen.findByText(/Import your manuscript — leave with a professional, publish-ready book/)).toBeInTheDocument();
    unmount();

    vi.mocked(listProjects).mockResolvedValue({ projects: [summary('p1', 'My Book')] });
    render(<Home />);
    expect(await screen.findByText(/Pick up your book where you left it/)).toBeInTheDocument();
    expect(screen.queryByText(/publish-ready book/)).toBeNull(); // no pitch on the returning screen
  });
});
