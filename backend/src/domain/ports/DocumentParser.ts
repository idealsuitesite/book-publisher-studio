export interface ParsedDocument {
  html: string;
}

export interface DocumentParser {
  parse(buffer: Buffer): Promise<ParsedDocument>;
}
