import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Order from '../src/models/orderModel.js';
import { normalizePaymentMethodLabel } from '../src/utils/analyticsMetrics.js';

dotenv.config();

/**
 * Safe backfill script for old orders:
 * 1. Derives and populates shippingAddress.country and shippingAddress.countryOrRegion from address
 * 2. Normalizes paymentMethod labels to real methods
 * 3. Populates refundedAt for historical refunded orders from statusHistory
 *
 * Usage:
 *   node backend/scripts/backfillOrderCountryAndRegion.js            # Dry run (safe, reports changes only)
 *   node backend/scripts/backfillOrderCountryAndRegion.js --apply    # Executes changes in database
 */
async function backfillOrders() {
  const isApply = process.argv.includes('--apply');

  console.log('\n======================================================');
  console.log(`   NovaShop Order Analytics Backfill (${isApply ? 'APPLY MODE' : 'DRY RUN MODE'})   `);
  console.log('======================================================\n');

  if (!process.env.MONGO_URL) {
    console.error('Error: MONGO_URL environment variable is not defined.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URL);

  const orders = await Order.find({}).lean();
  console.log(`Found ${orders.length} total orders to inspect.\n`);

  let countryUpdates = 0;
  let paymentMethodUpdates = 0;
  let refundDateUpdates = 0;

  const updatesToApply = [];

  for (const order of orders) {
    let needsUpdate = false;
    const updateDoc = {};

    // 1. Check and normalize country / region
    const existingCountry = (order.shippingAddress?.country || '').trim();
    const existingRegion = (order.shippingAddress?.countryOrRegion || '').trim();

    let resolvedCountry = existingCountry;
    if (!resolvedCountry || resolvedCountry.toLowerCase() === 'undefined' || resolvedCountry.toLowerCase() === 'null') {
      // Derive from address fields or default to Ethiopia (majority Ethiopian customer base)
      const combined = `${order.shippingAddress?.city || ''} ${order.shippingAddress?.state || ''} ${order.shippingAddress?.address || ''}`.toLowerCase();
      if (combined.includes('us') || combined.includes('united states') || combined.includes('california') || combined.includes('new york')) {
        resolvedCountry = 'United States';
      } else if (combined.includes('uk') || combined.includes('united kingdom') || combined.includes('london')) {
        resolvedCountry = 'United Kingdom';
      } else if (combined.includes('germany') || combined.includes('berlin')) {
        resolvedCountry = 'Germany';
      } else if (combined.includes('dubai') || combined.includes('uae') || combined.includes('emirates')) {
        resolvedCountry = 'United Arab Emirates';
      } else {
        resolvedCountry = 'Ethiopia';
      }
    }

    if (existingCountry !== resolvedCountry || !existingRegion) {
      updateDoc['shippingAddress.country'] = resolvedCountry;
      updateDoc['shippingAddress.countryOrRegion'] = resolvedCountry;
      needsUpdate = true;
      countryUpdates++;
    }

    // 2. Check and normalize paymentMethod
    const currentMethod = order.paymentMethod || 'Chapa';
    const normalizedMethod = normalizePaymentMethodLabel(currentMethod);
    if (currentMethod !== normalizedMethod) {
      updateDoc['paymentMethod'] = normalizedMethod;
      needsUpdate = true;
      paymentMethodUpdates++;
    }

    // 3. Populate refundedAt for refunded orders if missing
    if ((order.status === 'refunded' || order.paymentStatus === 'refunded') && !order.refundedAt) {
      const refundHistory = (order.statusHistory || []).find((h) => h.status === 'refunded');
      const refundDate = refundHistory?.timestamp || order.updatedAt || order.createdAt;
      updateDoc['refundedAt'] = refundDate;
      needsUpdate = true;
      refundDateUpdates++;
    }

    if (needsUpdate) {
      updatesToApply.push({
        orderId: order._id,
        orderNumber: order.orderNumber,
        changes: updateDoc,
      });
    }
  }

  console.log(`Summary of needed updates:`);
  console.log(`- Country / region updates: ${countryUpdates}`);
  console.log(`- Payment method label normalizations: ${paymentMethodUpdates}`);
  console.log(`- Refund date timestamps populated: ${refundDateUpdates}`);
  console.log(`- Total orders affected: ${updatesToApply.length}\n`);

  if (updatesToApply.length > 0) {
    console.log('Sample planned changes:');
    updatesToApply.slice(0, 5).forEach((u, i) => {
      console.log(`  [${i + 1}] Order ${u.orderNumber || u.orderId}:`, JSON.stringify(u.changes));
    });
    console.log('');
  }

  if (isApply) {
    console.log('Applying updates to database...');
    let appliedCount = 0;
    for (const update of updatesToApply) {
      await Order.updateOne({ _id: update.orderId }, { $set: update.changes });
      appliedCount++;
    }
    console.log(`✓ Successfully updated ${appliedCount} orders.`);
  } else {
    console.log('DRY RUN COMPLETE: No changes were written to the database.');
    console.log('To apply these changes, rerun with the --apply flag:');
    console.log('  node backend/scripts/backfillOrderCountryAndRegion.js --apply\n');
  }

  await mongoose.disconnect();
}

backfillOrders().catch((err) => {
  console.error('[Backfill Error]', err);
  process.exit(1);
});
