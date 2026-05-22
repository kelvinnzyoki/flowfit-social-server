import multer from 'multer';
import HttpError from '../utils/httpError';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 4 },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new HttpError(415, 'Unsupported media type'));
      return;
    }
    cb(null, true);
  }
});

export default upload;
