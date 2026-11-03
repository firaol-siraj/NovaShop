import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { getPublicSettings, getAdminSettings, updateSettingsSection } from '../services/settingsService.js';
import { ISO_COUNTRIES, SUBDIVISIONS } from '../constants/isoCountries.js';

export const getPublicSettingsHandler = asyncHandler(async (req, res) => {
  const publicData = await getPublicSettings();
  res.status(200).json({ success: true, data: publicData });
});

export const getCountriesHandler = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      countries: ISO_COUNTRIES,
      subdivisions: SUBDIVISIONS,
    },
  });
});

export const getAdminSettingsHandler = asyncHandler(async (req, res) => {
  const data = await getAdminSettings();
  res.status(200).json({
    success: true,
    data,
  });
});

export const updateAdminSettingsHandler = asyncHandler(async (req, res, next) => {
  const { section } = req.params;
  const { version, ...data } = req.body;

  if (version === undefined || version === null) {
    return next(new ApiError(400, 'Version parameter is required for optimistic concurrency check'));
  }

  // Rate/Threshold Range validations
  if (section === 'tax' && data.defaultRate !== undefined) {
    const rate = Number(data.defaultRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      return next(new ApiError(400, 'Tax rate must be between 0 and 100%'));
    }
  }

  if (section === 'operational') {
    if (data.freeShippingThreshold !== undefined && Number(data.freeShippingThreshold) < 0) {
      return next(new ApiError(400, 'Free shipping threshold cannot be negative'));
    }
    if (data.returnWindowDays !== undefined && Number(data.returnWindowDays) < 1) {
      return next(new ApiError(400, 'Return window must be at least 1 day'));
    }
    if (data.lowStockThreshold !== undefined && Number(data.lowStockThreshold) < 0) {
      return next(new ApiError(400, 'Low stock threshold cannot be negative'));
    }
  }

  // Phone international validation check
  if (section === 'store' && data.phone) {
    const cleaned = String(data.phone).replace(/[\s\-()]/g, '');
    if (!/^\+?[0-9]{7,15}$/.test(cleaned)) {
      return next(new ApiError(400, 'Please provide a valid international phone format (e.g. +251...)'));
    }
  }

  // Email format check
  if (section === 'store' && data.email) {
    if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(data.email)) {
      return next(new ApiError(400, 'Please provide a valid store contact email address'));
    }
  }

  const updatedDoc = await updateSettingsSection(
    section,
    data,
    Number(version),
    req.user,
    req
  );

  res.status(200).json({
    success: true,
    message: 'Settings updated successfully',
    data: {
      version: updatedDoc.version,
      [section]: section === 'operational' ? updatedDoc.operational : updatedDoc[section],
    },
  });
});
