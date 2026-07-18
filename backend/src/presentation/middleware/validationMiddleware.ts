import multer from 'multer';

const ALLOWED_EXTENSION = '.docx';
const ALLOWED_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export const uploadManuscript = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
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
