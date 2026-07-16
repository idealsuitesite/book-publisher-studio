import multer from 'multer';

const ALLOWED_EXTENSION = '.docx';
const ALLOWED_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export const uploadManuscript = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    const isDocx =
      file.mimetype === ALLOWED_MIME_TYPE ||
      file.originalname.toLowerCase().endsWith(ALLOWED_EXTENSION);
    if (isDocx) {
      callback(null, true);
    } else {
      callback(new Error('Only DOCX files are allowed'));
    }
  },
}).single('file');
