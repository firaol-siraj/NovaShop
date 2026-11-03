import asyncHandler from '../utils/asyncHandler.js';
import * as helpService from '../services/helpService.js';

export const getFaqs = asyncHandler(async (req, res) => {
  const { topic, search } = req.query;
  const articles = await helpService.getHelpArticles({ topic, search });

  res.status(200).json({
    status: 'success',
    data: articles,
  });
});

export const getPublicSettings = asyncHandler(async (req, res) => {
  const settings = await helpService.getHelpSettings();

  res.status(200).json({
    status: 'success',
    data: settings,
  });
});
