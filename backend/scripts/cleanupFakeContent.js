import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

import { HeroSlide, HeroSlideStat } from '../src/models/heroSlideModel.js';
import { MediaFile } from '../src/models/mediaModel.js';

const isApply = process.argv.includes('--apply');

// Known mock names from template UI
const MOCK_SLIDE_HEADLINES = [
  'Autumn Collection',
  'Evening Dresses',
  'Free Shipping',
  'Black Friday',
  'Winter Accessories',
  'Summer Sale',
];

const MOCK_MEDIA_NAMES = [
  'cashmere-overcoat.jpg',
  'silk-slip-dress-01.jpg',
  'leather-tote-bag.jpg',
  'merino-sweater-detail.jpg',
  'tailored-trousers.jpg',
  'suede-chelsea-boots.jpg',
  'silk-scarf-detail.jpg',
  'autumn-hero-banner.jpg',
  'outerwear-category.jpg',
  'size-guide.pdf',
  'brand-film.mp4',
  'linen-shirt-flat.jpg',
];

async function run() {
  console.log('='.repeat(70));
  console.log(`CLEANUP FAKE CONTENT SCRIPT [Mode: ${isApply ? 'APPLY (Writing changes)' : 'DRY RUN (Read only)'}]`);
  console.log('='.repeat(70));

  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('Connected to MongoDB.\n');

    // 1. Inspect Hero Slides
    console.log('--- Step 1: Checking for mock Hero Slides ---');
    const fakeSlides = await HeroSlide.find({
      headline: { $in: MOCK_SLIDE_HEADLINES },
    }).lean();

    console.log(`Found ${fakeSlides.length} fake hero slide(s):`);
    fakeSlides.forEach((s) => {
      console.log(`  - [FAKE SLIDE]: #${s._id} "${s.headline}" (Status: ${s.status})`);
    });

    // 2. Inspect Media Files
    console.log('\n--- Step 2: Checking for mock Media Files ---');
    const fakeFiles = await MediaFile.find({
      originalName: { $in: MOCK_MEDIA_NAMES },
      usageCount: 0, // Only delete if completely unreferenced
    }).lean();

    console.log(`Found ${fakeFiles.length} mock media file(s):`);
    fakeFiles.forEach((f) => {
      console.log(`  - [MOCK FILE]: #${f._id} "${f.originalName}" (${f.kind}, ${f.size} bytes)`);
    });

    if (isApply) {
      if (fakeSlides.length > 0) {
        const slideIds = fakeSlides.map((s) => s._id);
        await HeroSlide.deleteMany({ _id: { $in: slideIds } });
        await HeroSlideStat.deleteMany({ slide: { $in: slideIds } });
        console.log(`\n[DELETED]: Removed ${fakeSlides.length} fake hero slide(s).`);
      }

      if (fakeFiles.length > 0) {
        const fileIds = fakeFiles.map((f) => f._id);
        await MediaFile.deleteMany({ _id: { $in: fileIds } });
        console.log(`[DELETED]: Removed ${fakeFiles.length} mock media file(s).`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('CLEANUP SUMMARY:');
    console.log(`  Fake slides identified: ${fakeSlides.length}`);
    console.log(`  Mock files identified:  ${fakeFiles.length}`);
    console.log(`  Actions executed:       ${isApply ? 'DELETED' : 'DRY RUN (No changes made)'}`);
    console.log('='.repeat(70));

    if (!isApply && (fakeSlides.length > 0 || fakeFiles.length > 0)) {
      console.log('\nTo permanently delete these fake records, run:');
      console.log('  node backend/scripts/cleanupFakeContent.js --apply\n');
    }

  } catch (err) {
    console.error('Fatal error during cleanup:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

run();
