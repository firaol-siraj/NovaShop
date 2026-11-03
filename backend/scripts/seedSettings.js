import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Setting from '../src/models/settingModel.js';

export const REAL_SETTINGS_SEED = {
  version: 1,
  store: {
    name: 'NovaShop',
    legalName: 'NovaShop',
    email: 'firaolsiraj17@gmail.com',
    phone: '+2519536877',
    orderPrefix: 'NS-',
    storefrontAccess: 'Open',
    password: '',
  },
  address: {
    country: 'Ethiopia',
    region: 'Addis Ababa',
    city: 'Addis Ababa',
    street: 'Bole',
    postalCode: '1102',
  },
  locale: {
    timezone: 'Africa/Addis_Ababa',
    currency: 'USD',
    usdToEtbRate: Number(process.env.USD_TO_ETB_RATE) || 120,
    dateFormat: 'YYYY-MM-DD',
  },
  tax: {
    collectTax: true,
    includeTax: false, // 15% VAT added on top at checkout
    chargeShipping: true,
    defaultRate: 15.0,
    defaultTaxName: 'VAT',
    regions: [
      {
        id: 'eth-vat-1',
        region: 'Ethiopia',
        sub: 'National jurisdiction',
        taxName: 'VAT',
        countryCodes: ['ET'],
        subdivisionCodes: [],
        rate: 15.0,
        rateType: 'single',
        min: '15.00%',
        max: '15.00%',
        appliesToShipping: true,
        status: 'Active',
        countryCode: 'ET',
      },
    ],
  },
  notifications: {
    teamNotificationEmail: 'sirajfira517@gmail.com',
    customerEmails: {
      senderName: 'NovaShop',
      replyToEmail: 'firaolsiraj17@gmail.com',
      orderConfirmation: true,
      shippingConfirmation: true,
      returnApproved: true,
      refundIssued: true,
    },
    eventPreferences: {
      orders: { email: true, inApp: true },
      returns: { email: true, inApp: false },
      inventory: { email: true, inApp: true },
      customerAccounts: { email: false, inApp: true },
      paymentDisputes: { email: true, inApp: true },
    },
  },
  operational: {
    freeShippingThreshold: 300,
    returnWindowDays: 14,
    lowStockThreshold: 5,
    supportHours: 'Monday – Friday, 8:30 AM – 5:30 PM EAT',
    supportMailbox: 'firaolsiraj17@gmail.com',
    autoReplyTemplate: '',
  },
};

export async function seedSettings() {
  const existing = await Setting.findOne({ isSingleton: true });
  if (existing) {
    Object.assign(existing, REAL_SETTINGS_SEED);
    existing.version += 1;
    await existing.save();
    console.log(`✓ Updated Settings singleton to version ${existing.version}`);
  } else {
    await Setting.create({ isSingleton: true, ...REAL_SETTINGS_SEED });
    console.log('✓ Created initial Settings singleton with approved real values.');
  }
}

if (process.argv[1]?.endsWith('seedSettings.js')) {
  mongoose
    .connect(process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/novashop')
    .then(async () => {
      await seedSettings();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed failed:', err.message);
      process.exit(1);
    });
}
