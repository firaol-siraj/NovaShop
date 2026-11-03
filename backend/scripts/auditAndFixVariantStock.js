import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from '../src/models/productModel.js';
import ProductVariant from '../src/models/productVariantModel.js';

dotenv.config();

// Parse CLI flags
const args = process.argv.slice(2);
const hasFlag = (flag) => args.some((arg) => arg === flag || arg.startsWith(`${flag}=`));
const getFlagValue = (flag) => {
  const match = args.find((arg) => arg.startsWith(`${flag}=`));
  return match ? match.split('=')[1] : null;
};

const isApply = hasFlag('--apply');
const isSyncOnly = hasFlag('--sync-only');
const rawStockValue = getFlagValue('--set-stock');
const targetProductIdOrSlug = getFlagValue('--product');

const targetStock = rawStockValue !== null ? parseInt(rawStockValue, 10) : null;

async function run() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/novashop';

  console.log('='.repeat(70));
  console.log('  NovaShop Product & Variant Stock Audit and Repair Tool');
  console.log('='.repeat(70));
  console.log(`Connecting to MongoDB at: ${mongoUri.replace(/:([^:@]+)@/, ':****@')}...`);

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 4000 });
  } catch (connErr) {
    console.error(`\n[!] CONNECTION FAILED: Unable to reach MongoDB.`);
    console.error(`    Target URI: ${mongoUri.replace(/:([^:@]+)@/, ':****@')}`);
    console.error(`    Reason: ${connErr.message}`);
    console.error(`    Please ensure your MongoDB service is running (e.g. systemctl start mongod or mongod)`);
    console.error(`    and that MONGO_URI in your backend/.env file points to your database.\n`);
    process.exit(1);
  }
  console.log(`Connected to database: ${mongoose.connection.name}`);
  console.log(`Execution Mode: ${isApply ? 'APPLY (LIVE WRITES)' : 'DRY RUN (READ-ONLY AUDIT)'}`);

  if (targetProductIdOrSlug) {
    console.log(`Targeting single product: ${targetProductIdOrSlug}`);
  }
  if (targetStock !== null) {
    if (isNaN(targetStock) || targetStock < 0) {
      console.error('ERROR: --set-stock must be an integer >= 0.');
      await mongoose.disconnect();
      process.exit(1);
    }
    console.log(`Target stock for 0/missing variants: ${targetStock}`);
  } else if (isSyncOnly) {
    console.log(`Operation: Synchronize parent countInStock to sum of variant stock`);
  } else if (isApply) {
    console.error('\nERROR: You passed --apply without specifying --set-stock=<number> or --sync-only.');
    console.error('To protect inventory integrity, NovaShop never invents stock numbers silently.');
    console.error('Usage examples:');
    console.error('  node scripts/auditAndFixVariantStock.js                             # Dry-run inspection');
    console.error('  node scripts/auditAndFixVariantStock.js --set-stock=10              # Dry-run preview with stock 10');
    console.error('  node scripts/auditAndFixVariantStock.js --apply --set-stock=10      # Apply stock 10 to zero-stock variants');
    console.error('  node scripts/auditAndFixVariantStock.js --apply --sync-only         # Sync parent countInStock from variants');
    await mongoose.disconnect();
    process.exit(1);
  }

  // Find products
  const productFilter = {};
  if (targetProductIdOrSlug) {
    if (mongoose.Types.ObjectId.isValid(targetProductIdOrSlug)) {
      productFilter._id = targetProductIdOrSlug;
    } else {
      productFilter.slug = targetProductIdOrSlug;
    }
  }

  const products = await Product.find(productFilter).sort({ createdAt: -1 });
  console.log(`\nFound ${products.length} product(s) to inspect.\n`);

  let totalZeroStockVariants = 0;
  let totalMissingVariants = 0;
  let totalMismatchedProducts = 0;
  const productsToUpdate = [];

  for (const product of products) {
    const variants = await ProductVariant.find({ product: product._id });
    const currentVariantSum = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
    const zeroStockVariants = variants.filter((v) => v.stock === 0 || v.stock == null);
    const countMismatch = product.countInStock !== currentVariantSum;

    if (variants.length === 0) {
      totalMissingVariants++;
    }
    if (zeroStockVariants.length > 0) {
      totalZeroStockVariants += zeroStockVariants.length;
    }
    if (countMismatch) {
      totalMismatchedProducts++;
    }

    const needsAttention = zeroStockVariants.length > 0 || countMismatch || variants.length === 0;

    if (needsAttention) {
      productsToUpdate.push({
        product,
        variants,
        zeroStockVariants,
        currentVariantSum,
        countMismatch,
      });
    }
  }

  // Print audit report
  console.log('-'.repeat(70));
  console.log('AUDIT SUMMARY');
  console.log('-'.repeat(70));
  console.log(`Total Products Audited:           ${products.length}`);
  console.log(`Products Needing Attention:       ${productsToUpdate.length}`);
  console.log(`Zero/Missing-Stock Variants:      ${totalZeroStockVariants}`);
  console.log(`Parent Count Mismatches:          ${totalMismatchedProducts}`);
  console.log(`Products without Any Variants:    ${totalMissingVariants}`);
  console.log('-'.repeat(70));

  if (productsToUpdate.length === 0) {
    console.log('\nAll products and variants have valid, consistent stock! No changes needed.');
    await mongoose.disconnect();
    return;
  }

  console.log('\nAFFECTED PRODUCTS & VARIANTS BREAKDOWN:');
  for (const item of productsToUpdate) {
    const p = item.product;
    console.log(`\n• Product: "${p.name}" (ID: ${p._id}, Slug: ${p.slug})`);
    console.log(`  Current Product.countInStock: ${p.countInStock}`);
    console.log(`  Variants Total in DB: ${item.variants.length} variant(s), Sum of stock: ${item.currentVariantSum}`);

    if (item.variants.length === 0) {
      console.log(`  [!] NO VARIANTS FOUND in ProductVariant collection.`);
    } else {
      item.variants.forEach((v) => {
        const isZero = v.stock === 0 || v.stock == null;
        const colorName = v.color?.name || v.color || 'Default';
        const flag = isZero ? '--> [ZERO STOCK]' : '    [OK]';
        console.log(`  ${flag} Variant ${v.sku} (${v.size}/${colorName}): stock = ${v.stock}`);
      });
    }

    if (targetStock !== null) {
      const projectedSum = item.variants.reduce((sum, v) => {
        const isZero = v.stock === 0 || v.stock == null;
        return sum + (isZero ? targetStock : v.stock);
      }, 0);
      console.log(`  [PROJECTED] If updated: countInStock -> ${projectedSum}`);
    } else if (isSyncOnly) {
      console.log(`  [PROJECTED] If synced: countInStock -> ${item.currentVariantSum}`);
    }
  }

  // Apply changes if requested
  if (isApply) {
    console.log('\n' + '='.repeat(70));
    console.log('  APPLYING DATABASE CHANGES...');
    console.log('='.repeat(70));

    let updatedVariantCount = 0;
    let updatedProductCount = 0;

    for (const item of productsToUpdate) {
      const p = item.product;

      // Update variants if targetStock is specified
      if (targetStock !== null && item.zeroStockVariants.length > 0) {
        for (const v of item.zeroStockVariants) {
          v.stock = targetStock;
          await v.save();
          updatedVariantCount++;
        }
      }

      // Re-fetch all variants for product to get fresh sum
      const freshVariants = await ProductVariant.find({ product: p._id });
      const freshSum = freshVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

      // If product has no variants, but targetStock was passed and product had 0 stock
      if (freshVariants.length === 0 && targetStock !== null) {
        p.countInStock = targetStock;
        await p.save();
        updatedProductCount++;
      } else if (p.countInStock !== freshSum) {
        p.countInStock = freshSum;
        await p.save();
        updatedProductCount++;
      }
    }

    console.log(`\nSuccessfully updated:`);
    console.log(`  - ${updatedVariantCount} variant(s) updated`);
    console.log(`  - ${updatedProductCount} parent product(s) synchronized`);

    // Invalidate Redis cache
    try {
      const { clearCachePattern } = await import('../src/utils/clearCache.js');
      await clearCachePattern('products');
      console.log('  - Redis cache keys invalidated for "products"');
    } catch (cacheErr) {
      console.log('  - (Cache invalidation skipped or Redis not configured)');
    }

    console.log('\nMigration complete.');
  } else {
    console.log('\n' + '='.repeat(70));
    console.log('[DRY RUN COMPLETE] No database changes were saved.');
    console.log('To apply these changes, run with --apply and your desired stock value:');
    console.log('  npm run stock:fix -- --set-stock=10');
    console.log('Or synchronize without changing variant stock:');
    console.log('  npm run stock:fix -- --sync-only');
    console.log('='.repeat(70));
  }

  await mongoose.disconnect();
  console.log('\nDatabase connection closed.');
}

run().catch((err) => {
  console.error('\nFATAL ERROR during stock audit:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});
