import mongoose from 'mongoose';

const adminNotificationPreferenceSchema = new mongoose.Schema(
  {
    adminUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    preferences: {
      orders: {
        email: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
        browserPush: { type: Boolean, default: false },
      },
      returns: {
        email: { type: Boolean, default: true },
        inApp: { type: Boolean, default: false },
        browserPush: { type: Boolean, default: false },
      },
      support: {
        email: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
        browserPush: { type: Boolean, default: true },
      },
      inventory: {
        email: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
        browserPush: { type: Boolean, default: false },
      },
      customerAccounts: {
        email: { type: Boolean, default: false },
        inApp: { type: Boolean, default: true },
        browserPush: { type: Boolean, default: false },
      },
      paymentDisputes: {
        email: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
        browserPush: { type: Boolean, default: true },
      },
      reviews: {
        email: { type: Boolean, default: false },
        inApp: { type: Boolean, default: true },
        browserPush: { type: Boolean, default: false },
      },
      systemSecurity: {
        email: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
        browserPush: { type: Boolean, default: true },
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

adminNotificationPreferenceSchema.virtual('user_id').get(function () {
  return this.adminUser;
});

const AdminNotificationPreference = mongoose.model(
  'AdminNotificationPreference',
  adminNotificationPreferenceSchema
);

export default AdminNotificationPreference;
