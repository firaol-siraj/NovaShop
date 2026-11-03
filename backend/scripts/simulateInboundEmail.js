#!/usr/bin/env node
/**
 * Developer CLI tool to simulate inbound customer emails into NovaShop Support
 * Usage:
 *   1. Reply to existing ticket:
 *      node scripts/simulateInboundEmail.js --ticket NS-T-2041 --from customer@example.com --body "Thanks, that resolved it!"
 *
 *   2. Create brand-new inquiry from customer:
 *      node scripts/simulateInboundEmail.js --from newcustomer@example.com --subject "Inquiry about size M" --body "Is size M in stock?"
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

async function main() {
  const args = process.argv.slice(2);
  let ticket = null;
  let from = 'customer@example.com';
  let name = 'Customer Tester';
  let subject = 'Product sizing question';
  let body = 'Hello, can you verify when size M will be back in stock?';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ticket' && args[i + 1]) ticket = args[++i];
    else if (args[i] === '--from' && args[i + 1]) from = args[++i];
    else if (args[i] === '--name' && args[i + 1]) name = args[++i];
    else if (args[i] === '--subject' && args[i + 1]) subject = args[++i];
    else if (args[i] === '--body' && args[i + 1]) body = args[++i];
  }

  const finalSubject = ticket ? `Re: [${ticket.toUpperCase()}] ${subject}` : subject;
  const messageId = `<inbound-${Date.now()}@simulation.test>`;

  const payload = {
    from: `${name} <${from}>`,
    to: 'support@novashop.com',
    subject: finalSubject,
    text: body,
    html: `<p>${body}</p>`,
    messageId,
  };

  console.log('\n--- Simulating Inbound Customer Email ---');
  console.log(`Endpoint: ${BACKEND_URL}/api/v1/webhooks/inbound-email`);
  console.log(`From:     ${payload.from}`);
  console.log(`Subject:  ${payload.subject}`);
  console.log(`Body:     ${payload.text}`);
  console.log('----------------------------------------\n');

  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/webhooks/inbound-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    console.log('Response Status:', res.status);
    console.log('Response Data:', JSON.stringify(json, null, 2));

    if (res.ok) {
      console.log('\n✓ Simulation successful! Real-time notifications and ticket updates were broadcasted.');
    } else {
      console.error('\n✕ Simulation request returned error.');
    }
  } catch (err) {
    console.error('\n✕ Failed to connect to server at', BACKEND_URL, ':', err.message);
    console.log('\nEquivalent curl command you can run when server is up:');
    console.log(`curl -X POST "${BACKEND_URL}/api/v1/webhooks/inbound-email" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(payload)}'`);
  }
}

main();
