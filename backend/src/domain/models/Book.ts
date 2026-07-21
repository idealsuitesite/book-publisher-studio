/**
 * Book Domain Model
 *
 * This is the core domain model for the publishing system.
 * It represents a complete book with all its content, metadata, and structure.
 *
 * This model is IMMUTABLE - transformations return new instances.
 * This model is SERIALIZABLE - can be saved/loaded to JSON.
 * This model is FORMAT-AGNOSTIC - supports any export format.
 *
 * @see Architecture documentation for design rationale
 */

// ============================================================================
// ROOT BOOK MODEL
// ============================================================================

export interface Book {
  id: string;
  metadata: BookMetadata;
  frontMatter: FrontMatter;
  mainContent: Content[];
  backMatter: BackMatter;

  // Computed properties (read-only, calculated on-the-fly)
  wordCount?: number;
  pageCount?: number;
  readingTime?: number; // in minutes

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  version: number; // For tracking changes
}

// ============================================================================
// METADATA
// ============================================================================

export interface BookMetadata {
  title: string;
  subtitle?: string;
  author: string;
  publisher?: string;
  isbn?: string;
  issn?: string;
  language: string; // ISO 639-1 (e.g., "en", "fr")

  // Cover & Marketing
  coverImage?: Image;
  description?: string;
  keywords?: string[];

  // Copyright & Legal
  copyright?: string;
  license?: string; // e.g., "CC-BY-4.0"
  licenseUrl?: string;

  // Publishing Info
  edition?: string;
  publicationDate?: Date;
  rights?: string;

  // Contact
  authorEmail?: string;
  authorWebsite?: string;
  publisherWebsite?: string;
}

// ============================================================================
// FRONT MATTER
// ============================================================================

export interface FrontMatter {
  cover?: Image;
  titlePage?: TitlePage;
  copyrightPage?: CopyrightPage;
  dedication?: Block;
  toc?: TableOfContents;
  preface?: Section;
  foreword?: Section;
  introduction?: Section;
  acknowledgments?: Block;
}

export interface TitlePage {
  title: string;
  subtitle?: string;
  author: string;
  publisherLogo?: Image;
  tagline?: string;
}

export interface CopyrightPage {
  text: string;
  isbn?: string;
  copyrightText?: string;
  legalNotice?: string;
  printingInfo?: string;
}

// ============================================================================
// MAIN CONTENT
// ============================================================================

export type Content = Chapter | Section;

/**
 * Editorial placement of a top-level part (MINI_DR_EDITORIAL_PLACEMENT, §2b). A part tagged 'front'
 * exports before chapter 1, 'back' after the last chapter; absent means ordinary main content.
 * The tag is set only by an author action (Option C — never auto-inferred into the export). It is
 * consumed at render time by `orderByRole` in the shared tail; the STORED order is unchanged.
 * Positional only — a tagged part still renders as its own `Block[]`, never as structured
 * bibliography/glossary/index entries (that boundary is out of scope, MINI_DR_EDITORIAL_PLACEMENT §2).
 */
export type PartRole = 'front' | 'back';

export interface Chapter {
  type: 'chapter';
  id: string;
  number: number;
  title: string;
  subtitle?: string;
  content: Block[];
  sections?: Section[];
  role?: PartRole;

  /**
   * Marks this chapter as a PART OPENER — a "Part I / Part II" divider page
   * (PART_LEVEL_STRUCTURE, Shape B): a titled, blockless top-level entry grouping the chapters
   * that FOLLOW it, by position — no `Part` node in the `Content` union (the `role?`/flat-TOC
   * precedents; a walker that had to handle a third union case would recreate Shape A's cost by
   * the back door). An opener never consumes a chapter number (`renumberChapters` skips it) and
   * never counts as a chapter on any surface (`bookFacts`). Its page is charged by the
   * `ownsBarePage` branch (LayoutEngine) and consumed as a planned break (PDFRenderer's
   * startKey). Set only by an author action in the studio — nothing in a DOCX marks a Part, so
   * there is no import detection (`HEURISTIC_STRUCTURE_DETECTION`'s closure).
   */
  partOpener?: true;

