import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

import { HeroSlide } from '../src/models/heroSlideModel.js';
import { HomepageLayout } from '../src/models/homepageModel.js';
import Category from '../src/models/categoryModel.js';
import Product from '../src/models/productModel.js';
import { DEFAULT_HOMEPAGE_SECTIONS } from '../src/services/homepageService.js';

const isApply = process.argv.includes('--apply');

async function run() {
  console.log('='.repeat(70));
  console.log(`SEED HERO SLIDES & HOMEPAGE LAYOUT [Mode: ${isApply ? 'APPLY (Writing changes)' : 'DRY RUN (Read only)'}]`);
  console.log('='.repeat(70));

  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('Connected to MongoDB.\n');

    // 1. Resolve real categories and products for links and imagery
    const categories = await Category.find({}).lean();
    const products = await Product.find({}).lean();

    const hoodieCat = categories.find((c) => c.slug?.includes('hoodie')) || categories[0];
    const dressCat = categories.find((c) => c.slug?.includes('dress')) || categories[1] || categories[0];
    const shoeCat = categories.find((c) => c.slug?.includes('shoe')) || categories[2] || categories[0];

    const slide1Img = products[0]?.image || 'https://res.cloudinary.com/f2m4soyw/image/upload/v1791709802/novashop/products/ehsm0pm0xfuqzwndzkzp.jpg';
    const slide2Img = products[3]?.image || 'https://res.cloudinary.com/f2m4soyw/image/upload/v1791878786/novashop/products/ptffzwvmqy7zijlyohur.jpg';
    const slide3Img = products[2]?.image || 'https://res.cloudinary.com/f2m4soyw/image/upload/v1791799181/novashop/products/m5qjauzzdbv8fyyzlm35.jpg';

    const INITIAL_REAL_SLIDES = [
      {
        headline: 'The Color Edit: Modern Luxury',
        subheadline: 'Bold hues and considered silhouettes, curated for an unapologetic wardrobe.',
        image: slide1Img,
        buttonLabel: 'Shop Collection',
        buttonLink: `/categories/${hoodieCat?.slug || 'hoodies'}`,
        position: 0,
        status: 'active',
        startsAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      },
      {
        headline: 'Evening Silhouettes & Silk Slips',
        subheadline: 'Fluid draping and sculpted tailoring designed to command every room.',
        image: slide2Img,
        buttonLabel: 'Explore Eveningwear',
        buttonLink: `/categories/${dressCat?.slug || 'evening-formal-dresses'}`,
        position: 1,
        status: 'active',
        startsAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      },
      {
        headline: 'Performance Footwear & Trail Masters',
        subheadline: 'Engineered comfort meets striking street minimalism.',
        image: slide3Img,
        buttonLabel: 'Shop Footwear',
        buttonLink: `/categories/${shoeCat?.slug || 'shoes'}`,
        position: 2,
        status: 'active',
        startsAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    ];

    console.log('--- Step 1: Checking Hero Slides ---');
    const existingSlides = await HeroSlide.countDocuments({});
    console.log(`Current HeroSlide documents in DB: ${existingSlides}`);

    if (existingSlides === 0) {
      if (!isApply) {
        console.log(`[DRY RUN]: Would seed ${INITIAL_REAL_SLIDES.length} initial real hero slides.`);
        INITIAL_REAL_SLIDES.forEach((s) => console.log(`  - "${s.headline}" -> Link: ${s.buttonLink}`));
      } else {
        for (const slide of INITIAL_REAL_SLIDES) {
          const created = await HeroSlide.create(slide);
          console.log(`  - [CREATED]: Slide #${created._id} ("${created.headline}")`);
        }
      }
    } else {
      console.log('Hero slides already exist. Preserving existing slides.');
    }

    console.log('\n--- Step 2: Checking Homepage Layouts ---');
    const publishedLayout = await HomepageLayout.findOne({ status: 'published' });
    const draftLayout = await HomepageLayout.findOne({ status: 'draft' });

    if (!publishedLayout) {
      if (!isApply) {
        console.log('[DRY RUN]: Would create initial published HomepageLayout with 8 default sections.');
      } else {
        await HomepageLayout.create({
          status: 'published',
          version: 1,
          sections: DEFAULT_HOMEPAGE_SECTIONS,
          publishedAt: new Date(),
          publishedByName: 'System Seed',
        });
        console.log('[CREATED]: Published HomepageLayout created.');
      }
    } else {
      console.log(`Published HomepageLayout exists (Version: ${publishedLayout.version}, Sections: ${publishedLayout.sections?.length}).`);
    }

    if (!draftLayout) {
      if (!isApply) {
        console.log('[DRY RUN]: Would create initial draft HomepageLayout.');
      } else {
        await HomepageLayout.create({
          status: 'draft',
          version: 1,
          sections: DEFAULT_HOMEPAGE_SECTIONS,
          publishedAt: new Date(),
          publishedByName: 'System Seed',
        });
        console.log('[CREATED]: Draft HomepageLayout created.');
      }
    } else {
      console.log(`Draft HomepageLayout exists (Version: ${draftLayout.version}, Sections: ${draftLayout.sections?.length}).`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('SEED SUMMARY:');
    console.log(`  Mode: ${isApply ? 'APPLY' : 'DRY RUN'}`);
    console.log('='.repeat(70));

    if (!isApply) {
      console.log('\nTo apply this seed to the database, run:');
      console.log('  node backend/scripts/seedHeroSlidesAndHomepage.js --apply\n');
    }

  } catch (err) {
    console.error('Fatal error during seed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

run();
