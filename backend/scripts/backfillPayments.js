import '../src/config/env.js';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import Order from '../src/models/orderModel.js';
import paymentService from '../src/services/paymentService.js';

const isDryRun = process.argv.includes('--dry-run');

async function backfill() {
  console.log(`Starting Payment Backfill from Orders... (Mode: ${isDryRun ? 'DRY-RUN' : 'LIVE'})`);

  await connectDB();

  const result = await paymentService.backfillExistingOrders({ dryRun: isDryRun });

  console.log('Backfill results:', result);
  await mongoose.disconnect();
}

backfill().catch((err) => {
  console.error('Backfill script error:', err);
  process.exit(1);
});
