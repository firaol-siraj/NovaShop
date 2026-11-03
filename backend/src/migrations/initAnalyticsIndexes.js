import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import AnalyticsEvent from '../models/analyticsEventModel.js';
import Setting from '../models/settingModel.js';
import { DEFAULT_STORE_TIMEZONE } from '../utils/analyticsMetrics.js';

dotenv.config();

export async function runAnalyticsMigrations() {
  console.log('\n[Migration] Ensuring Analytics and Order aggregation indexes...');

  try {
    // 1. Order aggregation indexes
    await Order.syncIndexes();
    console.log('✓ Order indexes synchronized successfully');

    // 2. AnalyticsEvent indexes & TTL
    await AnalyticsEvent.syncIndexes();
    console.log('✓ AnalyticsEvent indexes and 180-day TTL synchronized successfully');

    // 3. Default Store Timezone setting
    const existingTz = await Setting.getSetting('storeTimezone');
    if (!existingTz) {
      await Setting.setSetting(
        'storeTimezone',
        DEFAULT_STORE_TIMEZONE,
        'Configured store timezone for analytics bucketing and heatmap distribution (default: Africa/Addis_Ababa)'
      );
      console.log(`✓ Initialized storeTimezone setting: ${DEFAULT_STORE_TIMEZONE}`);
    } else {
      console.log(`✓ Store timezone already configured: ${existingTz}`);
    }

    console.log('[Migration] All analytics indexes initialized successfully.\n');
  } catch (err) {
    console.error(`[Migration Error] Failed to initialize analytics indexes: ${err.message}`);
    throw err;
  }
}

// Allow direct CLI execution
if (process.argv[1]?.endsWith('initAnalyticsIndexes.js')) {
  (async () => {
    try {
      await mongoose.connect(process.env.MONGO_URL);
      await runAnalyticsMigrations();
      await mongoose.disconnect();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}
