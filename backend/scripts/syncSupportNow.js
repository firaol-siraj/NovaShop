import '../src/config/env.js';
import connectDB from '../src/config/db.js';
import { syncSupportConversations } from '../src/migrations/syncSupportConversations.js';

async function main() {
  console.log('=== NovaShop Support Data Sync & Sanitization ===');
  await connectDB();
  await syncSupportConversations();
  console.log('Support sync completed successfully.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error during sync:', err);
  process.exit(1);
});
