import '../src/config/env.js';
import connectDB from '../src/config/db.js';
import mongoose from 'mongoose';
import AdminNotification from '../src/models/adminNotificationModel.js';
import Conversation from '../src/models/conversationModel.js';
import Message from '../src/models/messageModel.js';

export async function backfillNotifications({ apply = false } = {}) {
  console.log(`\n=== Backfill Support Notifications (${apply ? 'APPLY MODE' : 'DRY RUN'}) ===\n`);

  const notifications = await AdminNotification.find({
    $or: [
      { link: '/admin/support' },
      { link: { $regex: '^/admin/support($|[^?])' } },
      { 'data.ticketNumber': { $exists: true } },
      { title: { $regex: /ticket|support|inquiry/i } },
      { entityType: 'conversation' },
    ],
  });

  console.log(`Found ${notifications.length} candidate support notification(s) to inspect.\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  let notFoundCount = 0;

  for (const notif of notifications) {
    let conv = null;

    // 1. Try finding by entityId if valid ObjectId
    if (notif.entityId && mongoose.Types.ObjectId.isValid(notif.entityId)) {
      conv = await Conversation.findById(notif.entityId);
    }

    // 2. Try finding by data.conversationId
    if (!conv && notif.data?.conversationId && mongoose.Types.ObjectId.isValid(notif.data.conversationId)) {
      conv = await Conversation.findById(notif.data.conversationId);
    }

    // 3. Try finding by ticketNumber in data or title
    if (!conv) {
      const ticketNumber =
        notif.data?.ticketNumber ||
        notif.title.match(/(NS-TKT-\d+|TKT-\d+|#\d+)/i)?.[1]?.replace('#', '');
      if (ticketNumber) {
        conv = await Conversation.findOne({
          $or: [{ ticketNumber }, { ticketNumber: `NS-TKT-${ticketNumber}` }],
        });
      }
    }

    if (!conv) {
      console.log(`[SKIP - NOT FOUND] Notif ID: ${notif._id} | Title: "${notif.title}" (No matching conversation)`);
      notFoundCount++;
      continue;
    }

    // Find the primary or first message in the conversation
    const msg = await Message.findOne({ conversation: conv._id }).sort({ createdAt: 1 });
    const messageId = notif.data?.messageId || msg?._id?.toString() || '';
    const targetLink = `/admin/support?conversation=${conv._id.toString()}${messageId ? `#message=${messageId}` : ''}`;

    const needsUpdate =
      notif.link !== targetLink ||
      notif.entityType !== 'conversation' ||
      notif.entityId !== conv._id.toString() ||
      notif.data?.conversationId !== conv._id.toString();

    if (!needsUpdate) {
      skippedCount++;
      continue;
    }

    console.log(`[${apply ? 'APPLIED' : 'DRY RUN'}] Notif ID: ${notif._id}`);
    console.log(`  Title: "${notif.title}"`);
    console.log(`  Old Link: "${notif.link}" -> New Link: "${targetLink}"`);
    console.log(`  Old Entity: ${notif.entityType}:${notif.entityId} -> New: conversation:${conv._id}\n`);

    if (apply) {
      await AdminNotification.findByIdAndUpdate(notif._id, {
        link: targetLink,
        entityType: 'conversation',
        entityId: conv._id.toString(),
        $set: {
          'data.conversationId': conv._id.toString(),
          ...(messageId ? { 'data.messageId': messageId } : {}),
        },
      });
    }

    updatedCount++;
  }

  console.log('--- Summary ---');
  console.log(`Total Inspected: ${notifications.length}`);
  console.log(`To Update / Updated: ${updatedCount}`);
  console.log(`Already Correct: ${skippedCount}`);
  console.log(`Unmatched / Missing Conv: ${notFoundCount}`);
  console.log(`Mode: ${apply ? 'APPLIED CHANGES TO DB' : 'DRY RUN ONLY (Pass --apply to persist)'}\n`);

  return { total: notifications.length, updated: updatedCount, skipped: skippedCount, notFound: notFoundCount };
}

async function main() {
  const isApply = process.argv.includes('--apply') || process.argv.includes('--confirm');
  await connectDB();
  await backfillNotifications({ apply: isApply });
  process.exit(0);
}

if (process.argv[1]?.endsWith('backfillSupportNotifications.js')) {
  main().catch((err) => {
    console.error('Backfill script error:', err);
    process.exit(1);
  });
}
