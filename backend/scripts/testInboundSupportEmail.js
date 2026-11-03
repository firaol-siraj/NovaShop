import '../src/config/env.js';
import connectDB from '../src/config/db.js';
import { getImapClient, pollInboundEmailsOnce } from '../src/workers/supportEmailWorker.js';

async function testInbound() {
  console.log('=== NovaShop Inbound Support Email Diagnostics ===');
  await connectDB();

  const client = getImapClient();
  if (!client) {
    console.log('IMAP Configuration: INCOMPLETE');
    console.log('Please ensure EMAIL_USER and EMAIL_PASS (or IMAP_USER / IMAP_PASS) are set in .env');
    process.exit(0);
  }

  console.log(`Testing IMAP connection to ${process.env.IMAP_HOST || 'imap.gmail.com'}:993...`);
  try {
    const result = await pollInboundEmailsOnce();
    console.log('Poll result:', result);
    console.log('Inbound check completed successfully.');
  } catch (err) {
    console.error('IMAP check error:', err.message);
  }

  process.exit(0);
}

testInbound();
