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

const isApply = process.argv.includes('--apply');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');

async function run() {
  console.log('='.repeat(70));
  console.log(`MIGRATION: HERO SLIDE FOCAL POINT, FIT & POSITION [Mode: ${isApply ? 'APPLY' : 'DRY RUN'}]`);
  console.log('='.repeat(70));

  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('Connected to MongoDB.\n');

    const slides = await HeroSlide.find({});
    console.log(`Found ${slides.length} total hero slide(s). Evaluating each...\n`);

    let modifiedCount = 0;

    for (const slide of slides) {
      const updates = {};
      const reasons = [];

      if (slide.imageFit !== 'cover') {
        updates.imageFit = 'cover';
        reasons.push('imageFit -> cover');
      }
      if (!slide.imagePosition) {
        updates.imagePosition = 'right';
        reasons.push('imagePosition -> right');
      }
      if (typeof slide.focalPointX !== 'number') {
        updates.focalPointX = 50;
        reasons.push('focalPointX -> 50');
      }

      // Check / resolve dimensions
      let width = slide.width;
      let height = slide.height;

      if ((!width || !height) && slide.image) {
        if (slide.image.startsWith('/uploads/')) {
          const filename = path.basename(slide.image);
          const filePath = path.join(UPLOAD_DIR, filename);
          if (fs.existsSync(filePath)) {
            try {
              const meta = await sharp(filePath).rotate().metadata();
              width = meta.width;
              height = meta.height;
              updates.width = width;
              updates.height = height;
              reasons.push(`dimensions -> ${width}x${height}`);
            } catch {
              // ignore
            }
          }
        }
      }

      const isPortrait = height && width && height > width;
      const targetFocalY = isPortrait ? 22 : 50;
      if (typeof slide.focalPointY !== 'number' || slide.focalPointY === 50) {
        updates.focalPointY = targetFocalY;
        reasons.push(`focalPointY -> ${targetFocalY}`);
      }

      const ratio = width && height ? (width / height).toFixed(2) : 'unknown';
      const expectedLook = 'Fills hero edge-to-edge full width and height with cover fit without blur';

      console.log(`Slide "${slide.headline}" (#${slide._id}):`);
      console.log(`  Current Image: ${slide.image} (${width || '?'}x${height || '?'}, ratio ${ratio})`);
      console.log(`  Pending Updates: ${reasons.length > 0 ? reasons.join(', ') : 'None (already up-to-date)'}`);
      console.log(`  Resulting Behavior: ${expectedLook}\n`);

      if (Object.keys(updates).length > 0) {
        modifiedCount++;
        if (isApply) {
          await HeroSlide.updateOne({ _id: slide._id }, { $set: updates });
        }
      }
    }

    if (isApply) {
      console.log(`\nSuccessfully applied migration to ${modifiedCount} slide(s).`);
    } else {
      console.log(`\nDRY RUN completed. ${modifiedCount} slide(s) would be updated. Run with \`--apply\` to commit.`);
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
