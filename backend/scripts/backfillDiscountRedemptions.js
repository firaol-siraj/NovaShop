import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

import Order from '../src/models/orderModel.js';
import Discount from '../src/models/discountModel.js';
import DiscountRedemption from '../src/models/discountRedemptionModel.js';

const isApply = process.argv.includes('--apply');

async function run() {
  console.log('='.repeat(70));
  console.log(`BACKFILL DISCOUNT REDEMPTIONS SCRIPT [Mode: ${isApply ? 'APPLY (Writing changes)' : 'DRY RUN (Read only)'}]`);
  console.log('='.repeat(70));

  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('Connected to MongoDB.\n');

    // Find all paid orders that have a discount code, discount amount, or discount ID
    const candidateOrders = await Order.find({
      $or: [{ isPaid: true }, { paymentStatus: 'paid' }],
      paymentStatus: { $nin: ['cancelled', 'failed'] },
      $or: [
        { discountCode: { $exists: true, $ne: null, $ne: '' } },
        { discountAmount: { $gt: 0 } },
        { discountId: { $exists: true, $ne: null } },
      ],
    }).sort({ createdAt: 1 }).lean();

    console.log(`Found ${candidateOrders.length} candidate paid order(s) with discount information.`);

    let alreadyExistsCount = 0;
    let missingCount = 0;
    let createdCount = 0;
    let errorCount = 0;

    for (const order of candidateOrders) {
      const existing = await DiscountRedemption.findOne({ order: order._id }).lean();
      if (existing) {
        alreadyExistsCount++;
        console.log(`- Order #${order.orderNumber || order._id} [SKIP]: Already has redemption ${existing._id} (${existing.code})`);
        continue;
      }

      missingCount++;

      // Resolve discount document
      let discountDoc = null;
      if (order.discountId) {
        discountDoc = await Discount.findById(order.discountId).lean();
      }
      if (!discountDoc && order.discountCode) {
        discountDoc = await Discount.findOne({ code: order.discountCode.trim().toUpperCase() }).lean();
      }

      const discountCode = discountDoc?.code || (order.discountCode ? order.discountCode.trim().toUpperCase() : 'PROMO');
      const discountId = discountDoc?._id || new mongoose.Types.ObjectId();
      const amountDiscounted = Number(order.discountAmount) || 0;
      const orderTotal = Number(order.totalPrice) || 0;

      if (!isApply) {
        console.log(`- Order #${order.orderNumber || order._id} [DRY RUN]: Would create DiscountRedemption for code "${discountCode}" (Discount: ${amountDiscounted}, Order Total: ${orderTotal}, Date: ${order.paidAt || order.createdAt})`);
      } else {
        try {
          const created = await DiscountRedemption.create({
            discount: discountId,
            code: discountCode,
            order: order._id,
            user: order.user || null,
            customerEmail: order.customerEmail || '',
            amountDiscounted,
            orderTotal,
            createdAt: order.paidAt || order.createdAt || new Date(),
          });
          createdCount++;
          console.log(`- Order #${order.orderNumber || order._id} [CREATED]: Created redemption ${created._id} for code "${discountCode}" (usedCount untouched).`);
        } catch (createErr) {
          errorCount++;
          console.error(`- Order #${order.orderNumber || order._id} [ERROR]: ${createErr.message}`);
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('BACKFILL SUMMARY:');
    console.log(`  Candidate orders examined:    ${candidateOrders.length}`);
    console.log(`  Existing redemptions kept:    ${alreadyExistsCount}`);
    console.log(`  Missing redemptions detected: ${missingCount}`);
    console.log(`  Redemptions created:          ${createdCount} (Mode: ${isApply ? 'APPLY' : 'DRY RUN'})`);
    if (errorCount > 0) console.log(`  Errors encountered:           ${errorCount}`);
    console.log('='.repeat(70));

    if (!isApply && missingCount > 0) {
      console.log('\nTo apply these creations to the database, run:');
      console.log('  node backend/scripts/backfillDiscountRedemptions.js --apply\n');
    }

  } catch (err) {
    console.error('Fatal error during backfill:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

run();
