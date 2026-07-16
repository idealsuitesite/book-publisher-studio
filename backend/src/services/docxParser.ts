import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';

const require = createRequire(import.meta.url);
const mammoth = require('mammoth');

interface ExtractedContent {
  title: string;
  paragraphs: Array<{
    text: string;
    style?: string;
  }>;
  images: Array<{
    id: string;
    base64: string;
    type: string;
  }>;
}

/**
 * @deprecated Used only by the legacy POST /api/upload route. Superseded by
 * MammothParser + HtmlNormalizer + ASTBuilder (the Book AST pipeline). Scheduled
 * for removal alongside /api/upload in Sprint 3 — see ADR-0011 in docs/DECISIONS.md.
 */
export async function parseDocxFile(filePath: string): Promise<ExtractedContent> {
  try {
    // Read file as buffer FIRST, before deleting
    const buffer = fs.readFileSync(filePath);

    // Convert to HTML using buffer directly
    const result = await mammoth.convertToHtml({ buffer });
    const html = result.value;

    // Simple paragraph extraction (split by <p> tags)
    const paragraphs: Array<{ text: string; style?: string }> = [];
    const paragraphRegex = /<p[^>]*>(.*?)<\/p>/g;
    let match;

    while ((match = paragraphRegex.exec(html)) !== null) {
      const text = match[1]
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();

      if (text.length > 0) {
        paragraphs.push({ text });
      }
    }

    const extractedContent: ExtractedContent = {
      title: path.parse(filePath).name,
      paragraphs,
      images: [], // Images for later
    };

    return extractedContent;
  } catch (error: any) {
    const wrapped = new Error(`Failed to parse DOCX: ${error.message}`) as Error & {
      cause?: unknown;
    };
    wrapped.cause = error;
    throw wrapped;
  }
}
