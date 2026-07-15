import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { parseDocxFile } from './services/docxParser';

const app: Express = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Setup upload folder
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.originalname.endsWith('.docx')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only DOCX files are allowed'));
    }
  },
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'Backend is running!' });
});

// Upload and parse DOCX endpoint
app.post('/api/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const filePath = req.file.path;
    console.log('📁 Processing file:', filePath);
    
    const content = await parseDocxFile(filePath);
    console.log('✅ Parse successful, paragraphs:', content.paragraphs.length);

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      data: content,
    });
  } catch (error: any) {
    console.error('❌ Error processing file:', error);
    res.status(500).json({
      error: error.message || 'Failed to process DOCX file',
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});