#!/usr/bin/env node
/**
 * Repair and Audit Script for NovaShop Discounts
 * Checks and fixes `firstOrderOnly` flag on discount documents.
 *
 * Usage:
 *   node scripts/repairDiscounts.js --dry-run
 *   node scripts/repairDiscounts.js --apply
 *   node scripts/repairDiscounts.js --code WELCOME10 --apply
 *   node scripts/repairDiscounts.js --all-welcome --apply
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const isApply = process.argv.includes('--apply');
const isDryRun = !isApply || process.argv.includes('--dry-run');

// Parse --code argument if provided
const codeArgIndex = process.argv.indexOf('--code');
const targetCode = codeArgIndex !== -1 && process.argv[codeArgIndex + 1]
  ? process.argv[codeArgIndex + 1].trim().toUpperCase()
  : null;

const allWelcome = process.argv.includes('--all-welcome') || !targetCode;

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    console.error('ERROR: MONGO_URL not defined in environment or .env');
    process.exit(1);
  }

  console.log(`Connecting to MongoDB at: ${mongoUrl.replace(/:[^:@]+@/, ':****@')}...`);
  await mongoose.connect(mongoUrl);

  const db = mongoose.connection.db;
  const discountsCol = db.collection('discounts');

  // Build filter
  let filter = {};
  if (targetCode) {
    filter.code = targetCode;
  } else if (allWelcome) {
    // Target any discount likely intended for first-time / welcome orders
    filter.$or = [
      { code: { $regex: /^(WELCOME|FIRST|NEW)/i } },
      { name: { $regex: /(welcome|first[- ]time|first[- ]order|new customer)/i } },
    ];
  }

  const matchedDiscounts = await discountsCol.find(filter).toArray();

  console.log('\n======================================================');
  console.log(`  DISCOUNT REPAIR AUDIT (${isDryRun ? 'DRY-RUN MODE' : 'LIVE APPLY MODE'})`);
  console.log('======================================================');
  console.log(`Matched ${matchedDiscounts.length} candidate discount(s):\n`);

  if (matchedDiscounts.length === 0) {
    console.log('No matching discounts found for the criteria.');
    await mongoose.disconnect();
    process.exit(0);
  }

  const updatesToApply = [];

  for (const disc of matchedDiscounts) {
    const isFirstOrder = Boolean(disc.firstOrderOnly);
    const shouldBeFirstOrder = true; // Candidates matching welcome/first-time criteria

    console.log(`- Code: "${disc.code}"`);
    console.log(`  ID: ${disc._id}`);
    console.log(`  Name: "${disc.name}"`);
    console.log(`  Status: ${disc.status}`);
    console.log(`  Current firstOrderOnly: ${isFirstOrder}`);
    console.log(`  Target firstOrderOnly: ${shouldBeFirstOrder}`);

    if (!isFirstOrder && shouldBeFirstOrder) {
      console.log(`  ACTION NEEDED: Set firstOrderOnly: true`);
      updatesToApply.push(disc._id);
    } else {
      console.log(`  STATUS: Already configured correctly`);
    }
    console.log('------------------------------------------------------');
  }

  if (updatesToApply.length === 0) {
    console.log('\nAll candidate discounts already have firstOrderOnly: true. No repairs needed.');
  } else if (isDryRun) {
    console.log(`\n[DRY-RUN] ${updatesToApply.length} discount(s) would be updated to firstOrderOnly: true.`);
    console.log('To apply these changes permanently, re-run with:');
    console.log('  node scripts/repairDiscounts.js --apply');
  } else {
    console.log(`\n[APPLY] Updating ${updatesToApply.length} discount(s) in database...`);
    const result = await discountsCol.updateMany(
      { _id: { $in: updatesToApply } },
      { $set: { firstOrderOnly: true, updatedAt: new Date() } }
    );
    console.log(`Successfully updated ${result.modifiedCount} discount(s).`);
  }

  await mongoose.disconnect();
  console.log('Done.\n');
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal error during repair:', err);
  process.exit(1);
});
