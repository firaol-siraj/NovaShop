import '../src/config/env.js';
import connectDB from '../src/config/db.js';
import { pollInboundEmailsOnce } from '../src/workers/supportEmailWorker.js';

async function main() {
  console.log('=== NovaShop Manual Inbound Support Email Poll ===');
  await connectDB();

  console.log('Starting single-shot poll...');
  const result = await pollInboundEmailsOnce();

  console.log('\n--- Poll Summary ---');
  console.log('Status:    ', result.status);
  console.log('Processed: ', result.processed);
  if (result.error) {
    console.log('Error:     ', result.error);
  }

  if (result.details && result.details.length > 0) {
    console.log('\n--- Outcome Per Message ---');
    for (const d of result.details) {
      console.log(`• UID ${d.uid}: [${d.status}] ${d.ticketNumber ? `Ticket: ${d.ticketNumber}` : ''} ${d.reason ? `Reason: ${d.reason}` : ''} ${d.error ? `Error: ${d.error}` : ''}`);
    }
  } else {
    console.log('No messages processed in this cycle.');
  }

  console.log('\nPoll completed.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal poll error:', err.message);
  process.exit(1);
});
