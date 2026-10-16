import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import ApiError from '../utils/ApiError.js';

// Maximum size of a single uploaded image.
export const MAX_IMAGE_MB = 5;
export const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;

const acceptedImages = new Map([
  ['image/jpeg', /\.(jpe?g)$/i],
  ['image/png', /\.png$/i],
  ['image/webp', /\.webp$/i],
]);

// Configure Multer to stream directly to Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'novashop/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (req, file, callback) => {
    const acceptedExtension = acceptedImages.get(file.mimetype);
    if (!acceptedExtension || !acceptedExtension.test(file.originalname)) {
      return callback(new ApiError(400, 'Only JPG, PNG, and WebP images are allowed'));
    }
    callback(null, true);
  },
});

export default upload;