import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

import Product from '../src/models/productModel.js';
import Category from '../src/models/categoryModel.js';
import { MediaFile, MediaFolder } from '../src/models/mediaModel.js';
import { buildCloudinaryThumbnail } from '../src/services/storageService.js';
import { recomputeAllMediaUsage } from '../src/services/mediaService.js';

const isApply = process.argv.includes('--apply');

async function run() {
  console.log('='.repeat(70));
  console.log(`IMPORT EXISTING PRODUCT & CATEGORY IMAGES INTO MEDIA LIBRARY [Mode: ${isApply ? 'APPLY (Writing changes)' : 'DRY RUN (Read only)'}]`);
  console.log('='.repeat(70));

  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('Connected to MongoDB.\n');

    let prodFolder = await MediaFolder.findOne({ name: 'Product photography' });
    let catFolder = await MediaFolder.findOne({ name: 'Category assets' });

    if (isApply) {
      if (!prodFolder) prodFolder = await MediaFolder.create({ name: 'Product photography' });
      if (!catFolder) catFolder = await MediaFolder.create({ name: 'Category assets' });
    }

    const products = await Product.find({}).select('name slug image images').lean();
    const categories = await Category.find({}).select('name slug image').lean();

    const imageUrlMap = new Map(); // url -> { originalName, folder, source }

    // 1. Collect product images
    for (const p of products) {
      const allUrls = [p.image, ...(Array.isArray(p.images) ? p.images : [])].filter(Boolean);
      allUrls.forEach((url, idx) => {
        if (!imageUrlMap.has(url)) {
          const parts = url.split('/');
          const filename = parts[parts.length - 1].split('?')[0];
          imageUrlMap.set(url, {
            originalName: `${p.slug || 'product'}-${idx + 1}-${filename}`,
            storedName: filename,
            folder: prodFolder?._id || null,
            source: `Product: ${p.name}`,
          });
        }
      });
    }

    // 2. Collect category images
    for (const c of categories) {
      if (c.image && !imageUrlMap.has(c.image)) {
        const parts = c.image.split('/');
        const filename = parts[parts.length - 1].split('?')[0];
        imageUrlMap.set(c.image, {
          originalName: `category-${c.slug || 'cat'}-${filename}`,
          storedName: filename,
          folder: catFolder?._id || null,
          source: `Category: ${c.name}`,
        });
      }
    }

    console.log(`Found ${imageUrlMap.size} unique image(s) referenced across ${products.length} products and ${categories.length} categories.`);

    let alreadyExists = 0;
    let newlyImported = 0;

    for (const [url, meta] of imageUrlMap.entries()) {
      const existing = await MediaFile.findOne({ url });
      if (existing) {
        alreadyExists++;
        console.log(`- [EXISTING]: ${meta.originalName} (${meta.source}) -> MediaFile #${existing._id}`);
        continue;
      }

      newlyImported++;
      if (!isApply) {
        console.log(`- [DRY RUN]: Would import ${meta.originalName} (${meta.source})`);
      } else {
        const created = await MediaFile.create({
          originalName: meta.originalName,
          storedName: meta.storedName,
          url,
          thumbnailUrl: buildCloudinaryThumbnail(url),
          mimeType: 'image/jpeg',
          kind: 'image',
          size: 780 * 1024, // Estimate 780 KB
          width: 1600,
          height: 2000,
          folder: meta.folder,
          altText: meta.source,
          usageCount: 1,
        });
        console.log(`- [CREATED]: Imported ${meta.originalName} -> MediaFile #${created._id}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('IMPORT SUMMARY:');
    console.log(`  Total images found:    ${imageUrlMap.size}`);
    console.log(`  Already in library:    ${alreadyExists}`);
    console.log(`  Imported into library: ${newlyImported} (Mode: ${isApply ? 'APPLY' : 'DRY RUN'})`);
    console.log('='.repeat(70));

    if (isApply && newlyImported > 0) {
      console.log('\nRecomputing media usage across all files...');
      const recomputeResult = await recomputeAllMediaUsage();
      console.log(`Recomputed usage for ${recomputeResult.updatedCount} files.`);
    }

    if (!isApply && newlyImported > 0) {
      console.log('\nTo apply this import to the database, run:');
      console.log('  node backend/scripts/importExistingMedia.js --apply\n');
    }

  } catch (err) {
    console.error('Fatal error during import:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

run();
