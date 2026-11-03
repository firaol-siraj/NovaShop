import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Order from '../src/models/orderModel.js';
import User from '../src/models/userModel.js';
import Product from '../src/models/productModel.js';
import Review, { recalculateProductRating } from '../src/models/reviewModel.js';
import Discount from '../src/models/discountModel.js';
import DiscountRedemption from '../src/models/discountRedemptionModel.js';

dotenv.config();

const MOCK_CUSTOMER_EMAILS = [
  'elena.vasquez@email.com',
  'marcus.chen@email.com',
  'sophie.laurent@email.com',
  'david.kim@email.com',
  'amara.osei@email.com',
  'theo.laurent@email.com',
  'sarah.m@example.com',
  'james.o@example.com',
  'amelia.chen@example.com',
  'lucas.m@example.com',
  'priya.r@example.com',
  'sofia.r@example.com',
  'daniel.k@example.com',
  'noah.w@example.com',
  'elena.v@example.com',
  'oliver.j@example.com',
];

const MOCK_ORDER_NUMBERS = [
  'NS-2184',
  'NS-2183',
  'NS-2182',
  'NS-2181',
  'NS-2180',
  'NS-2179',
  'NS-10482',
  'NS-10475',
  'NS-10476',
  'NS-10469',
  'NS-10461',
  'NS-10458',
  'NS-10454',
  'NS-10441',
  'NS-10431',
  'NS-10424',
  'NS-10402',
  'NS-10394',
  'NS-10388',
  'NS-10387',
  'NS-10372',
  'NS-10342',
  'NS-10297',
  'NS-10251',
];

const MOCK_REVIEW_CODES = [
  'REV-2041',
  'REV-2040',
  'REV-2039',
  'REV-2038',
  'REV-2037',
  'REV-2036',
  'REV-2035',
  'REV-2034',
  'REV-2033',
  'REV-2032',
];

const MOCK_DISCOUNT_CODES = [
  'AUTUMN20',
  'SHIPFREE',
  'WELCOME10',
  'COAT15',
  'HOLIDAY25',
  'BF30',
  'SUMMER20',
  'SAVE50',
  'DSC-0031',
  'DSC-0032',
  'DSC-0033',
  'DSC-0034',
  'DSC-0035',
  'DSC-0036',
  'DSC-0025',
  'DSC-0026',
];

