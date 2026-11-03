import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import User from '../models/userModel.js';
import Setting from '../models/settingModel.js';

export async function runMigration() {
  console.log('--- Starting NovaShop Admin & Settings Migration ---');

  // 1. Promote existing admin accounts to Owner safely
  const adminUsers = await User.find({ role: 'admin' });
  console.log(`Found ${adminUsers.length} admin accounts in database.`);

  for (const admin of adminUsers) {
    if (!admin.adminRole || admin.adminRole !== 'owner') {
      admin.adminRole = 'owner';
    }
    admin.status = 'active';
    admin.isActive = true;
    await admin.save({ validateBeforeSave: false });
    console.log(`  ✓ Confirmed owner role for: ${admin.email} (${admin.name})`);
  }

  // 2. Ensure Settings singleton exists and is seeded with real store data
  let settings = await Setting.findOne({ isSingleton: true });
  if (!settings) {
    settings = await Setting.getSingleton();
  }

  // Populate real approved store credentials
  settings.store.name = 'NovaShop';
  settings.store.legalName = 'NovaShop';
  settings.store.email = 'firaolsiraj17@gmail.com';
  settings.store.phone = '+2519536877';
  settings.store.orderPrefix = 'NS-';
  settings.store.storefrontAccess = 'Open';

  settings.address.country = 'Ethiopia';
  settings.address.region = 'Addis Ababa';
  settings.address.city = 'Addis Ababa';
  settings.address.street = 'Bole';
  settings.address.postalCode = '1102';

  settings.locale.timezone = 'Africa/Addis_Ababa';
  settings.locale.currency = 'USD';
  settings.locale.usdToEtbRate = Number(process.env.USD_TO_ETB_RATE) || 120;

  settings.tax.collectTax = true;
  settings.tax.includeTax = false; // Tax-exclusive (15% added at checkout)
  settings.tax.chargeShipping = true;
  settings.tax.defaultRate = 15;
  settings.tax.defaultTaxName = 'VAT';

  // Seed ONLY Ethiopia VAT 15% (no mock US/Canada/UK/EU rows)
  settings.tax.regions = [
    {
      id: 'eth-vat-1',
      region: 'Ethiopia',
      sub: 'National jurisdiction',
      taxName: 'VAT',
      countryCodes: ['ET'],
      subdivisionCodes: [],
      rate: 15,
      rateType: 'single',
      min: '15.00%',
      max: '15.00%',
      appliesToShipping: true,
      status: 'Active',
      countryCode: 'ET',
    },
  ];

  settings.notifications.teamNotificationEmail = 'sirajfira517@gmail.com';
  settings.notifications.customerEmails.senderName = 'NovaShop';
  settings.notifications.customerEmails.replyToEmail = 'firaolsiraj17@gmail.com';
  settings.notifications.customerEmails.orderConfirmation = true;
  settings.notifications.customerEmails.shippingConfirmation = true;
  settings.notifications.customerEmails.returnApproved = true;
  settings.notifications.customerEmails.refundIssued = true;

  settings.operational.freeShippingThreshold = 300;
  settings.operational.returnWindowDays = 14;
  settings.operational.lowStockThreshold = 5;
  settings.operational.supportHours = 'Monday – Friday, 8:30 AM – 5:30 PM EAT';
  settings.operational.supportMailbox = 'firaolsiraj17@gmail.com';

  settings.version = (settings.version || 1) + 1;
  await settings.save();

  console.log(`✓ Initialized and verified Settings singleton (version ${settings.version}).`);
  console.log('--- Migration Finished Successfully ---');
}

if (process.argv[1]?.endsWith('migrateAdminSettingsAndOwners.js')) {
  mongoose
    .connect(process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/novashop')
    .then(async () => {
      await runMigration();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err.message);
      process.exit(1);
    });
}
