import { v2 as cloudinary, type UploadApiResponse, type UploadApiErrorResponse } from 'cloudinary';
import { env } from '../config/env';

const configured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
);

if (configured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key:    env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure:     true,
  });
}

export async function uploadMedia(file: Express.Multer.File): Promise<string> {
  if (!configured) {
    const err = new Error(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, ' +
      'and CLOUDINARY_API_SECRET in your backend Vercel env vars.'
    ) as any;
    err.statusCode = 503;
    throw err;
  }

  if (!file.buffer || file.buffer.length === 0) {
    const err = new Error(
      'File buffer is empty. This usually means the file was not received by multer. ' +
      'Ensure the form field name is "media" and the Content-Type is multipart/form-data.'
    ) as any;
    err.statusCode = 400;
    throw err;
  }

  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder:        env.CLOUDINARY_FOLDER || 'flowfit-social',
        resource_type: file.mimetype.startsWith('video/') ? 'video' : 'image',
        use_filename:  false,
        unique_filename: true,
      },
      (error: UploadApiErrorResponse | undefined, response: UploadApiResponse | undefined) => {
        if (error) {
          const err = new Error(
            `Cloudinary upload failed: ${error.message ?? JSON.stringify(error)}`
          ) as any;
          // Map common Cloudinary error codes to HTTP status
          err.statusCode = error.http_code ?? 502;
          return reject(err);
        }
        if (!response?.secure_url) {
          const err = new Error('Cloudinary returned no secure_url') as any;
          err.statusCode = 502;
          return reject(err);
        }
        resolve(response.secure_url);
      }
    );

    stream.on('error', (err: any) => {
      err.statusCode = err.statusCode ?? 502;
      reject(err);
    });

    stream.end(file.buffer);
  });
}
