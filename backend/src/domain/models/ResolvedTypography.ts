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
  // Block-level "keep with next" signal (currently: true for Heading blocks only).
  // Named for the business intent (this block should not be left alone at a page
  // break) rather than "orphanRisk" - LayoutEngine never splits a block mid-content,
  // so a line-level widow/orphan cannot occur under this pagination model; this flag
  // is deliberately not named to suggest that finer-grained control exists yet.
  staysWithNext: boolean;
}
