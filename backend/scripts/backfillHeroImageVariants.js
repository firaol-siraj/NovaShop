import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

import { HeroSlide } from '../src/models/heroSlideModel.js';
import { MediaFile } from '../src/models/mediaModel.js';
import { buildImageVariants } from '../src/services/storageService.js';

const isApply = process.argv.includes('--apply');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
const TARGET_WIDTHS = [768, 1280, 1920, 2560];

async function run() {
  console.log('='.repeat(70));
  console.log(`BACKFILL: HERO IMAGE VARIANTS & RESIZING [Mode: ${isApply ? 'APPLY' : 'DRY RUN'}]`);
  console.log('='.repeat(70));

  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('Connected to MongoDB.\n');

    const heroSlides = await HeroSlide.find({}).lean();
    console.log(`Checking ${heroSlides.length} hero slide(s)...`);

    for (const slide of heroSlides) {
      const imgUrl = slide.image;
      if (!imgUrl) continue;

      console.log(`\nEvaluating slide "${slide.headline}" (Image: ${imgUrl})`);

      // 1. Local storage image processing
      if (imgUrl.startsWith('/uploads/')) {
        const filename = path.basename(imgUrl);
        const filePath = path.join(UPLOAD_DIR, filename);

        if (!fs.existsSync(filePath)) {
          console.log(`  ⚠️ Warning: Local file ${filePath} does not exist on disk.`);
          continue;
        }

        const buffer = fs.readFileSync(filePath);
        let meta = await sharp(buffer).rotate().metadata();
        console.log(`  Dimensions: ${meta.width} × ${meta.height}px (${Math.round(buffer.length / 1024)} KB)`);

        // Check if oversized (> 4000px)
        let processedBuffer = buffer;
        if (meta.width && meta.width > 4000) {
          console.log(`  -> Oversized original (${meta.width}px > 4000px). Needs resize to 3000px max.`);
          if (isApply) {
            processedBuffer = await sharp(buffer)
              .rotate()
              .resize({ width: 3000, withoutEnlargement: true })
              .toBuffer();
            fs.writeFileSync(filePath, processedBuffer);
            meta = await sharp(processedBuffer).metadata();
            console.log(`  -> Resized original on disk to ${meta.width} × ${meta.height}px.`);
          }
        }

        // Check and generate WebP variants
        const allowedWidths = TARGET_WIDTHS.filter((w) => meta.width && w <= meta.width);
        const generatedVariants = [];

        for (const w of allowedWidths) {
          const variantFilename = `${w}w_${filename}.webp`;
          const variantPath = path.join(UPLOAD_DIR, variantFilename);
          const vHeight = meta.height ? Math.round(meta.height * (w / meta.width)) : null;

          if (fs.existsSync(variantPath)) {
            console.log(`  - Variant ${w}w already exists.`);
          } else {
            console.log(`  - ${isApply ? 'Generating' : 'Would generate'} variant ${w}w (${w} × ${vHeight}px, WebP quality 80)`);
            if (isApply) {
              await sharp(processedBuffer)
                .rotate()
                .resize({ width: w, withoutEnlargement: true })
                .webp({ quality: 80 })
                .toFile(variantPath);
            }
          }

          generatedVariants.push({
            width: w,
            height: vHeight,
            url: `/uploads/${variantFilename}`,
            format: 'webp',
          });
        }

        // Update MediaFile and HeroSlide if present
        if (isApply) {
          await MediaFile.updateOne(
            { url: imgUrl },
            {
              $set: {
                width: meta.width,
                height: meta.height,
                variants: generatedVariants,
              },
            }
          );
          await HeroSlide.updateOne(
            { _id: slide._id },
            {
              $set: {
                width: meta.width,
                height: meta.height,
              },
            }
          );
        }
      }

      // 2. Cloudinary image processing
      else if (imgUrl.includes('/upload/')) {
        const variants = buildImageVariants(imgUrl);
        console.log(`  Cloudinary image detected. Generated ${variants.length} dynamic variants:`);
        variants.forEach((v) => console.log(`  - ${v.width}w -> ${v.url}`));

        if (isApply) {
          await MediaFile.updateOne(
            { url: imgUrl },
            {
              $set: {
                variants,
              },
            }
          );
        }
      }
    }

    if (!isApply) {
      console.log('\nDRY RUN complete. Run with `--apply` to commit variant generation.');
    } else {
      console.log('\nVariant generation and database backfill completed successfully.');
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  } catch (err) {
    console.error('Backfill failed:', err);
    process.exit(1);
  }
}

run();
