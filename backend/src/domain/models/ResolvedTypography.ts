export interface TypeRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  superscript: boolean;
  subscript: boolean;
  smallCaps: boolean;
  linkUrl?: string;
}

export interface ResolvedTypography {
  runs: TypeRun[];
  dropCap: boolean;
  orphanRisk: boolean;
}
