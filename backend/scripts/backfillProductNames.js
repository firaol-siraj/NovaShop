import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

import Order from '../src/models/orderModel.js';
import Product from '../src/models/productModel.js';

const isApply = process.argv.includes('--apply');

// Known truncated corrections
const KNOWN_NAME_FIXES = {
  'Solstice Linen Wrap Day Dres': 'Solstice Linen Wrap Day Dress',
};

async function run() {
  console.log('='.repeat(70));
  console.log(`BACKFILL PRODUCT NAMES IN ORDER SNAPSHOTS [Mode: ${isApply ? 'APPLY (Writing changes)' : 'DRY RUN (Read only)'}]`);
  console.log('='.repeat(70));

  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('Connected to MongoDB.\n');

    // 1. Inspect Products for known truncated names
    console.log('--- Step 1: Checking and correcting Product master records ---');
    const products = await Product.find({}).lean();
    const productMap = new Map();

    for (const prod of products) {
      let resolvedName = prod.name;
      if (KNOWN_NAME_FIXES[prod.name]) {
        resolvedName = KNOWN_NAME_FIXES[prod.name];
        if (!isApply) {
          console.log(`- Product #${prod._id} [DRY RUN]: Would rename "${prod.name}" -> "${resolvedName}"`);
        } else {
          await Product.updateOne({ _id: prod._id }, { $set: { name: resolvedName } });
          console.log(`- Product #${prod._id} [UPDATED]: Renamed "${prod.name}" -> "${resolvedName}"`);
        }
      }
      productMap.set(String(prod._id), resolvedName);
    }

    // 2. Inspect Order snapshots
    console.log('\n--- Step 2: Checking Order item snapshots against authoritative Product names ---');
    const orders = await Order.find({}).sort({ createdAt: 1 });
    let totalItemsChecked = 0;
    let itemsNeedingUpdate = 0;
    let itemsUpdated = 0;

    for (const order of orders) {
      let orderModified = false;
      const orderItems = order.orderItems || [];

      for (let i = 0; i < orderItems.length; i++) {
        totalItemsChecked++;
        const item = orderItems[i];
        const prodId = String(item.product);
        const authoritativeName = productMap.get(prodId) || (KNOWN_NAME_FIXES[item.name] ? KNOWN_NAME_FIXES[item.name] : null);

        if (authoritativeName && item.name !== authoritativeName) {
          itemsNeedingUpdate++;
          if (!isApply) {
            console.log(`- Order #${order.orderNumber || order._id} [DRY RUN]: Item #${i} "${item.name}" -> would update to "${authoritativeName}"`);
          } else {
            item.name = authoritativeName;
            orderModified = true;
            itemsUpdated++;
            console.log(`- Order #${order.orderNumber || order._id} [UPDATED]: Item #${i} renamed "${item.name}" -> "${authoritativeName}"`);
          }
        }
      }

      if (isApply && orderModified) {
        await order.save();
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('BACKFILL SUMMARY:');
    console.log(`  Total order items checked:    ${totalItemsChecked}`);
    console.log(`  Items needing name correction: ${itemsNeedingUpdate}`);
    console.log(`  Items updated:                ${itemsUpdated} (Mode: ${isApply ? 'APPLY' : 'DRY RUN'})`);
    console.log('='.repeat(70));

    if (!isApply && itemsNeedingUpdate > 0) {
      console.log('\nTo apply these corrections to the database, run:');
      console.log('  node backend/scripts/backfillProductNames.js --apply\n');
    }

  } catch (err) {
    console.error('Fatal error during backfill:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

run();
