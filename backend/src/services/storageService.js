import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

// Ensure local uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch (err) {
    logger.error(`Failed to create uploads directory: ${err.message}`);
  }
}

// Maximum allowed sizes per kind (in bytes)
export const SIZE_LIMITS = {
  image: 10 * 1024 * 1024,      // 10 MB
  video: 50 * 1024 * 1024,      // 50 MB
  document: 15 * 1024 * 1024,   // 15 MB
};

// Forbidden extensions
const EXECUTABLE_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.bash', '.php', '.phtml', '.php5',
  '.js', '.mjs', '.cjs', '.ts', '.py', '.rb', '.pl', '.cgi',
  '.jar', '.war', '.ear', '.msi', '.vbs', '.vbe', '.wsf', '.wsh',
  '.scr', '.pif', '.com', '.dll', '.so', '.dylib', '.bin'
]);

/**
 * Validates file buffer magic bytes to verify genuine MIME type
 */
export function detectMimeType(buffer) {
  if (!buffer || buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }

  // GIF: 47 49 46 38 (GIF8)
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return 'image/gif';
  }

  // WEBP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  // PDF: 25 50 44 46 (%PDF)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'application/pdf';
  }

  // WEBM / MKV: 1A 45 DF A3
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return 'video/webm';
  }

  // MP4 / QuickTime / ISOM
  if (buffer.length >= 12 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    const brand = buffer.toString('utf8', 8, 12).toLowerCase();
    if (['avif', 'avis'].includes(brand)) {
      return 'image/avif';
    }
    return 'video/mp4';
  }

  // SVG: Check for <svg tag in first 1000 characters
  const headStr = buffer.slice(0, 1000).toString('utf8').trim().toLowerCase();
  if (headStr.includes('<svg') || (headStr.includes('<?xml') && headStr.includes('<svg'))) {
    // Sanitize check: reject malicious scripts in SVG
    if (
      headStr.includes('<script') ||
      headStr.includes('javascript:') ||
      headStr.includes('onload=') ||
      headStr.includes('onerror=')
    ) {
      throw new ApiError(400, 'SVG contains potentially unsafe script content and is blocked.');
    }
    return 'image/svg+xml';
  }

  return null;
}

/**
 * Derives kind ('image' | 'video' | 'document') from MIME type
 */
export function getKindFromMime(mime) {
  if (!mime) return null;
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf' || mime.startsWith('text/') || mime.includes('document')) return 'document';
  return null;
}

/**
 * Extracts width and height from PNG, JPEG, GIF, and WebP buffer headers
 */
export function extractImageDimensions(buffer, mime) {
  try {
    if (mime === 'image/png' && buffer.length >= 24) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }

    if (mime === 'image/gif' && buffer.length >= 10) {
      const width = buffer.readUInt16LE(6);
      const height = buffer.readUInt16LE(8);
      return { width, height };
    }

    if (mime === 'image/webp' && buffer.length >= 30) {
      // VP8 (lossy)
      if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x20) {
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        return { width, height };
      }
      // VP8L (lossless)
      if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x4c) {
        const b1 = buffer[21];
        const b2 = buffer[22];
        const b3 = buffer[23];
        const b4 = buffer[24];
        const width = 1 + (((b2 & 0x3f) << 8) | b1);
        const height = 1 + (((b4 & 0xf) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
        return { width, height };
      }
    }

    if (mime === 'image/jpeg') {
      let offset = 2;
      while (offset < buffer.length) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];
        // SOF0 (0xC0) to SOF2 (0xC2) contain height and width
        if ([0xc0, 0xc1, 0xc2].includes(marker)) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height };
        }
        const length = buffer.readUInt16BE(offset + 2);
        offset += 2 + length;
      }
    }
  } catch (err) {
    logger.warn(`Could not extract dimensions from buffer: ${err.message}`);
  }

  return { width: null, height: null };
}

/**
 * Computes SHA-256 hash of buffer
 */
export function computeFileHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Sanitizes original filename against path traversal
 */
export function sanitizeFilename(rawName) {
  const base = path.basename(rawName).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base || `file_${Date.now()}`;
}

/**
 * Generates Cloudinary thumbnail URL with automatic crop and quality
 */
export function buildCloudinaryThumbnail(url) {
  if (!url || !url.includes('/upload/')) return url;
  return url.replace('/upload/', '/upload/c_fill,w_320,h_320,g_auto,q_auto/');
}

/**
 * Storage Adapter: uploads buffer using Cloudinary if configured, else local disk
 */
