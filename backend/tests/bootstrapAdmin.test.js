import { describe, expect, it } from '@jest/globals';
import User from '../src/models/userModel.js';
import {
  BootstrapAdminError,
  createFirstAdmin,
  validateAdminBootstrapEnvironment,
} from '../src/utils/bootstrapAdmin.js';

const validEnvironment = {
  NODE_ENV: 'development',
  MONGO_URL: 'mongodb://127.0.0.1:27017/novashop_dev',
  BOOTSTRAP_ADMIN_CONFIRM_HOST: '127.0.0.1',
  BOOTSTRAP_ADMIN_CONFIRM_DATABASE: 'novashop_dev',
  BOOTSTRAP_ADMIN_NAME: 'Nova Owner',
  BOOTSTRAP_ADMIN_EMAIL: 'owner@example.com',
  BOOTSTRAP_ADMIN_PASSWORD: 'owner-password-123',
};

describe('first administrator bootstrap', () => {
  it('accepts only explicit development database confirmation', () => {
    expect(validateAdminBootstrapEnvironment(validEnvironment)).toMatchObject({
      databaseName: 'novashop_dev',
      email: 'owner@example.com',
    });
    expect(() => validateAdminBootstrapEnvironment({
      ...validEnvironment,
      MONGO_URL: 'mongodb+srv://user:secret@cluster.example.net/?retryWrites=true',
    })).toThrow(BootstrapAdminError);
    expect(() => validateAdminBootstrapEnvironment({
      ...validEnvironment,
      NODE_ENV: 'production',
    })).toThrow(BootstrapAdminError);
    expect(() => validateAdminBootstrapEnvironment({
      ...validEnvironment,
      BOOTSTRAP_ADMIN_CONFIRM_DATABASE: 'another_database',
    })).toThrow(BootstrapAdminError);
    expect(() => validateAdminBootstrapEnvironment({
      ...validEnvironment,
      BOOTSTRAP_ADMIN_CONFIRM_HOST: 'another-host.example',
    })).toThrow(BootstrapAdminError);
  });

  it('creates a hashed administrator through the User model hook', async () => {
    const admin = await createFirstAdmin({
      User,
      name: 'Nova Owner',
      email: 'OWNER@example.com',
      password: 'owner-password-123',
    });
    const storedUser = await User.findById(admin._id).select('+password');

    expect(storedUser.role).toBe('admin');
    expect(storedUser.password).not.toBe('owner-password-123');
    await expect(storedUser.matchPassword('owner-password-123')).resolves.toBe(true);
  });

  it('refuses a second administrator and refuses to promote an existing customer', async () => {
    await User.create({
      name: 'Existing Admin',
      email: 'existing-admin@example.com',
      password: 'owner-password-123',
      role: 'admin',
    });
    await expect(createFirstAdmin({
      User,
      name: 'Another Admin',
      email: 'another@example.com',
      password: 'owner-password-456',
    })).rejects.toThrow('An administrator already exists');

    await User.deleteMany({});
    await User.create({
      name: 'Existing Customer',
      email: 'customer@example.com',
      password: 'customer-password-123',
    });
    await expect(createFirstAdmin({
      User,
      name: 'Existing Customer',
      email: 'customer@example.com',
      password: 'customer-password-123',
    })).rejects.toThrow('will not promote it');
    const customer = await User.findOne({ email: 'customer@example.com' });
    expect(customer.role).toBe('customer');
  });
});