#!/usr/bin/env node
/**
 * CLI script to reset or promote an Owner account in NovaShop
 * Usage:
 *   npm run admin:reset-owner -- <email> [optional-password]
 *   or: node scripts/resetOwner.js <email> [optional-password]
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';
import User from '../src/models/userModel.js';

dotenv.config();

const email = process.argv[2];
const customPassword = process.argv[3];

if (!email) {
  console.error('\x1b[31mError: Please provide an email address.\x1b[0m');
  console.log('Usage: npm run admin:reset-owner -- <email> [optional-new-password]');
  process.exit(1);
}

const mongoUri = process.env.MONGO_URL || process.env.MONGO_URI;
if (!mongoUri) {
  console.error('\x1b[31mError: MONGO_URL is not set in environment or .env file.\x1b[0m');
  process.exit(1);
}

async function run() {
  try {
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(mongoUri);
    console.log(`Connected to database.`);

    const cleanEmail = email.trim().toLowerCase();
    let user = await User.findOne({ email: cleanEmail });

    const newPassword = customPassword || `NovaOwner@${crypto.randomBytes(4).toString('hex').toUpperCase()}!`;

    if (!user) {
      console.log(`User with email "${cleanEmail}" does not exist. Creating new Owner account...`);
      user = new User({
        name: 'NovaShop Owner',
        email: cleanEmail,
        password: newPassword,
        role: 'owner',
        status: 'active',
        isActive: true,
        isVerified: true,
      });
    } else {
      console.log(`Found existing user "${user.name}" (${user.email}) with role "${user.role}".`);
      user.password = newPassword;
      user.role = 'owner';
      user.status = 'active';
      user.isActive = true;
      user.isVerified = true;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      user.adminResetOtp = undefined;
      user.adminResetOtpExpires = undefined;
      user.refreshToken = null;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    await user.save();

    console.log('\x1b[32m✔ Owner account successfully updated/created!\x1b[0m');
    console.log('----------------------------------------------------');
    console.log(`  Email:    ${user.email}`);
    console.log(`  Password: ${newPassword}`);
    console.log(`  Role:     ${user.role}`);
    console.log(`  Status:   ${user.status}`);
    console.log('----------------------------------------------------');
    console.log('You can now log in at /admin/login with these credentials.');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('\x1b[31mOperation failed:\x1b[0m', err.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

run();