export async function uploadMediaBuffer({
  buffer,
  originalName,
  folder = 'novashop/media',
}) {
  const ext = path.extname(originalName).toLowerCase();
  if (EXECUTABLE_EXTENSIONS.has(ext)) {
    throw new ApiError(400, `File type ${ext} is executable and strictly forbidden.`);
  }

  const mimeType = detectMimeType(buffer);
  if (!mimeType) {
    throw new ApiError(400, 'Unsupported or unrecognizable file format.');
  }

  const kind = getKindFromMime(mimeType);
  if (!kind) {
    throw new ApiError(400, `File type ${mimeType} is not supported.`);
  }

  const maxAllowed = SIZE_LIMITS[kind];
  if (buffer.length > maxAllowed) {
    const mb = Math.round(maxAllowed / (1024 * 1024));
    throw new ApiError(413, `File exceeds the ${mb} MB limit for ${kind}s.`);
  }

  const hash = computeFileHash(buffer);
  const cleanName = sanitizeFilename(originalName);
  const randomPrefix = crypto.randomBytes(8).toString('hex');
  const storedName = `${randomPrefix}_${cleanName}`;

  let width = null;
  let height = null;
  let url = '';
  let thumbnailUrl = '';
  const variants = [];
  const TARGET_WIDTHS = [768, 1280, 1920, 2560];

  // Pre-process images: rotate EXIF, downscale oversized originals (> 4000px)
  if (kind === 'image') {
    try {
      let meta = await sharp(buffer).rotate().metadata();
      if (meta.width && meta.width > 4000) {
        buffer = await sharp(buffer)
          .rotate()
          .resize({ width: 3000, withoutEnlargement: true })
          .toBuffer();
        meta = await sharp(buffer).metadata();
      }
      width = meta.width || null;
      height = meta.height || null;
    } catch (preErr) {
      logger.warn(`Pre-processing image metadata failed: ${preErr.message}`);
      const dims = extractImageDimensions(buffer, mimeType);
      width = dims.width;
      height = dims.height;
    }
  }

  // 1. Prefer Cloudinary when configured
  if (isCloudinaryConfigured()) {
    try {
      const resourceType = kind === 'video' ? 'video' : kind === 'document' ? 'raw' : 'image';
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: resourceType,
            public_id: path.parse(storedName).name,
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        uploadStream.end(buffer);
      });

      url = uploadResult.secure_url || uploadResult.url;
      width = uploadResult.width || width;
      height = uploadResult.height || height;
      thumbnailUrl = kind === 'image' ? buildCloudinaryThumbnail(url) : '';

      if (kind === 'image' && width) {
        const allowedWidths = TARGET_WIDTHS.filter((w) => w <= width);
        for (const w of allowedWidths) {
          const vHeight = height ? Math.round(height * (w / width)) : null;
          variants.push({
            width: w,
            height: vHeight,
            url: url.replace('/upload/', `/upload/c_scale,w_${w},f_auto,q_80/`),
            format: 'webp',
          });
        }
      }
    } catch (err) {
      logger.error(`Cloudinary upload failed: ${err.message}. Falling back to local storage.`);
    }
  }

  // 2. Fallback to local storage if Cloudinary not configured or failed
  if (!url) {
    const targetPath = path.join(UPLOAD_DIR, storedName);
    fs.writeFileSync(targetPath, buffer);

    // Relative public URL served statically by express
    url = `/uploads/${storedName}`;

    if (kind === 'image') {
      try {
        // Generate sharp thumbnail: 320x320 cover
        const thumbName = `thumb_${storedName}`;
        const thumbPath = path.join(UPLOAD_DIR, thumbName);

        await sharp(buffer)
          .rotate()
          .resize(320, 320, { fit: 'cover', position: 'center' })
          .jpeg({ quality: 80, progressive: true })
          .toFile(thumbPath);

        thumbnailUrl = `/uploads/${thumbName}`;

        // Generate resized variants (768, 1280, 1920, 2560)
        const allowedWidths = TARGET_WIDTHS.filter((w) => !width || w <= width);
        for (const w of allowedWidths) {
          const variantFilename = `${w}w_${storedName}.webp`;
          const variantPath = path.join(UPLOAD_DIR, variantFilename);
          const vHeight = width && height ? Math.round(height * (w / width)) : null;

          await sharp(buffer)
            .rotate()
            .resize({ width: w, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(variantPath);

          variants.push({
            width: w,
            height: vHeight,
            url: `/uploads/${variantFilename}`,
            format: 'webp',
          });
        }
      } catch (err) {
        logger.warn(`Sharp processing error: ${err.message}. Falling back to header dimensions.`);
        if (!width || !height) {
          const dims = extractImageDimensions(buffer, mimeType);
          width = dims.width;
          height = dims.height;
        }
        thumbnailUrl = url;
      }
    } else {
      thumbnailUrl = '';
    }
  }

  return {
    originalName: cleanName,
    storedName,
    url,
    thumbnailUrl: thumbnailUrl || url,
    mimeType,
    kind,
    size: buffer.length,
    width,
    height,
    variants,
    hash,
  };
}

/**
 * Storage Adapter: safely deletes physical file (Cloudinary public_id or local disk)
 */
export async function deleteMediaPhysical(fileDoc) {
  if (!fileDoc) return;

  try {
    if (fileDoc.url && fileDoc.url.includes('res.cloudinary.com')) {
      const parts = fileDoc.url.split('/upload/');
      if (parts.length > 1) {
        const pathPart = parts[1].replace(/^v\d+\//, '');
        const publicId = pathPart.substring(0, pathPart.lastIndexOf('.'));
        const resourceType = fileDoc.kind === 'video' ? 'video' : fileDoc.kind === 'document' ? 'raw' : 'image';
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      }
    } else if (fileDoc.url && fileDoc.url.startsWith('/uploads/')) {
      const filename = path.basename(fileDoc.url);
      const localPath = path.join(UPLOAD_DIR, filename);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
      if (fileDoc.thumbnailUrl && fileDoc.thumbnailUrl.startsWith('/uploads/')) {
        const thumbFilename = path.basename(fileDoc.thumbnailUrl);
        const thumbPath = path.join(UPLOAD_DIR, thumbFilename);
        if (fs.existsSync(thumbPath)) {
          fs.unlinkSync(thumbPath);
        }
      }
      // Also delete any generated variant files
      try {
        const filesInDir = fs.readdirSync(UPLOAD_DIR);
        for (const f of filesInDir) {
          if (f.includes(filename) && f !== filename) {
            fs.unlinkSync(path.join(UPLOAD_DIR, f));
          }
        }
      } catch {
        // ignore cleanup error
      }
    }
  } catch (err) {
    logger.warn(`Failed to physically delete media file: ${err.message}`);
  }
}

/**
 * Builds responsive image variants (768w, 1280w, 1920w, 2560w) for any image URL
 */
export function buildImageVariants(url, width = null, height = null) {
  if (!url || typeof url !== 'string') return [];
  const TARGET_WIDTHS = [768, 1280, 1920, 2560];

  // 1. Cloudinary dynamic URL transformation
  if (url.includes('/upload/')) {
    const allowed = width ? TARGET_WIDTHS.filter((w) => w <= width) : TARGET_WIDTHS;
    return (allowed.length > 0 ? allowed : TARGET_WIDTHS).map((w) => {
      const vHeight = width && height ? Math.round(height * (w / width)) : null;
      return {
        width: w,
        height: vHeight,
        url: url.replace('/upload/', `/upload/c_scale,w_${w},f_auto,q_80/`),
        format: 'webp',
      };
    });
  }

  // 2. Local disk variants
  if (url.startsWith('/uploads/')) {
    const filename = path.basename(url);
    const variants = [];
    for (const w of TARGET_WIDTHS) {
      if (width && w > width) continue;
      const variantName = `${w}w_${filename}.webp`;
      const localPath = path.join(UPLOAD_DIR, variantName);
      if (fs.existsSync(localPath)) {
        variants.push({
          width: w,
          height: width && height ? Math.round(height * (w / width)) : null,
          url: `/uploads/${variantName}`,
          format: 'webp',
        });
      }
    }
    return variants;
  }

  return [];
}

/**
 * Formats variants into a standard HTML srcset string
 */
export function buildSrcSet(variants = [], fallbackUrl = '') {
  if (Array.isArray(variants) && variants.length > 0) {
    return variants.map((v) => `${v.url} ${v.width}w`).join(', ');
  }
  return fallbackUrl ? `${fallbackUrl} 1920w` : '';
}

export default {
  detectMimeType,
  getKindFromMime,
  extractImageDimensions,
  computeFileHash,
  sanitizeFilename,
  uploadMediaBuffer,
  deleteMediaPhysical,
  buildCloudinaryThumbnail,
  buildImageVariants,
  buildSrcSet,
};
