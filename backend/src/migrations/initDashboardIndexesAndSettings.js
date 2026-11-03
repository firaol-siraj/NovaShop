import Order from '../models/orderModel.js';
import ProductVariant from '../models/productVariantModel.js';
import AdminNotification from '../models/adminNotificationModel.js';
import Setting from '../models/settingModel.js';
import logger from '../utils/logger.js';
import { DEFAULT_LOW_STOCK_THRESHOLD, TIMELY_DISPATCH_HOURS } from '../constants/orderConstants.js';
import { syncSupportConversations } from './syncSupportConversations.js';

/**
 * Runs migration to ensure indexes and initialize default settings for the Admin Dashboard.
 */
export async function initDashboardIndexesAndSettings() {
  try {
    // 1. Ensure indexes
    await Promise.all([
      Order.init(),
      ProductVariant.init(),
      AdminNotification.init(),
      Setting.init(),
    ]);

    // 2. Seed default settings if missing
    const existingThreshold = await Setting.findOne({ key: 'lowStockThreshold' });
    if (!existingThreshold) {
      await Setting.create({
        key: 'lowStockThreshold',
        value: DEFAULT_LOW_STOCK_THRESHOLD,
        description: 'Product variant stock count at or below which inventory alerts trigger',
      });
      logger.info(`[Dashboard Migration] Initialized lowStockThreshold setting: ${DEFAULT_LOW_STOCK_THRESHOLD}`);
    }

    const existingDispatchSla = await Setting.findOne({ key: 'timelyDispatchHours' });
    if (!existingDispatchSla) {
      await Setting.create({
        key: 'timelyDispatchHours',
        value: TIMELY_DISPATCH_HOURS,
        description: 'Hours from payment to dispatch considered timely fulfillment',
      });
      logger.info(`[Dashboard Migration] Initialized timelyDispatchHours setting: ${TIMELY_DISPATCH_HOURS}`);
    }

    // 3. Sync and sanitize support conversations (remove spam, clean email quote threads)
    await syncSupportConversations().catch((syncErr) => {
      logger.warn(`[Dashboard Migration] Support sync notice: ${syncErr.message}`);
    });

    logger.info('[Dashboard Migration] Dashboard indexes and settings successfully initialized.');
    return true;
  } catch (err) {
    logger.error(`[Dashboard Migration] Error during initialization: ${err.message}`);
    return false;
  }
}

export default initDashboardIndexesAndSettings;
