import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Review, { recalculateProductRating } from '../models/reviewModel.js';
import Discount from '../models/discountModel.js';
import DiscountRedemption from '../models/discountRedemptionModel.js';
import Product from '../models/productModel.js';
import AdminNotification from '../models/adminNotificationModel.js';

dotenv.config();

async function runMigration() {
  console.log('\n======================================================');
  console.log('   NovaShop Migration: Reviews & Discounts Indexes    ');
  console.log('======================================================\n');

  const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/novashop';
  await mongoose.connect(mongoUri);

  try {
    console.log('1. Syncing Review indexes...');
    await Review.syncIndexes();
    console.log('   ✓ Review indexes synced (including { product: 1, user: 1, order: 1 } unique).');

    console.log('2. Syncing Discount indexes...');
    await Discount.syncIndexes();
    console.log('   ✓ Discount indexes synced (including { code: 1 } unique).');

    console.log('3. Syncing DiscountRedemption indexes...');
    await DiscountRedemption.syncIndexes();
    console.log('   ✓ DiscountRedemption indexes synced (including { discount: 1, order: 1 } unique).');

    console.log('4. Syncing AdminNotification indexes...');
    await AdminNotification.syncIndexes();
    console.log('   ✓ AdminNotification indexes synced.');

    console.log('5. Recalculating all product rating aggregates...');
    const productsWithReviews = await Review.distinct('product', { isDeleted: false, status: 'approved' });
    console.log(`   Found ${productsWithReviews.length} product(s) with approved reviews.`);
    for (const productId of productsWithReviews) {
      await recalculateProductRating(productId);
    }
    console.log('   ✓ Product rating aggregates updated successfully.');

    console.log('\n✓ Migration completed successfully!\n');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runMigration();
