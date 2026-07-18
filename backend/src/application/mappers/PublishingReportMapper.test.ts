import { describe, it, expect } from 'vitest';
import { PublishingReportMapper } from './PublishingReportMapper';
import type { PublishingReport } from '../../domain/models/PublishingReport';

describe('PublishingReportMapper', () => {
  const mapper = new PublishingReportMapper();

  it('maps every field, including a real ISO-string generatedAt (not a Date object)', () => {
    const generatedAt = new Date('2026-07-18T12:00:00.000Z');
    const report: PublishingReport = {
      status: 'FAIL',
      target: 'kdp',
      issues: [{ code: 'MISSING_REQUIRED_METADATA', message: 'Required metadata field "isbn" is missing.', severity: 'ERROR' }],
      warnings: [],
      artifacts: ['pdf'],
      generatedAt,
      duration: 42,
      summary: 'FAIL - 1 error, 0 warnings',
    };

    const dto = mapper.map(report);

    expect(dto).toEqual({
      target: 'kdp',
      status: 'FAIL',
      summary: 'FAIL - 1 error, 0 warnings',
      issues: [{ code: 'MISSING_REQUIRED_METADATA', message: 'Required metadata field "isbn" is missing.', severity: 'ERROR' }],
      warnings: [],
      artifacts: ['pdf'],
      generatedAt: '2026-07-18T12:00:00.000Z',
      duration: 42,
    });
  });

  it('maps an empty issues/warnings/artifacts report unchanged in shape', () => {
    const report: PublishingReport = {
      status: 'PASS',
      target: 'kdp',
      issues: [],
      warnings: [],
      artifacts: [],
      generatedAt: new Date(),
      duration: 0,
      summary: 'PASS - 0 errors, 0 warnings',
    };

    const dto = mapper.map(report);

    expect(dto.issues).toEqual([]);
    expect(dto.warnings).toEqual([]);
    expect(dto.artifacts).toEqual([]);
  });
});
