import '../src/config/env.js';
import connectDB from '../src/config/db.js';
import Order from '../src/models/orderModel.js';
import User from '../src/models/userModel.js';
import ReturnRequest from '../src/models/returnRequestModel.js';

async function seed() {
  await connectDB();

  console.log('[Seed] Seeding sample return requests...');

  const orders = await Order.find({ isPaid: true }).limit(2);
  if (orders.length === 0) {
    console.log('[Seed] No paid orders found to create returns for.');
    process.exit(0);
  }

  // Ensure delivered within 14-day window
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
  const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);

  const o1 = orders[0];
  o1.isDelivered = true;
  o1.deliveredAt = fourDaysAgo;
  o1.status = 'delivered';
  o1.returnRequested = true;
  await o1.save();

  const user1 = o1.user ? await User.findById(o1.user) : null;
  const name1 = user1?.name || o1.shippingAddress?.recipientName || 'Customer';
  const email1 = user1?.email || o1.customerEmail || 'customer@example.com';

  const item1 = o1.orderItems[0];
  const r1 = await ReturnRequest.findOneAndUpdate(
    { returnNumber: 'RT-2041' },
    {
      returnNumber: 'RT-2041',
      order: o1._id,
      orderNumber: o1.orderNumber || String(o1._id),
      user: o1.user,
      customerName: name1,
      customerEmail: email1,
      itemCount: 1,
      reason: 'Wrong size',
      resolution: 'Refund',
      status: 'requested',
      refundAmountUSD: item1.price * item1.qty,
      refundAmountETB: (item1.price * item1.qty) * (o1.usdToEtbRate || 120),
      refundMethod: 'Original payment method',
      tracking: 'Prepaid courier · Pickup scheduled',
      requestedAt: fourDaysAgo,
      customerNote: 'Runs slightly small around waistline. I would like to return it for a refund.',
      items: [
        {
          orderItemIndex: 0,
          product: item1.product,
          variant: item1.variant || null,
          productName: item1.name,
          variantName: item1.color || item1.size ? `${item1.color || ''} / ${item1.size || ''}` : '',
          sku: item1.sku || 'NS-ITEM-01',
          image: item1.image || '',
          qty: item1.qty || 1,
          unitPrice: item1.price,
          refundValue: item1.price * (item1.qty || 1),
          reason: 'Wrong size',
        },
      ],
      statusHistory: [
        {
          status: 'requested',
          at: fourDaysAgo,
          note: 'Customer initiated return request',
        },
      ],
      adminNotes: [
        {
          body: 'Customer requested a prepaid priority DHL label.',
          author: 'Admin',
          createdAt: new Date(),
        },
      ],
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`[Seed] Created return request: ${r1.returnNumber}`);

  if (orders.length > 1) {
    const o2 = orders[1];
    o2.isDelivered = true;
    o2.deliveredAt = sixDaysAgo;
    o2.status = 'delivered';
    o2.returnRequested = true;
    await o2.save();

    const user2 = o2.user ? await User.findById(o2.user) : null;
    const name2 = user2?.name || o2.shippingAddress?.recipientName || 'Customer';
    const email2 = user2?.email || o2.customerEmail || 'customer2@example.com';

    const item2 = o2.orderItems[0];
    const r2 = await ReturnRequest.findOneAndUpdate(
      { returnNumber: 'RT-2038' },
      {
        returnNumber: 'RT-2038',
        order: o2._id,
        orderNumber: o2.orderNumber || String(o2._id),
        user: o2.user,
        customerName: name2,
        customerEmail: email2,
        itemCount: 1,
        reason: 'Defective',
        resolution: 'Refund',
        status: 'approved',
        refundAmountUSD: item2.price * item2.qty,
        refundAmountETB: (item2.price * item2.qty) * (o2.usdToEtbRate || 120),
        refundMethod: 'Original payment method',
        tracking: 'Return label issued: ET-DHL-9921',
        requestedAt: sixDaysAgo,
        approvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        customerNote: 'Small stitching defect on the collar seam.',
        items: [
          {
            orderItemIndex: 0,
            product: item2.product,
            variant: item2.variant || null,
            productName: item2.name,
            variantName: item2.color || item2.size ? `${item2.color || ''} / ${item2.size || ''}` : '',
            sku: item2.sku || 'NS-ITEM-02',
            image: item2.image || '',
            qty: item2.qty || 1,
            unitPrice: item2.price,
            refundValue: item2.price * (item2.qty || 1),
            reason: 'Defective',
          },
        ],
        statusHistory: [
          {
            status: 'requested',
            at: sixDaysAgo,
            note: 'Customer initiated return request',
          },
          {
            status: 'approved',
            at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            note: 'Return request approved by admin',
          },
        ],
        adminNotes: [
          {
            body: 'Approved return for defective item. Waybill issued.',
            author: 'Admin',
            createdAt: new Date(),
          },
        ],
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`[Seed] Created return request: ${r2.returnNumber}`);
  }

  console.log('[Seed] Successfully seeded sample return requests!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed Error]:', err);
  process.exit(1);
});
