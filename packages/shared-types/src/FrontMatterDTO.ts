/**
 * The RENDERED front-matter sections, and only those (MINI_DR_EDIT_FRONT_MATTER §2.1): every
 * export renders the title page and the copyright page; the other Domain `FrontMatter` fields
 * (dedication, preface, foreword, introduction, acknowledgments) have been typed-but-unrendered
 * since Sprint 1 and are deliberately NOT carried — a DTO field the UI could edit but no export
 * shows would be a lie. `publisherLogo` (an embedded Image) is likewise not carried: nothing can
 * populate it today and this path edits text.
 */
export interface TitlePageDTO {
  title: string;
  subtitle?: string;
  author: string;
  tagline?: string;
}

export interface CopyrightPageDTO {
  text: string;
  isbn?: string;
  copyrightText?: string;
  legalNotice?: string;
  printingInfo?: string;
}

export interface FrontMatterDTO {
  titlePage?: TitlePageDTO;
  copyrightPage?: CopyrightPageDTO;
}
