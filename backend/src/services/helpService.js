import HelpArticle from '../models/helpArticleModel.js';
import Setting from '../models/settingModel.js';

/**
 * Get help articles with optional topic filter and text search
 */
export async function getHelpArticles({ topic, search } = {}) {
  const filter = { status: 'published' };

  if (topic && topic !== 'all') {
    filter.topic = topic;
  }

  if (search && search.trim()) {
    const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ question: regex }, { answer: regex }];
  }

  const articles = await HelpArticle.find(filter).sort({ sortOrder: 1, createdAt: 1 });

  return articles.map(a => ({
    id: a._id.toString(),
    topic: a.topic,
    q: a.question,
    a: a.answer,
    sortOrder: a.sortOrder,
  }));
}

/**
 * Get public support and store settings for help page
 */
export async function getHelpSettings() {
  const [supportEmail, supportHours, returnWindowDays, freeShippingThreshold] = await Promise.all([
    Setting.getSetting('support_email', process.env.EMAIL_USER || 'support@novashop.com'),
    Setting.getSetting('support_hours', 'Monday – Friday, 9:00 AM – 6:00 PM EST'),
    Setting.getSetting('return_window_days', 14),
    Setting.getSetting('free_shipping_threshold', 300),
  ]);

  return {
    supportEmail,
    supportHours,
    returnWindowDays: Number(returnWindowDays) || 14,
    freeShippingThreshold: Number(freeShippingThreshold) || 300,
  };
}
