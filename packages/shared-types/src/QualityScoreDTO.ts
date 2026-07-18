export interface QualityScoreDTO {
  overall: number;
  categories: {
    structure: number;
    metadata: number;
    typography: number;
    accessibility: number;
  };
}