async function runCleanup() {
  const isConfirm = process.argv.includes('--confirm');
  const isAllTests = process.argv.includes('--include-test-emails');

  if (isAllTests) {
    MOCK_CUSTOMER_EMAILS.push('user@example.com', 'test@example.com', 'admin-test@example.com');
  }

  console.log('\n========================================');
  console.log('   NovaShop Mock / Seed Data Cleanup    ');
  console.log('========================================');
  console.log(`Mode: ${isConfirm ? '🔴 LIVE DELETION (--confirm active)' : '🟢 DRY RUN (Safe mode - no changes made)'}\n`);

  const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Error: MONGO_URL not defined in environment.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  try {
    // 1. Find matching fake users
    const matchedUsers = await User.find({
      email: { $in: MOCK_CUSTOMER_EMAILS },
    }).select('id name email role createdAt');
    const matchedUserIds = matchedUsers.map((u) => u._id);

    // 2. Find matching fake orders
    const matchedOrders = await Order.find({
      $or: [
        { orderNumber: { $in: MOCK_ORDER_NUMBERS } },
        { user: { $in: matchedUserIds } },
        { customerEmail: { $in: MOCK_CUSTOMER_EMAILS } },
      ],
    }).select('id orderNumber customerEmail totalPrice status isPaid createdAt');
    const matchedOrderIds = matchedOrders.map((o) => o._id);

    // 3. Find matching fake reviews
    const matchedReviews = await Review.find({
      $or: [
        { reviewCode: { $in: MOCK_REVIEW_CODES } },
        { user: { $in: matchedUserIds } },
        { order: { $in: matchedOrderIds } },
      ],
    }).select('id reviewCode title rating status product user order createdAt');

    // 4. Find matching fake discounts
    const matchedDiscounts = await Discount.find({
      code: { $in: MOCK_DISCOUNT_CODES },
    }).select('id name code type value status usedCount');
    const matchedDiscountIds = matchedDiscounts.map((d) => d._id);

    // 5. Find matching fake discount redemptions
    const matchedRedemptions = await DiscountRedemption.find({
      $or: [
        { code: { $in: MOCK_DISCOUNT_CODES } },
        { discount: { $in: matchedDiscountIds } },
        { order: { $in: matchedOrderIds } },
        { user: { $in: matchedUserIds } },
      ],
    }).select('id code amountDiscounted order user');

    console.log(`Found ${matchedUsers.length} mock customer user(s):`);
    for (const u of matchedUsers) {
      console.log(` - User ID: ${u._id} | Name: "${u.name}" | Email: ${u.email} | Role: ${u.role}`);
    }

    console.log(`\nFound ${matchedOrders.length} mock order(s):`);
    for (const o of matchedOrders) {
      console.log(` - Order ID: ${o._id} | #${o.orderNumber} | Customer: ${o.customerEmail} | Total: $${o.totalPrice} | Status: ${o.status}`);
    }

    console.log(`\nFound ${matchedReviews.length} mock review(s):`);
    for (const r of matchedReviews) {
      console.log(` - Review Code: ${r.reviewCode || r._id} | Title: "${r.title}" | Rating: ${r.rating}★ | Status: ${r.status}`);
    }

    console.log(`\nFound ${matchedDiscounts.length} mock discount(s):`);
    for (const d of matchedDiscounts) {
      console.log(` - Code: ${d.code} | Name: "${d.name}" | Type: ${d.type} | Value: ${d.value} | Status: ${d.status}`);
    }

    console.log(`\nFound ${matchedRedemptions.length} mock discount redemption(s)`);

    const totalFound = matchedUsers.length + matchedOrders.length + matchedReviews.length + matchedDiscounts.length + matchedRedemptions.length;

    if (totalFound === 0) {
      console.log('\n✓ No mock records found in the database. Clean state confirmed!');
      return;
    }

    if (!isConfirm) {
      console.log('\n------------------------------------------------------------');
      console.log('ℹ️  This was a DRY RUN. No documents were deleted.');
      console.log('To permanently delete the mock records listed above, run:');
      console.log('  npm run cleanup:fake:confirm');
      console.log('  (or: node scripts/cleanupFakeData.js --confirm)');
      console.log('------------------------------------------------------------\n');
    } else {
      console.log('\nProceeding with safe deletion of mock records only...');

      const reviewDeleteResult = await Review.deleteMany({
        $or: [
          { reviewCode: { $in: MOCK_REVIEW_CODES } },
          { user: { $in: matchedUserIds } },
          { order: { $in: matchedOrderIds } },
        ],
      });

      const redemptionDeleteResult = await DiscountRedemption.deleteMany({
        $or: [
          { code: { $in: MOCK_DISCOUNT_CODES } },
          { discount: { $in: matchedDiscountIds } },
          { order: { $in: matchedOrderIds } },
          { user: { $in: matchedUserIds } },
        ],
      });

      const discountDeleteResult = await Discount.deleteMany({
        code: { $in: MOCK_DISCOUNT_CODES },
      });

      const orderDeleteResult = await Order.deleteMany({
        $or: [
          { orderNumber: { $in: MOCK_ORDER_NUMBERS } },
          { user: { $in: matchedUserIds } },
          { customerEmail: { $in: MOCK_CUSTOMER_EMAILS } },
        ],
      });

      const userDeleteResult = await User.deleteMany({
        email: { $in: MOCK_CUSTOMER_EMAILS },
        role: { $ne: 'admin' }, // Safety check: never delete an admin account
      });

      // Recalculate affected products ratings
      const affectedProducts = [...new Set(matchedReviews.map((r) => r.product?.toString()).filter(Boolean))];
      for (const prodId of affectedProducts) {
        await recalculateProductRating(prodId).catch(() => {});
      }

      console.log(`✓ Deleted ${reviewDeleteResult.deletedCount} mock review(s).`);
      console.log(`✓ Deleted ${redemptionDeleteResult.deletedCount} mock discount redemption(s).`);
      console.log(`✓ Deleted ${discountDeleteResult.deletedCount} mock discount(s).`);
      console.log(`✓ Deleted ${orderDeleteResult.deletedCount} mock order(s).`);
      console.log(`✓ Deleted ${userDeleteResult.deletedCount} mock customer(s).`);
      console.log('Cleanup completed successfully.\n');
    }
  } finally {
    await mongoose.disconnect();
  }
}

runCleanup().catch((err) => {
  console.error('Cleanup script error:', err.message);
  process.exit(1);
});
