import multer from 'multer';

const ALLOWED_EXTENSION = '.docx';
const ALLOWED_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export const uploadManuscript = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  // Without this, busboy decodes multipart filenames as latin1 (its `defParamCharset` default
  // is undefined, which falls back to latin1). A file called
  // "Une recommandation supplémentaire.docx" arrived as "Une recommandation
  // supplÃ©mentaire.docx" - the UTF-8 bytes for é (0xC3 0xA9) read as two latin1 characters.
  //
  // That is data corruption, not a display quirk: the filename becomes the book title when a
  // DOCX carries no title of its own, so it reached the AST, every rendered PDF/DOCX/EPUB, and
  // the KDP publishing report. For software whose users are authors and publishers - who write
  // in French, Spanish, German, Arabic, Chinese - a pipeline that mangles accents at the front
  // door is not fit for purpose. Fixed at the boundary where the bytes are first decoded rather
  // than patched further downstream.
  defParamCharset: 'utf8',
  fileFilter: (_req, file, callback) => {
    // Both must match, not either. With `||`, any file claiming the DOCX mime type passed
    // regardless of its name, and any file merely named *.docx passed regardless of its type -
    // so the check rejected almost nothing. Neither signal is trustworthy alone (both are
    // client-supplied), but requiring agreement raises the bar meaningfully at no cost to
    // legitimate uploads. Real content validation still happens downstream: MammothParser
    // throws DocumentParseError on anything that is not a real DOCX.
    const isDocx =
      file.mimetype === ALLOWED_MIME_TYPE &&
      file.originalname.toLowerCase().endsWith(ALLOWED_EXTENSION);
    if (isDocx) {
      callback(null, true);
    } else {
      callback(new Error('Only DOCX files are allowed'));
    }
  },
}).single('file');
