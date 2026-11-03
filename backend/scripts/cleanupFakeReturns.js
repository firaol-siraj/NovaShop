import '../src/config/env.js';
import connectDB from '../src/config/db.js';
import ReturnRequest from '../src/models/returnRequestModel.js';
import Order from '../src/models/orderModel.js';
import User from '../src/models/userModel.js';

const isConfirm = process.argv.includes('--confirm');
const isDryRun = !isConfirm || process.argv.includes('--dry-run');

async function runCleanup() {
  try {
    await connectDB();
    console.log('='.repeat(80));
    console.log(`NOVASHOP RETURNS AUDIT & CLEANUP SCRIPT [${isConfirm ? 'CONFIRM MODE' : 'DRY-RUN MODE'}]`);
    console.log('='.repeat(80));

    const returns = await ReturnRequest.find({}).sort({ createdAt: -1 });
    console.log(`Auditing ${returns.length} return records...\n`);

    const auditResults = [];
    let inconsistentCount = 0;

    for (const ret of returns) {
      const order = await Order.findById(ret.order);
      let realUser = null;

      if (order?.user) {
        realUser = await User.findById(order.user);
      } else if (ret.user) {
        realUser = await User.findById(ret.user);
      }

      const authoritativeName = (
        realUser?.name ||
        order?.shippingAddress?.recipientName ||
        ret.customerName ||
        'Customer'
      ).trim();

      const authoritativeEmail = (
        realUser?.email ||
        order?.customerEmail ||
        ret.customerEmail ||
        ''
      ).toLowerCase().trim();

      const isEmailFakeOrMismatched =
        ret.customerEmail?.toLowerCase() === 'amelia.chen@example.com' ||
        ret.customerEmail?.toLowerCase() === 'james.okafor@example.com' ||
        (authoritativeEmail && ret.customerEmail?.toLowerCase() !== authoritativeEmail);

      const isNameMismatched =
        authoritativeName &&
        ret.customerName &&
        ret.customerName.toLowerCase() !== authoritativeName.toLowerCase();

      const isInconsistent = isEmailFakeOrMismatched || isNameMismatched;

      if (isInconsistent) {
        inconsistentCount++;
      }

      auditResults.push({
        returnId: ret.returnNumber,
        orderId: ret.orderNumber || order?.orderNumber || String(ret.order),
        current: `${ret.customerName} <${ret.customerEmail}>`,
        authoritative: `${authoritativeName} <${authoritativeEmail}>`,
        status: ret.status,
        isInconsistent,
        record: ret,
        authoritativeName,
        authoritativeEmail,
        orderUserId: realUser?._id || order?.user || ret.user,
      });
    }

    // Display formatted table
    console.table(
      auditResults.map((r) => ({
        'Return #': r.returnId,
        'Order #': r.orderId,
        'Current Snapshot': r.current,
        'Real Customer': r.authoritative,
        Inconsistent: r.isInconsistent ? 'YES (FIX NEEDED)' : 'NO (VALID)',
        Action: r.isInconsistent
          ? isConfirm
            ? 'REPAIRED'
            : 'WOULD REPAIR'
          : 'KEEP AS-IS',
      }))
    );

    console.log('\nAudit Summary:');
    console.log(`- Total Returns Checked: ${returns.length}`);
    console.log(`- Inconsistent / Fake Snapshots Found: ${inconsistentCount}`);

    if (inconsistentCount > 0) {
      if (isConfirm) {
        console.log('\nExecuting repair on inconsistent return records...');
        let updatedCount = 0;
        for (const item of auditResults) {
          if (item.isInconsistent) {
            item.record.customerName = item.authoritativeName;
            item.record.customerEmail = item.authoritativeEmail;
            if (item.orderUserId) {
              item.record.user = item.orderUserId;
            }
            await item.record.save();
            updatedCount++;
            console.log(`✓ Repaired return ${item.returnId} -> ${item.authoritativeName} <${item.authoritativeEmail}>`);
          }
        }
        console.log(`\nSuccessfully repaired ${updatedCount} return records without modifying orders, payments, or customers.`);
      } else {
        console.log('\n[DRY RUN ONLY] No changes were written to the database.');
        console.log('To apply repairs, re-run with: node backend/scripts/cleanupFakeReturns.js --confirm');
      }
    } else {
      console.log('All return records are consistent with real user accounts and order snapshots. No repairs required.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Audit failed with error:', err);
    process.exit(1);
  }
}

runCleanup();
