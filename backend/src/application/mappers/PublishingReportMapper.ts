import type { PublishingReport, PublishingIssue } from '../../domain/models/PublishingReport';
import type { PublishingResponseDTO, PublishingIssueDTO } from '../dto/PublishingResponseDTO';

function toIssueDTO(issue: PublishingIssue): PublishingIssueDTO {
  return { code: issue.code, message: issue.message, severity: issue.severity };
}

// The only place a Domain PublishingReport becomes a transport DTO - Presentation-layer
// concern, per this project's non-negotiable "DTOs and Mappers only across the Presentation
// boundary" rule. PublishingUseCase/KDPTarget never see PublishingResponseDTO.
export class PublishingReportMapper {
  map(report: PublishingReport): PublishingResponseDTO {
    return {
      target: report.target,
      status: report.status,
      summary: report.summary,
      issues: report.issues.map(toIssueDTO),
      warnings: report.warnings,
      artifacts: report.artifacts,
      generatedAt: report.generatedAt.toISOString(),
      duration: report.duration,
    };
  }
}
