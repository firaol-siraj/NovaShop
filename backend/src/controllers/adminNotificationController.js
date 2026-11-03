import asyncHandler from '../utils/asyncHandler.js';
import AdminNotificationPreference from '../models/adminNotificationPreferenceModel.js';
import Setting from '../models/settingModel.js';
import sendEmail from '../utils/sendEmail.js';

export const getNotificationPreferences = asyncHandler(async (req, res) => {
  let userPref = await AdminNotificationPreference.findOne({ adminUser: req.user._id });
  const settingsDoc = await Setting.getSingleton();

  if (!userPref) {
    userPref = await AdminNotificationPreference.create({
      adminUser: req.user._id,
      preferences: settingsDoc.notifications?.eventPreferences || {
        orders: { email: true, inApp: true },
        returns: { email: true, inApp: false },
        inventory: { email: true, inApp: true },
        customerAccounts: { email: false, inApp: true },
        paymentDisputes: { email: true, inApp: true },
      },
    });
  }

  res.status(200).json({
    success: true,
    data: {
      teamNotificationEmail: settingsDoc.notifications?.teamNotificationEmail || '',
      preferences: userPref.preferences,
      customerEmails: settingsDoc.notifications?.customerEmails || {},
    },
  });
});

export const updateNotificationPreferences = asyncHandler(async (req, res) => {
  const { preferences, teamNotificationEmail, customerEmails } = req.body;

  let userPref = await AdminNotificationPreference.findOne({ adminUser: req.user._id });
  if (!userPref) {
    userPref = new AdminNotificationPreference({ adminUser: req.user._id });
  }

  if (preferences) {
    userPref.preferences = {
      ...userPref.preferences,
      ...preferences,
    };
    await userPref.save();
  }

  // If teamNotificationEmail or customerEmails are updated and user has settings:write permission
  if (teamNotificationEmail !== undefined || customerEmails) {
    const settingsDoc = await Setting.getSingleton();
    if (teamNotificationEmail !== undefined) {
      settingsDoc.notifications.teamNotificationEmail = String(teamNotificationEmail).trim().toLowerCase();
    }
    if (customerEmails) {
      settingsDoc.notifications.customerEmails = {
        ...settingsDoc.notifications.customerEmails,
        ...customerEmails,
      };
    }
    settingsDoc.version += 1;
    await settingsDoc.save();
  }

  res.status(200).json({
    success: true,
    message: 'Notification preferences saved successfully',
    data: userPref.preferences,
  });
});

export const sendTestNotification = asyncHandler(async (req, res) => {
  const settingsDoc = await Setting.getSingleton();
  const targetEmail = settingsDoc.notifications?.teamNotificationEmail || req.user.email;

  await sendEmail({
    to: targetEmail,
    subject: '[NovaShop] Test Administrative Alert',
    text: `This is a test notification confirming your operational alert inbox (${targetEmail}) is correctly configured.`,
  });

  res.status(200).json({
    success: true,
    message: `Test email dispatched to ${targetEmail}`,
  });
});
