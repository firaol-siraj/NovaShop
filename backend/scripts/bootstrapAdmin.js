import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../src/models/userModel.js';
import { BootstrapAdminError, createFirstAdmin, validateAdminBootstrapEnvironment } from '../src/utils/bootstrapAdmin.js';

dotenv.config();

let connected = false;
try {
  const config = validateAdminBootstrapEnvironment(process.env);
  await mongoose.connect(config.mongoUrl);
  connected = true;

  await createFirstAdmin({
    User,
    name: config.name,
    email: config.email,
    password: config.password,
  });
  console.log(`Initial administrator created in database "${config.databaseName}".`);
} catch (error) {
  console.error(error instanceof BootstrapAdminError
    ? error.message
    : 'Admin bootstrap failed. Check that the confirmed development database is reachable.');
  process.exitCode = 1;
} finally {
  if (connected) await mongoose.disconnect();
}