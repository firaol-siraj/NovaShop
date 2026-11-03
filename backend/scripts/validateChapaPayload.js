import { chapaService, sanitizeChapaText } from '../src/services/chapaService.js';

/**
 * Validation script to verify that Chapa transaction initialization payloads
 * strictly conform to Chapa API specification constraints:
 * - customization.title and customization.description may only contain letters, numbers,
 *   hyphens (-), underscores (_), spaces, and dots (.). Regex: /^[a-zA-Z0-9\-_. ]*$/
 * - first_name, last_name, and tx_ref must also contain only safe characters.
 */

const CHAPA_SAFE_REGEX = /^[a-zA-Z0-9\-_. ]*$/;

const testCases = [
  {
    name: 'Sample Order with Standard Values',
    order: {
      _id: '67b3f9b87a8b41982b683311',
      orderNumber: 'NS-667056574',
      totalPrice: 125.5,
      currency: 'USD',
    },
    customer: {
      firstName: 'Abebe',
      lastName: 'Bikila',
      email: 'abebe@example.com',
      phone: '+251911223344',
    },
  },
  {
    name: 'Order with Special Characters, Symbols, and Emojis',
    order: {
      _id: '67b3f9b87a8b41982b683312',
      orderNumber: 'Order #NS-9999/2026:Special & Sale ($100) 🔥👗',
      totalPrice: 89.99,
      currency: 'USD',
    },
    customer: {
      firstName: "John O'Connor, Jr.",
      lastName: 'Smith & Wesson (VIP)',
      name: "John O'Connor & Sons #1",
      email: 'john.smith@example.com',
      phone: '0911223344',
    },
  },
  {
    name: 'Order with Fallback Customer and Raw ID',
    order: {
      _id: '67b3f9b87a8b41982b683313',
      totalPrice: 45.0,
      currency: 'ETB',
    },
    customer: {
      name: 'Dr. Jane / Doe: Specialist',
      email: 'jane@example.com',
    },
  },
];

console.log('--- Testing Chapa Initialization Payload Sanitization ---');

let allPassed = true;

for (const tc of testCases) {
  console.log(`\nTesting: "${tc.name}"`);

  const payload = chapaService.buildInitializePayload({
    order: tc.order,
    customer: tc.customer,
    returnUrl: 'http://localhost:5173/checkout/confirmation?orderId=' + tc.order._id,
  });

  const fieldsToCheck = [
    { name: 'customization.title', val: payload.customization?.title },
    { name: 'customization.description', val: payload.customization?.description },
    { name: 'first_name', val: payload.first_name },
    { name: 'last_name', val: payload.last_name },
    { name: 'tx_ref', val: payload.tx_ref },
  ];

  for (const { name, val } of fieldsToCheck) {
    const isMatch = typeof val === 'string' && CHAPA_SAFE_REGEX.test(val);
    if (!isMatch) {
      console.error(`  ❌ FAILED: ${name} = "${val}" does NOT match regex ${CHAPA_SAFE_REGEX}`);
      allPassed = false;
    } else {
      console.log(`  ✓ PASSED: ${name} = "${val}" (Length: ${val.length})`);
    }
  }

  // Also verify amount and currency
  if (typeof payload.amount !== 'number' || isNaN(payload.amount) || payload.amount <= 0) {
    console.error(`  ❌ FAILED: amount = ${payload.amount} is invalid`);
    allPassed = false;
  } else {
    console.log(`  ✓ PASSED: amount = ${payload.amount} ${payload.currency}`);
  }
}

if (allPassed) {
  console.log('\n✅ All Chapa payload customization fields strictly match /^[a-zA-Z0-9\\-_. ]*$/');
  process.exit(0);
} else {
  console.error('\n❌ One or more fields failed validation.');
  process.exit(1);
}
