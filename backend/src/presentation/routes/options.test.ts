import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

describe('GET /api/manuscripts/options', () => {
  const app = createApp();

  it('returns 200 with themes and layouts arrays', async () => {
    const response = await request(app).get('/api/manuscripts/options');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.themes)).toBe(true);
    expect(Array.isArray(response.body.layouts)).toBe(true);
  });

  it('includes the classic theme with a name and label', async () => {
    const response = await request(app).get('/api/manuscripts/options');

    expect(response.body.themes).toContainEqual({ name: 'classic', label: 'Classic' });
  });

  it('includes every Sprint 6 layout preset, each with a name/label/category', async () => {
    const response = await request(app).get('/api/manuscripts/options');

    const names = response.body.layouts.map((layout: { name: string }) => layout.name);
    expect(names).toEqual(expect.arrayContaining(['letter', 'a4', 'a5', 'kdp-5x8', 'kdp-5.5x8.5', 'kdp-6x9']));

    for (const layout of response.body.layouts) {
      expect(typeof layout.name).toBe('string');
      expect(typeof layout.label).toBe('string');
      expect(['standard', 'kdp']).toContain(layout.category);
    }
  });

  it('categorizes KDP trim sizes as kdp and Letter/A4/A5 as standard', async () => {
    const response = await request(app).get('/api/manuscripts/options');

    const byName = Object.fromEntries(
      response.body.layouts.map((layout: { name: string; category: string }) => [layout.name, layout.category])
    );

    expect(byName['letter']).toBe('standard');
    expect(byName['a4']).toBe('standard');
    expect(byName['a5']).toBe('standard');
    expect(byName['kdp-5x8']).toBe('kdp');
    expect(byName['kdp-5.5x8.5']).toBe('kdp');
    expect(byName['kdp-6x9']).toBe('kdp');
  });
});
