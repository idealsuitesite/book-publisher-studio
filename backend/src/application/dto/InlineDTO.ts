export interface InlineDTO {
  type:
    | 'text'
    | 'bold'
    | 'italic'
    | 'underline'
    | 'strikethrough'
    | 'link'
    | 'small-caps'
    | 'superscript'
    | 'subscript';
  text: string;
  url?: string;
}
