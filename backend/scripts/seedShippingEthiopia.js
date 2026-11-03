import '../src/config/env.js';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import { ShippingZone, ShippingMethod, ShippingRate } from '../src/models/shippingModel.js';
import Setting from '../src/models/settingModel.js';
import { SHIPPING_STATUSES, SHIPPING_RATE_TYPES } from '../src/constants/shippingConstants.js';

const isDryRun = process.argv.includes('--dry-run');

async function seedShipping() {
  console.log(`Starting Shipping Seed & Migration... (Mode: ${isDryRun ? 'DRY-RUN' : 'LIVE EXECUTION'})`);

  await connectDB();

  if (isDryRun) {
    console.log('[DRY-RUN] Would remove legacy mock zones and seed real Ethiopian shipping zones.');
    const existingZones = await ShippingZone.find();
    console.log(`[DRY-RUN] Existing zones in database: ${existingZones.length}`);
    await mongoose.disconnect();
    return;
  }

  // Clear existing mock zones and rates
  await ShippingRate.deleteMany({});
  await ShippingMethod.deleteMany({});
  await ShippingZone.deleteMany({});

  console.log('Cleared existing shipping zones, methods, and rates.');

  // 1. Zone: Addis Ababa Metro
  const addisZone = await ShippingZone.create({
    name: 'Addis Ababa Metro',
    countries: ['Ethiopia'],
    regions: ['Addis Ababa'],
    status: SHIPPING_STATUSES.ACTIVE,
    freeOverThresholdUSD: 300,
    sortOrder: 1,
    handlingTime: '1 business day',
  });

  const addisStandard = await ShippingMethod.create({
    name: 'Standard Courier (Addis Ababa)',
    description: 'Direct courier delivery to your doorstep within Addis Ababa',
    zone: addisZone._id,
    carrier: 'NovaShop Courier Fleet',
    rateStructure: 'Flat rate',
    status: SHIPPING_STATUSES.ACTIVE,
    estimatedMinDays: 1,
    estimatedMaxDays: 2,
    estimatedDeliveryNote: 'business days',
    sortOrder: 1,
  });

  await ShippingRate.create({
    method: addisStandard._id,
    zone: addisZone._id,
    rateType: SHIPPING_RATE_TYPES.FLAT,
    amountUSD: 1.25,
    amountETB: 150,
    freeOverThresholdUSD: 300,
  });

  const addisExpress = await ShippingMethod.create({
    name: 'Express Same-Day Delivery',
    description: 'Priority courier dispatch for orders placed before 2:00 PM',
    zone: addisZone._id,
    carrier: 'NovaShop Express Courier',
    rateStructure: 'Flat rate',
    status: SHIPPING_STATUSES.ACTIVE,
    estimatedMinDays: 1,
    estimatedMaxDays: 1,
    estimatedDeliveryNote: 'day',
    sortOrder: 2,
  });

  await ShippingRate.create({
    method: addisExpress._id,
    zone: addisZone._id,
    rateType: SHIPPING_RATE_TYPES.FLAT,
    amountUSD: 2.50,
    amountETB: 300,
  });

  // 2. Zone: Regional Ethiopia
  const regionalZone = await ShippingZone.create({
    name: 'Regional Ethiopia',
    countries: ['Ethiopia'],
    regions: [
      'Oromia',
      'Amhara',
      'Sidama',
      'SNNPR',
      'Tigray',
      'Dire Dawa',
      'Harari',
      'Somali',
      'Afar',
      'Benishangul-Gumuz',
      'Gambela',
    ],
    status: SHIPPING_STATUSES.ACTIVE,
    freeOverThresholdUSD: 300,
    sortOrder: 2,
    handlingTime: '1–2 business days',
  });

  const regionalStandard = await ShippingMethod.create({
    name: 'Regional Post & Courier',
    description: 'Reliable ground delivery to all regional cities across Ethiopia',
    zone: regionalZone._id,
    carrier: 'Ethio Post & Local Logistics',
    rateStructure: 'Flat rate',
    status: SHIPPING_STATUSES.ACTIVE,
    estimatedMinDays: 2,
    estimatedMaxDays: 4,
    estimatedDeliveryNote: 'business days',
    sortOrder: 1,
  });

  await ShippingRate.create({
    method: regionalStandard._id,
    zone: regionalZone._id,
    rateType: SHIPPING_RATE_TYPES.FLAT,
    amountUSD: 2.10,
    amountETB: 250,
    freeOverThresholdUSD: 300,
  });

  const regionalExpress = await ShippingMethod.create({
    name: 'Expedited Regional Courier',
    description: 'Fast air/ground courier transport to major regional hubs',
    zone: regionalZone._id,
    carrier: 'DHL Domestic Express',
    rateStructure: 'Flat rate',
    status: SHIPPING_STATUSES.ACTIVE,
    estimatedMinDays: 1,
    estimatedMaxDays: 2,
    estimatedDeliveryNote: 'business days',
    sortOrder: 2,
  });

  await ShippingRate.create({
    method: regionalExpress._id,
    zone: regionalZone._id,
    rateType: SHIPPING_RATE_TYPES.FLAT,
    amountUSD: 5.00,
    amountETB: 600,
  });

  // 3. Zone: International Delivery
  const intlZone = await ShippingZone.create({
    name: 'International Express',
    countries: ['United States', 'United Kingdom', 'Canada', 'United Arab Emirates', 'Kenya', 'Germany', 'France'],
    regions: [],
    status: SHIPPING_STATUSES.ACTIVE,
    freeOverThresholdUSD: 500,
    sortOrder: 3,
    handlingTime: '2 business days',
  });

  const intlExpress = await ShippingMethod.create({
    name: 'DHL Worldwide Express',
    description: 'International door-to-door express air delivery with tracking',
    zone: intlZone._id,
    carrier: 'DHL Express International',
    rateStructure: 'Flat rate',
    status: SHIPPING_STATUSES.ACTIVE,
    estimatedMinDays: 3,
    estimatedMaxDays: 6,
    estimatedDeliveryNote: 'business days',
    sortOrder: 1,
  });

  await ShippingRate.create({
    method: intlExpress._id,
    zone: intlZone._id,
    rateType: SHIPPING_RATE_TYPES.FLAT,
    amountUSD: 35.00,
    amountETB: 4200,
    freeOverThresholdUSD: 500,
  });

  // Set unified free shipping threshold setting ($300)
  await Setting.findOneAndUpdate(
    { key: 'free_shipping_threshold' },
    { value: '300', group: 'shipping', description: 'Store-wide free shipping order subtotal threshold in USD' },
    { upsert: true }
  );

  await Setting.findOneAndUpdate(
    { key: 'shipping_origin_address' },
    { value: 'NovaShop Logistics Center, Bole Sub-City, Addis Ababa, Ethiopia', group: 'shipping' },
    { upsert: true }
  );

  console.log('Successfully seeded 3 Shipping Zones, 5 Shipping Methods, and 5 Shipping Rates.');
  await mongoose.disconnect();
}

seedShipping().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
