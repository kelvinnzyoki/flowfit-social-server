import multer, { MulterError } from 'multer';
import { Request, Response, NextFunction } from 'express';

// Vercel hard cap is 4.5 MB for the entire request body.
// Keep per-file limit at 4 MB to leave headroom for multipart envelope overhead.
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/mov',
  'video/quicktime',
]);

const multerInstance = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 4 },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      // Pass an error with statusCode so the error middleware returns 415, not 500
      const err = new Error(`Unsupported file type: ${file.mimetype}`) as any;
      err.statusCode = 415;
      return cb(err);
    }
    cb(null, true);
  },
});

// Wrap multer so that MulterError (file too large, too many files, etc.)
// gets a proper statusCode instead of causing a generic 500.
export function uploadArray(fieldName: string, maxCount: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    multerInstance.array(fieldName, maxCount)(req, res, (err) => {
      if (!err) return next();

      if (err instanceof MulterError) {
        const statusMap: Record<string, number> = {
          LIMIT_FILE_SIZE:  413,
          LIMIT_FILE_COUNT: 400,
          LIMIT_UNEXPECTED_FILE: 400,
        };
        const status = statusMap[err.code] ?? 400;
        const messages: Record<string, string> = {
          LIMIT_FILE_SIZE:  `File too large. Max size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB per file.`,
          LIMIT_FILE_COUNT: 'Too many files. Max 4 files per upload.',
          LIMIT_UNEXPECTED_FILE: `Unexpected field. Use "media" as the form field name.`,
        };
        (err as any).statusCode = status;
        (err as any).message = messages[err.code] ?? err.message;
      }

      next(err);
    });
  };
}

export default multerInstance;
