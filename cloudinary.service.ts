import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { env } from '../config/env';
import HttpError from '../utils/httpError';

const configured = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

if (configured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

export async function uploadMedia(file: Express.Multer.File): Promise<string> {
  if (!configured) {
    throw new HttpError(503, 'Cloudinary is not configured');
  }

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: env.CLOUDINARY_FOLDER,
        resource_type: file.mimetype.startsWith('video/') ? 'video' : 'image'
      },
      (error, response) => {
        if (error || !response) reject(error ?? new Error('Cloudinary upload failed'));
        else resolve(response);
      }
    );

    stream.end(file.buffer);
  });

  return result.secure_url;
}
