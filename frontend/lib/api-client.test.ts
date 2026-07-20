import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  importManuscript,
  getManuscriptOptions,
  exportManuscript,
  editStructure,
  ApiError,
  RequestTimeoutError,
  NetworkError,
} from './api-client';

const docx = () =>
  new File(['x'], 'book.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const spy = vi.fn(impl);
  vi.stubGlobal('fetch', spy);
  return spy;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('importManuscript', () => {
  it('returns the parsed body on 200', async () => {
    mockFetch(() => json({ book: { id: 'b1' }, report: { status: 'success' } }));

    const result = await importManuscript(docx());

    expect(result.report.status).toBe('success');
  });

  it('returns the body on 422 too — the pipeline ran, the manuscript just has findings', async () => {
    mockFetch(() => json({ book: { id: 'b1' }, report: { status: 'error' } }, 422));

    const result = await importManuscript(docx());

    expect(result.report.status).toBe('error');
  });

  it('surfaces the server error message on a 400 rather than a bare status code', async () => {
    mockFetch(() => json({ error: 'Only DOCX files are allowed' }, 400));

    await expect(importManuscript(docx())).rejects.toThrow('Only DOCX files are allowed');
  });

  it('falls back to the status text when the error body is unreadable', async () => {
    mockFetch(() => new Response('not json', { status: 500, statusText: 'Internal Server Error' }));

    await expect(importManuscript(docx())).rejects.toThrow(/500/);
  });

  it('reports a timeout distinctly, so a hung server is not mistaken for a slow one', async () => {
    mockFetch(() => Promise.reject(new DOMException('The operation timed out', 'TimeoutError')));

    await expect(importManuscript(docx())).rejects.toBeInstanceOf(RequestTimeoutError);
  });

  it('reports an unreachable server distinctly, instead of a raw "Failed to fetch"', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));

    const error = await importManuscript(docx()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NetworkError);
    expect((error as Error).message).toContain('backend is running');
  });

  it('sends the file as multipart form data', async () => {
    const spy = mockFetch(() => json({ book: {}, report: { status: 'success' } }));

    await importManuscript(docx());

    const init = spy.mock.calls[0][1];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(FormData);
  });

  it('bounds the request rather than waiting forever', async () => {
    const spy = mockFetch(() => json({ book: {}, report: { status: 'success' } }));

    await importManuscript(docx());

    expect(spy.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('getManuscriptOptions', () => {
  it('returns the options payload', async () => {
    mockFetch(() => json({ themes: [{ name: 'classic', label: 'Classic' }], layouts: [] }));

    const options = await getManuscriptOptions();

    expect(options.themes).toHaveLength(1);
  });

  it('throws on a non-ok response', async () => {
    mockFetch(() => new Response('', { status: 503, statusText: 'Service Unavailable' }));

    await expect(getManuscriptOptions()).rejects.toThrow(/503/);
  });

  it('reports an unreachable server distinctly', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));

    await expect(getManuscriptOptions()).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('exportManuscript', () => {
  it('returns the rendered blob', async () => {
    mockFetch(() => new Response(new Blob(['%PDF-']), { status: 200 }));

    const blob = await exportManuscript({ file: docx(), format: 'pdf' });

    expect(blob).toBeInstanceOf(Blob);
  });

  it('sends format, theme and layout when provided', async () => {
    const spy = mockFetch(() => new Response(new Blob(['x'])));

    await exportManuscript({ file: docx(), format: 'pdf', theme: 'classic', layout: 'kdp-6x9' });

    const body = spy.mock.calls[0][1]?.body as FormData;
    expect(body.get('format')).toBe('pdf');
    expect(body.get('theme')).toBe('classic');
    expect(body.get('layout')).toBe('kdp-6x9');
  });

  it('omits optional fields rather than sending empty strings', async () => {
    const spy = mockFetch(() => new Response(new Blob(['x'])));

    await exportManuscript({ file: docx(), format: 'epub' });

    const body = spy.mock.calls[0][1]?.body as FormData;
    expect(body.get('theme')).toBeNull();
    expect(body.get('layout')).toBeNull();
  });

  it('surfaces the server error message on a 400 — an unknown layout is actionable', async () => {
    mockFetch(() => json({ error: 'Unknown page layout: nonexistent' }, 400));

    await expect(exportManuscript({ file: docx(), format: 'pdf', layout: 'nonexistent' })).rejects.toThrow(
      'Unknown page layout: nonexistent'
    );
  });

  it('reports a timeout distinctly — a large export must not look like a dead server', async () => {
    mockFetch(() => Promise.reject(new DOMException('timeout', 'TimeoutError')));

    const error = await exportManuscript({ file: docx(), format: 'pdf' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RequestTimeoutError);
    expect((error as Error).message).toMatch(/180s/);
  });
});

describe('editStructure', () => {
  it('POSTs the typed mutation to the project structure route and returns the fresh project', async () => {
    const spy = mockFetch(() => json({ id: 'p1', book: { mainContent: [] }, versions: [{ number: 1 }] }));

    const project = await editStructure('p1', { type: 'reorderChapters', fromIndex: 2, toIndex: 0 });

    const [url, init] = spy.mock.calls[0];
    expect(url).toBe('http://localhost:5000/api/projects/p1/structure');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ type: 'reorderChapters', fromIndex: 2, toIndex: 0 });
    expect(project.id).toBe('p1');
  });

  it('encodes the project id in the path', async () => {
    const spy = mockFetch(() => json({ id: 'a/b' }));

    await editStructure('a/b', { type: 'rename', id: 'c1', title: 'New' });

    expect(spy.mock.calls[0][0]).toBe('http://localhost:5000/api/projects/a%2Fb/structure');
  });

  it('throws a coded ApiError on a bad target so the editor can name it (CONTENT_NOT_FOUND)', async () => {
    mockFetch(() => json({ error: 'no chapter or section with id "ghost"', code: 'CONTENT_NOT_FOUND' }, 400));

    const error = await editStructure('p1', { type: 'rename', id: 'ghost', title: 'X' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('CONTENT_NOT_FOUND');
  });
});
