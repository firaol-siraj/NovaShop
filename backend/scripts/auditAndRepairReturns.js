import '../src/config/env.js';
import connectDB from '../src/config/db.js';
import User from '../src/models/userModel.js';
import Order from '../src/models/orderModel.js';
import Product from '../src/models/productModel.js';
import ProductVariant from '../src/models/productVariantModel.js';
import ReturnRequest from '../src/models/returnRequestModel.js';

const isConfirm = process.argv.includes('--confirm');

async function auditAndRepair() {
  try {
    await connectDB();
    console.log('='.repeat(90));
    console.log(`NOVASHOP RETURN REQUESTS INTEGRITY AUDIT [${isConfirm ? 'CONFIRM REPAIR' : 'DRY-RUN REPORT'}]`);
    console.log('='.repeat(90));

    const returns = await ReturnRequest.find({}).sort({ createdAt: -1 });
    console.log(`Auditing ${returns.length} ReturnRequest documents against linked Orders, Users & Payments...\n`);

    const diffs = [];
    const repairPlans = [];

    for (const r of returns) {
      const order = await Order.findById(r.order);
      if (!order) {
        diffs.push({
          returnNumber: r.returnNumber,
          field: 'order',
          currentVal: String(r.order || 'null'),
          authoritativeVal: 'MISSING ORDER',
          issue: 'Orphaned return: linked order document not found',
        });
        continue;
      }

      let realUser = null;
      if (order.user) {
        realUser = await User.findById(order.user);
      }
      if (!realUser && r.user) {
        realUser = await User.findById(r.user);
      }

      const expectedName = (realUser?.name || order.shippingAddress?.recipientName || 'Customer').trim();
      const expectedEmail = (realUser?.email || order.customerEmail || '').toLowerCase().trim();
      const expectedPhone = (realUser?.phone || order.shippingAddress?.phone || '').trim();
      const expectedOrderNumber = order.orderNumber || String(order._id);

      let recordNeedsRepair = false;

      // 1. Customer Name Check
      if (expectedName && r.customerName && r.customerName.trim().toLowerCase() !== expectedName.toLowerCase()) {
        diffs.push({
          returnNumber: r.returnNumber,
          field: 'customerName',
          currentVal: r.customerName,
          authoritativeVal: expectedName,
          issue: 'Customer name does not match linked user/order',
        });
        recordNeedsRepair = true;
      }

      // 2. Customer Email Check
      if (expectedEmail && r.customerEmail && r.customerEmail.trim().toLowerCase() !== expectedEmail) {
        diffs.push({
          returnNumber: r.returnNumber,
          field: 'customerEmail',
          currentVal: r.customerEmail,
          authoritativeVal: expectedEmail,
          issue: 'Customer email does not match linked user/order',
        });
        recordNeedsRepair = true;
      }

      // 3. Order Number Check
      if (r.orderNumber && r.orderNumber !== expectedOrderNumber) {
        diffs.push({
          returnNumber: r.returnNumber,
          field: 'orderNumber',
          currentVal: r.orderNumber,
          authoritativeVal: expectedOrderNumber,
          issue: 'Order number does not match linked order document',
        });
        recordNeedsRepair = true;
      }

      // 4. Items, Quantity, Unit Price Check against Order Items
      let calculatedRefundUSD = 0;
      for (const item of r.items || []) {
        const orderItem = (order.orderItems || []).find(
          (oi) =>
            (oi.sku && item.sku && oi.sku === item.sku) ||
            (oi.product && item.product && String(oi.product._id || oi.product) === String(item.product._id || item.product)) ||
            (oi.name && item.productName && oi.name.toLowerCase() === item.productName.toLowerCase())
        );

        if (!orderItem) {
          diffs.push({
            returnNumber: r.returnNumber,
            field: `item:${item.sku || item.productName}`,
            currentVal: item.productName,
            authoritativeVal: 'NOT IN ORDER',
            issue: 'Returned item was not found in linked order',
          });
          recordNeedsRepair = true;
        } else {
          // Check unit price
          if (item.unitPrice !== undefined && orderItem.price !== undefined && Math.abs(item.unitPrice - orderItem.price) > 0.01) {
            diffs.push({
              returnNumber: r.returnNumber,
              field: `unitPrice:${item.sku || item.productName}`,
              currentVal: `$${item.unitPrice}`,
              authoritativeVal: `$${orderItem.price}`,
              issue: 'Item unit price does not match order item price',
            });
            recordNeedsRepair = true;
          }

          // Check quantity
          if (item.qty > orderItem.qty) {
            diffs.push({
              returnNumber: r.returnNumber,
              field: `quantity:${item.sku || item.productName}`,
              currentVal: item.qty,
              authoritativeVal: `Max ${orderItem.qty}`,
              issue: 'Return quantity exceeds purchased order quantity',
            });
            recordNeedsRepair = true;
          }

          calculatedRefundUSD += (orderItem.price || item.unitPrice || 0) * (item.qty || 1);
        }
      }

      // 5. Refund Amount Check
      if (r.refundAmountUSD > order.totalPrice + 0.01) {
        diffs.push({
          returnNumber: r.returnNumber,
          field: 'refundAmountUSD',
          currentVal: `$${r.refundAmountUSD}`,
          authoritativeVal: `Order Total: $${order.totalPrice}`,
          issue: 'Refund amount exceeds entire order total',
        });
        recordNeedsRepair = true;
      }

      if (recordNeedsRepair) {
        repairPlans.push({
          doc: r,
          expectedName,
          expectedEmail,
          expectedOrderNumber,
          userId: realUser?._id || order.user,
        });
      }
    }

    if (diffs.length === 0) {
      console.log('✓ AUDIT PASSED: All return records match their linked orders, users and items perfectly.');
    } else {
      console.log(`Found ${diffs.length} discrepancy(ies) across return records:\n`);
      console.table(
        diffs.map((d) => ({
          'Return #': d.returnNumber,
          Field: d.field,
          'Current Value': d.currentVal,
          'Authoritative (Order/User)': d.authoritativeVal,
          Discrepancy: d.issue,
        }))
      );

      if (isConfirm) {
        console.log('\nApplying repairs to ReturnRequest documents only (orders, payments and users are untouched)...');
        let repaired = 0;
        for (const plan of repairPlans) {
          const r = plan.doc;
          r.customerName = plan.expectedName;
          r.customerEmail = plan.expectedEmail;
          r.orderNumber = plan.expectedOrderNumber;
          if (plan.userId) {
            r.user = plan.userId;
          }
          await r.save();
          repaired++;
          console.log(`✓ Repaired return ${r.returnNumber}: synced customer "${plan.expectedName}" <${plan.expectedEmail}>`);
        }
        console.log(`\nSuccessfully repaired ${repaired} ReturnRequest record(s).`);
      } else {
        console.log('\n[DRY RUN ONLY]: Database was NOT modified.');
        console.log('To execute the repair, run with: node backend/scripts/auditAndRepairReturns.js --confirm');
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Audit failed:', err);
    process.exit(1);
  }
}

auditAndRepair();
