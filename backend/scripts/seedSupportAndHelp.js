import '../src/config/env.js';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import Conversation from '../src/models/conversationModel.js';
import Message from '../src/models/messageModel.js';
import HelpArticle from '../src/models/helpArticleModel.js';
import Setting from '../src/models/settingModel.js';
import User from '../src/models/userModel.js';
import Order from '../src/models/orderModel.js';

async function seedSupportAndHelp() {
  await connectDB();
  console.log('Connected to MongoDB for Support & Help Seeding...');

  // 1. Seed or update Settings
  console.log('Seeding unified Support & Store Settings...');
  const supportEmail = process.env.EMAIL_USER || 'support@novashop.com';
  await Setting.setSetting('support_email', supportEmail, 'Customer support contact email');
  await Setting.setSetting('support_hours', 'Monday – Friday, 9:00 AM – 6:00 PM EST', 'Customer service business hours');
  await Setting.setSetting('return_window_days', 14, 'Customer return window in days');
  await Setting.setSetting('free_shipping_threshold', 300, 'Free shipping order threshold USD');

  // 2. Seed Help Articles (FAQs)
  console.log('Seeding Help Articles & FAQs...');
  await HelpArticle.deleteMany({});

  const articles = [
    {
      topic: 'orders',
      question: 'How can I track my order?',
      answer: 'Once your order ships, you will receive a confirmation email with a live tracking link. You can also view real-time transit status anytime by going to Account → Orders.',
      sortOrder: 1,
      status: 'published',
    },
    {
      topic: 'shipping',
      question: 'What is your return policy and how do I request a return?',
      answer: 'We accept returns within 14 days of delivery for unworn items in original packaging. Start a return easily from Account → Orders, select your items, print the prepaid label, and drop it off at any partner courier point.',
      sortOrder: 2,
      status: 'published',
    },
    {
      topic: 'shipping',
      question: 'Do you offer free shipping?',
      answer: 'Yes! We offer complimentary standard shipping on all qualifying orders over $300. Orders under $300 ship at standard flat rates calculated at checkout based on your destination.',
      sortOrder: 3,
      status: 'published',
    },
    {
      topic: 'account',
      question: 'How do I change my account details?',
      answer: 'Go to Account → Profile to update your name, email address, or phone number. Saved shipping addresses can be managed anytime under Account → Saved Addresses.',
      sortOrder: 4,
      status: 'published',
    },
    {
      topic: 'payments',
      question: 'What payment methods do you accept?',
      answer: 'We accept Visa, Mastercard, American Express, and local mobile money solutions via our secure Chapa payment gateway. All transactions are encrypted and processed with bank-grade security.',
      sortOrder: 5,
      status: 'published',
    },
    {
      topic: 'security',
      question: 'How do I reset my password?',
      answer: 'Go to Account → Settings and choose "Update Password". If you are signed out, click "Forgot password?" on the login screen and we will email you a secure reset link.',
      sortOrder: 6,
      status: 'published',
    },
  ];

  await HelpArticle.insertMany(articles);
  console.log(`Seeded ${articles.length} Help Articles.`);

  // 3. Verify real customer support conversations exist
  const convCount = await Conversation.countDocuments();
  console.log(`Current active conversations in DB: ${convCount}`);

  console.log('Support & Help seeding completed successfully.');
  process.exit(0);
}

seedSupportAndHelp().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
