import { createRequire } from 'module';
import type { DocumentParser, ParsedDocument } from '../../domain/ports/DocumentParser';
import { DocumentParseError } from '../../shared/errors/DocumentParseError';

const require = createRequire(import.meta.url);
const mammoth = require('mammoth');

export class MammothParser implements DocumentParser {
  async parse(buffer: Buffer): Promise<ParsedDocument> {
    try {
      const result = await mammoth.convertToHtml({ buffer });
      return { html: result.value };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DocumentParseError(`Failed to parse DOCX: ${message}`);
    }
  }
}
