import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import User from '../src/models/userModel.js';
import Setting from '../src/models/settingModel.js';

const isDryRun = process.argv.includes('--dry-run');

export async function cleanupFakeData() {
  console.log(`\n=== NovaShop Settings & Mock Data Cleanup (${isDryRun ? 'DRY-RUN' : 'LIVE'}) ===\n`);

  const mockEmails = [
    'marcus.hale@novashop.com',
    'elena.vasquez@novashop.com',
    'grace.lin@novashop.com',
    'priya.nair@novashop.com',
    'tomas.berg@novashop.com',
    'omar.haddad@novashop.com',
    'julia.weiss@novashop.com',
  ];

  const foundMockUsers = await User.find({ email: { $in: mockEmails } });
  console.log(`Found ${foundMockUsers.length} mock admin accounts in database:`);
  for (const u of foundMockUsers) {
    console.log(`  - [MOCK] ${u.name} <${u.email}> (ID: ${u._id})`);
  }

  if (!isDryRun && foundMockUsers.length > 0) {
    const res = await User.deleteMany({ email: { $in: mockEmails } });
    console.log(`  ✓ Removed ${res.deletedCount} mock user accounts.`);
  }

  // Audit Settings singleton
  const settings = await Setting.findOne({ isSingleton: true });
  if (settings) {
    console.log('\nAuditing Settings Singleton Values:');
    const fakeStoreEmail = settings.store?.email === 'support@novashop.com';
    const fakeNotificationEmail = settings.notifications?.teamNotificationEmail === 'orders@novashop.com';
    const fakePhone = settings.store?.phone?.includes('555-0100');
    const fakeAddress = settings.address?.street?.includes('Fifth Avenue') || settings.store?.address?.includes('Fifth Avenue');
    const fakeLegal = settings.store?.legalName === 'NovaShop Inc.';

    console.log(`  - Mock Legal Name ("NovaShop Inc."): ${fakeLegal ? 'DETECTED' : 'OK'}`);
    console.log(`  - Mock Phone ("+1 (212) 555-0100"): ${fakePhone ? 'DETECTED' : 'OK'}`);
    console.log(`  - Mock Address ("350 Fifth Ave"): ${fakeAddress ? 'DETECTED' : 'OK'}`);
    console.log(`  - Mock Store Email ("support@novashop.com"): ${fakeStoreEmail ? 'DETECTED' : 'OK'}`);
    console.log(`  - Mock Team Email ("orders@novashop.com"): ${fakeNotificationEmail ? 'DETECTED' : 'OK'}`);

    if (!isDryRun) {
      if (fakeLegal) settings.store.legalName = 'NovaShop';
      if (fakePhone) settings.store.phone = '+2519536877';
      if (fakeAddress) {
        settings.address.street = 'Bole';
        settings.address.city = 'Addis Ababa';
        settings.address.region = 'Addis Ababa';
        settings.address.postalCode = '1102';
        settings.address.country = 'Ethiopia';
      }
      if (fakeStoreEmail) settings.store.email = 'firaolsiraj17@gmail.com';
      if (fakeNotificationEmail) settings.notifications.teamNotificationEmail = 'sirajfira517@gmail.com';

      // Purge fake mock regions if present
      settings.tax.regions = settings.tax.regions.filter((r) => r.countryCode === 'ET' || r.region.toLowerCase() === 'ethiopia');
      if (settings.tax.regions.length === 0) {
        settings.tax.regions.push({
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
        });
      }

      settings.version += 1;
      await settings.save();
      console.log('  ✓ Cleaned all mock fields in Settings singleton.');
    }
  }

  console.log(`\n=== Cleanup Complete (${isDryRun ? 'DRY-RUN - NO CHANGES WRITTEN' : 'MODIFICATIONS COMMITTED'}) ===\n`);
}

if (process.argv[1]?.endsWith('cleanupFakeSettingsData.js')) {
  mongoose
    .connect(process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/novashop')
    .then(async () => {
      await cleanupFakeData();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Cleanup execution note:', err.message);
      process.exit(1);
    });
}
