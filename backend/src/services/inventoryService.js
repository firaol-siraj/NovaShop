import mongoose from 'mongoose';
import Product from '../models/productModel.js';
import ProductVariant from '../models/productVariantModel.js';
import InventoryMovement from '../models/inventoryMovementModel.js';
import AdminNotification from '../models/adminNotificationModel.js';
import Setting from '../models/settingModel.js';
import { clearCachePattern } from '../utils/clearCache.js';
import logger from '../utils/logger.js';
export { getProductStockStatus, analyzeVariantStock } from '../utils/stockUtils.js';

export const getGlobalLowStockThreshold = async () => {
  try {
    const threshold = await Setting.getSetting('lowStockThreshold', 5);
    const parsed = Number(threshold);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 5;
  } catch (err) {
    logger.error(`Failed to read lowStockThreshold setting: ${err.message}`);
    return 5;
  }
};

/**
 * Executes an operation within a database transaction if supported by the MongoDB cluster/topology,
 * with seamless fallback for standalone/test environments.
 */
export const withTransaction = async (operation) => {
  const isReplicaSet = Boolean(
    mongoose.connection?.client?.topology?.description?.type?.includes('ReplicaSet') ||
    (mongoose.connection?.client?.topology?.description?.servers &&
      mongoose.connection.client.topology.description.servers.size > 1)
  );

  if (!isReplicaSet) {
    return await operation(null);
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await operation(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (_) {}

    const errMsg = `${err?.message || ''} ${err?.errorResponse?.message || ''} ${err?.errorResponse?.errmsg || ''} ${err?.originalError?.message || ''}`;
    if (
      errMsg.includes('Transaction numbers are only allowed on a replica set member') ||
      errMsg.includes('does not support retryable writes') ||
      errMsg.includes('replica set member or mongos')
    ) {
      return await operation(null);
    }
    throw err;
  } finally {
    try {
      await session.endSession();
    } catch (_) {}
  }
};

/**
 * Records an inventory movement audit entry.
 */
export const recordMovement = async ({
  variantId,
  productId,
  type,
  quantityChange,
  stockBefore,
  stockAfter,
  reason,
  adminId = null,
  orderId = null,
  orderNumber = '',
  session = null,
}) => {
  const options = session ? { session } : {};
  const [movement] = await InventoryMovement.create(
    [
      {
        variant: variantId,
        product: productId,
        type,
        quantityChange,
        stockBefore,
        stockAfter,
        reason,
        admin: adminId,
        order: orderId,
        orderNumber,
      },
    ],
    options
  );
  return movement;
};

/**
 * Evaluates low-stock thresholds with notification deduplication:
 * - Emits notification only once when crossing into low/critical stock.
 * - Resets flag when stock recovers above threshold, allowing future notification if it drops again.
 */
export const checkAndTriggerLowStockAlert = async (variant, session = null) => {
  if (!variant) return;

  const globalThreshold = await getGlobalLowStockThreshold();
  const effectiveThreshold =
    variant.lowStockThreshold != null && Number.isInteger(variant.lowStockThreshold)
      ? variant.lowStockThreshold
      : globalThreshold;

  const available = Math.max(0, (variant.stock || 0) - (variant.reserved || 0));

  if (available <= effectiveThreshold) {
    if (!variant.isLowStockAlerted) {
      const isCritical = available <= Math.ceil(effectiveThreshold / 2) || available === 0;
      const title =
        available === 0
          ? `Out of Stock: ${variant.sku}`
          : isCritical
          ? `Critical Stock: ${variant.sku}`
          : `Low Stock: ${variant.sku}`;

      const message =
        available === 0
          ? `Variant ${variant.sku} is completely out of stock.`
          : `Variant ${variant.sku} has ${available} unit(s) available (threshold: ${effectiveThreshold}).`;

      try {
        const settingsDoc = await Setting.getSingleton();
        const eventPrefs = settingsDoc?.notifications?.eventPreferences?.inventory;
        const inAppEnabled = eventPrefs?.inApp !== false;
        const emailEnabled = eventPrefs?.email === true;

        const notifOptions = session ? { session } : {};
        if (inAppEnabled) {
          await AdminNotification.create(
            [
              {
                type: 'low_stock',
                title,
                message,
                entityType: 'variant',
                entityId: variant._id.toString(),
                link: `/admin/inventory?search=${encodeURIComponent(variant.sku || '')}`,
                data: {
                  variantId: variant._id,
                  productId: variant.product,
                  sku: variant.sku,
                  stock: variant.stock,
                  reserved: variant.reserved || 0,
                  available,
                  threshold: effectiveThreshold,
                },
              },
            ],
            notifOptions
          );
        }

        if (emailEnabled && settingsDoc?.notifications?.teamNotificationEmail) {
          // Send notification email to configured team inbox
          const sendEmailModule = await import('../utils/sendEmail.js');
          await sendEmailModule.default({
            to: settingsDoc.notifications.teamNotificationEmail,
            subject: `[NovaShop Alert] ${title}`,
            text: message,
            type: 'transactional',
          }).catch(err => logger.warn(`[InventoryService] Alert email failed: ${err.message}`));
        }
      } catch (err) {
        logger.error(`Failed to create low stock notification for variant ${variant.sku}: ${err.message}`);
      }

      variant.isLowStockAlerted = true;
      if (typeof variant.save === 'function') {
        await variant.save({ session });
      } else {
        await ProductVariant.findByIdAndUpdate(variant._id, { isLowStockAlerted: true }, { session });
      }
    }
  } else {
    // Stock has recovered above threshold: reset deduplication flag
    if (variant.isLowStockAlerted) {
      variant.isLowStockAlerted = false;
      if (typeof variant.save === 'function') {
        await variant.save({ session });
      } else {
        await ProductVariant.findByIdAndUpdate(variant._id, { isLowStockAlerted: false }, { session });
      }
    }
  }
};

/**
 * Re-derives parent product.countInStock from variant stock.
 */
export const syncProductStock = async (productId, session = null) => {
  const options = session ? { session } : {};
  const variants = await ProductVariant.find({ product: productId }, null, options);
  const totalStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

  await Product.findByIdAndUpdate(
    productId,
    { countInStock: totalStock },
    options
  );
  await clearCachePattern('products');
  return totalStock;
};

/**
 * Atomically adjusts stock for a variant and writes an audit movement.
 */
export const adjustVariantStock = async ({
  variantId,
  mode = 'delta', // 'set' | 'delta'
  value,
  reason,
  adminId = null,
  type = 'adjustment',
}) => {
  return withTransaction(async (session) => {
    const options = session ? { session } : {};
    const variant = await ProductVariant.findById(variantId, null, options);
    if (!variant) {
      throw new Error('Variant not found');
    }

    const stockBefore = variant.stock;
    const numValue = Number(value);
    if (isNaN(numValue)) {
      throw new Error('Adjustment value must be a valid number');
    }

    const stockAfter = mode === 'set' ? Math.round(numValue) : stockBefore + Math.round(numValue);
    if (stockAfter < 0) {
      throw new Error(`Stock cannot be negative. Current stock is ${stockBefore}, requested change yields ${stockAfter}.`);
    }

    const quantityChange = stockAfter - stockBefore;
    if (quantityChange === 0) {
      return { variant, movement: null };
    }

    variant.stock = stockAfter;
    await variant.save({ session });

    const movementType = type || (quantityChange > 0 ? 'restock' : 'adjustment');
    const movement = await recordMovement({
      variantId: variant._id,
      productId: variant.product,
      type: movementType,
      quantityChange,
      stockBefore,
      stockAfter,
      reason: reason || 'Manual stock adjustment by admin',
      adminId,
      session,
    });

    await checkAndTriggerLowStockAlert(variant, session);
    await syncProductStock(variant.product, session);

    return { variant, movement };
  });
};

/**
 * Atomically marks an order's items as sold, decrements stock, records movement, and updates parent products.
 */
export const recordOrderSaleMovements = async (order, session = null) => {
  if (!order || !order.orderItems || !order.orderItems.length) return;
  const options = session ? { session } : {};

  for (const item of order.orderItems) {
    if (!item.variant) continue;

    const variant = await ProductVariant.findById(item.variant, null, options);
    if (!variant) continue;

    const stockBefore = variant.stock;
    const itemQty = Number(item.qty) || 1;
    const stockAfter = Math.max(0, stockBefore - itemQty);
    const quantityChange = -(stockBefore - stockAfter);

    variant.stock = stockAfter;
    if (order.isStockReserved && variant.reserved >= itemQty) {
      variant.reserved = Math.max(0, variant.reserved - itemQty);
    }
    await variant.save({ session });

    await recordMovement({
      variantId: variant._id,
      productId: variant.product,
      type: 'sale',
      quantityChange,
      stockBefore,
      stockAfter,
      reason: `Sale for order #${order.orderNumber || order._id}`,
      orderId: order._id,
      orderNumber: order.orderNumber || '',
      session,
    });

    await checkAndTriggerLowStockAlert(variant, session);
    await syncProductStock(variant.product, session);
  }
};

/**
 * Restores stock for cancelled or refunded orders with an InventoryMovement audit trail.
 */
export const restoreOrderStockMovements = async (
  order,
  movementType = 'cancel_restore',
  reason = '',
  session = null
) => {
  if (!order || !order.orderItems || !order.orderItems.length) return;
  const options = session ? { session } : {};

  for (const item of order.orderItems) {
    if (!item.variant) continue;

    const variant = await ProductVariant.findById(item.variant, null, options);
    if (!variant) continue;

    const stockBefore = variant.stock;
    const itemQty = Number(item.qty) || 1;
    const stockAfter = stockBefore + itemQty;

    variant.stock = stockAfter;
    await variant.save({ session });

    await recordMovement({
      variantId: variant._id,
      productId: variant.product,
      type: movementType,
      quantityChange: itemQty,
      stockBefore,
      stockAfter,
      reason: reason || `Restored stock from order #${order.orderNumber || order._id}`,
      orderId: order._id,
      orderNumber: order.orderNumber || '',
      session,
    });

    await checkAndTriggerLowStockAlert(variant, session);
    await syncProductStock(variant.product, session);
  }
};