  // Print formatting
  openingPageStyle?: 'right' | 'left' | 'any';
  startPageNumber?: number;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface Section {
  type: 'section';
  id: string;
  title: string;
  content: Block[];
  subsections?: Section[];
  role?: PartRole;

  // Hierarchy
  level: number; // 1-6 for h1-h6

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// BLOCKS (Core Content Elements)
// ============================================================================

export type Block =
  Heading | Paragraph | Quote | Scripture | Image | Table | List | Footnote | PageBreak | Divider;

// --- Heading ---
export interface Heading {
  type: 'heading';
  id: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  inlines?: InlineElement[];
}

// --- Paragraph ---
export interface Paragraph {
  type: 'paragraph';
  id: string;
  text: string;
  inlines?: InlineElement[];

  // Formatting
  style?: 'normal' | 'first' | 'hanging';
  dropCap?: boolean;
  align?: 'left' | 'center' | 'right' | 'justify';

  // Spacing (in points)
  spaceBefore?: number;
  spaceAfter?: number;
  lineHeight?: number;

  // Keep rules
  keepWithNext?: boolean;
  keepLinesTogether?: boolean;
}

// --- Quote ---
export interface Quote {
  type: 'quote';
  id: string;
  text: string;
  inlines?: InlineElement[];
  attribution?: string;
  quoteType?: 'block' | 'pullquote' | 'epigraph';

  // Styling
  align?: 'left' | 'center' | 'right';
}

// --- Scripture ---
export interface Scripture {
  type: 'scripture';
  id: string;
  text: string;
  inlines?: InlineElement[];

  // Reference info
  reference?: {
    book: string;
    chapter: number;
    verses: string; // "3:16" or "3:16-20"
  };

  translation?: string; // "KJV", "NIV", "ESV", etc.
  formatType?: 'superscript' | 'inline' | 'footnote';
}

// --- Image ---
export interface Image {
  type: 'image';
  id: string;
  url: string;
  base64?: string; // For embedded images

  // Metadata
  caption?: string;
  alt?: string;
  copyright?: string;

  // Dimensions (in pixels or inches)
  width?: number;
  height?: number;

  // Print
  dpi?: number; // 72 for screen, 300+ for print
  printWidth?: number; // in inches
  printHeight?: number;

  // Positioning
  alignment?: 'left' | 'center' | 'right';
  wrapping?: 'none' | 'square' | 'tight';
}

// --- Table ---
export interface Table {
  type: 'table';
  id: string;

  // Content
  headers: string[];
  rows: (string | null)[][];

  // Metadata
  caption?: string;

  // Styling
  striped?: boolean;
  bordered?: boolean;
  align?: 'left' | 'center' | 'right';

  // Column widths (percentage or points)
  columnWidths?: number[];
}

// --- List ---
export interface List {
  type: 'list';
  id: string;

  // Content
  ordered: boolean; // true = numbered, false = bulleted
  items: string[];
  inlines?: InlineElement[][]; // For each item

  // Styling
  depth?: number; // For nested lists
  startNumber?: number; // For ordered lists
  bulletStyle?: 'disc' | 'circle' | 'square';
}

// --- Footnote ---
export interface Footnote {
  type: 'footnote';
  id: string;
  number: number;
  content: string;
  inlines?: InlineElement[];
}

// --- Page Break ---
export interface PageBreak {
  type: 'page-break';
  id: string;
  style?: 'right' | 'left' | 'any';
}

// --- Divider ---
export interface Divider {
  type: 'divider';
  id: string;
  style?: 'line' | 'space' | 'asterisks';
}

// ============================================================================
// INLINE ELEMENTS (Text formatting)
// ============================================================================

export type InlineElement =
  | BoldText
  | ItalicText
  | UnderlineText
  | StrikethroughText
  | Link
  | SmallCaps
  | Superscript
  | Subscript
  | PlainText;

export interface PlainText {
  type: 'text';
  text: string;
}

export interface BoldText {
  type: 'bold';
  text: string;
}

export interface ItalicText {
  type: 'italic';
  text: string;
}

export interface UnderlineText {
  type: 'underline';
  text: string;
}

export interface StrikethroughText {
  type: 'strikethrough';
  text: string;
}

export interface Link {
  type: 'link';
  text: string;
  url: string;
  target?: '_blank' | '_self';
}

export interface SmallCaps {
  type: 'small-caps';
  text: string;
}

export interface Superscript {
  type: 'superscript';
  text: string;
}

export interface Subscript {
  type: 'subscript';
  text: string;
}

// ============================================================================
// BACK MATTER
// ============================================================================

export interface BackMatter {
  appendices?: Section[];
  bibliography?: Bibliography;
  glossary?: GlossaryTerm[];
  index?: IndexEntry[];
  colophon?: Block;
}

// --- Bibliography ---
export interface Bibliography {
  title?: string;
  entries: BibEntry[];
}

export interface BibEntry {
  id: string;
  author: string;
  title: string;
  publisher?: string;
  year?: number;
  url?: string;
  doi?: string;
  isbn?: string;
  type?: 'book' | 'article' | 'website' | 'paper';
}

// --- Glossary ---
export interface GlossaryTerm {
  term: string;
  definition: string;
  seeAlso?: string[];
}

// --- Index ---
export interface IndexEntry {
  term: string;
  pageNumbers: number[];
  subentries?: IndexEntry[];
}

// ============================================================================
// TABLE OF CONTENTS
// ============================================================================

export interface TableOfContents {
  entries: TOCEntry[];
  generateAutomatically: boolean;
  maxDepth?: number; // How many heading levels to include
}

export interface TOCEntry {
  level: number; // 1-6
  title: string;
  pageNumber?: number;
  // Links back to a Heading.id when a literal Heading block exists, or a Chapter/Section's own
  // id otherwise (LayoutEngine.buildTableOfContents, Sprint 6: real DOCX imports structurally
  // consume every heading into a Chapter/Section boundary, never a content-level Heading block -
  // confirmed against a real fixture, not assumed).
  headingId: string;
  children?: TOCEntry[];
}

// ============================================================================
// VALIDATION & UTILITIES
// ============================================================================

/**
 * Validation result from validators
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  location: string; // "Chapter 3, Paragraph 5"
  suggestion?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  location: string;
  severity?: 'info' | 'warning';
}

// ============================================================================
// QUALITY METRICS (Computed)
// ============================================================================

export interface QualityMetrics {
  wordCount: number;
  paragraphCount: number;
  headingCount: number;
  imageCount: number;
  tableCount: number;
  footnoteCount: number;

  averageParagraphLength: number;
  averageChapterLength: number;

  readingTimeMinutes: number;
  estimatedPageCount: number;

  // Typography issues
  widowsAndOrphans: number;
  // Functional definition is intentionally general - "blocks whose explicit style
  // overrides a theme-resolved value" - so future style dimensions (alignment,
  // indentation, color, font) can be folded in later without renaming or
  // resemanticizing this field. Sprint 4's BookMetricsCalculator implementation
  // checks spacing overrides only (spaceBefore/spaceAfter/lineHeight).
  inconsistentSpacing: number;
  emptyHeadings: number;

  // Added Sprint 4 (Typography Engine, commit 9) - functional definitions locked
  // in the Design Review (docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md, CTO Final
  // Decision 4). Populated by BookMetricsCalculator.calculateQualityMetrics().
  averageHeadingDepth: number; // mean of Heading.level across all Heading blocks (1-6); 0 if none
  paragraphDensity: number; // Paragraph block count / PaginatedBook.pages.length
  lineDensity: number; // estimated total lines across all Paragraph blocks (LayoutEngine's WORDS_PER_LINE heuristic) / Paragraph block count
  dropCaps: number; // count of blocks where TypographyResolver resolved dropCap: true
}

// ============================================================================
// VALIDATION ENGINE (Sprint 5, additive)
//
// See docs/architecture/diagrams/VALIDATION_ENGINE.md for the full design and
// ADR-0027 for the read-only constraint every ValidationRule must honor.
// ============================================================================

/**
 * Four levels, not the binary ValidationError/ValidationWarning split above -
 * ValidationReport.errors/.warnings (below) are derived views over
 * ValidationIssue[] for backward compatibility with existing ValidationResult
 * consumers, not a second independent source of truth.
 */
export type ValidationSeverity = 'ERROR' | 'WARNING' | 'INFO' | 'SUGGESTION';

export interface ValidationIssue {
  code: string;
  message: string;
  location: string;
  severity: ValidationSeverity;
  suggestion?: string;
}

export interface QualityScore {
  overall: number; // 0-100
  categories: {
    structure: number;
    metadata: number;
    typography: number;
    accessibility: number;
  };
}

/**
 * ValidationEngine.validate()'s return type. Extends ValidationResult so every
 * existing ValidationResult consumer (ImportManuscriptUseCase) keeps working
 * unchanged - errors/warnings are computed from `issues` by severity filter,
 * not populated independently (see ValidationEngine.ts).
 */
export interface ValidationReport extends ValidationResult {
  issues: ValidationIssue[];
  score: QualityScore;
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Factory function to create a new Book
 */
export function createBook(metadata: BookMetadata, mainContent: Content[] = []): Book {
  return {
    id: generateId(),
    metadata,
    frontMatter: {},
    mainContent,
    backMatter: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  };
}

/**
 * Utility to generate unique IDs
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Type guard functions
 */
export function isChapter(content: Content): content is Chapter {
  return content.type === 'chapter';
}

export function isSection(content: Content): content is Section {
  return content.type === 'section';
}

export function isHeading(block: Block): block is Heading {
  return block.type === 'heading';
}

export function isParagraph(block: Block): block is Paragraph {
  return block.type === 'paragraph';
}

export function isImage(block: Block): block is Image {
  return block.type === 'image';
}
