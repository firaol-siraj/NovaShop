import Setting from '../models/settingModel.js';
import AuditLog from '../models/auditLogModel.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { ISO_COUNTRIES } from '../constants/isoCountries.js';

let cachedPublicSettings = null;
let publicSettingsCacheExpiry = 0;

export const getPublicSettings = async () => {
  const now = Date.now();
  if (cachedPublicSettings && now < publicSettingsCacheExpiry) {
    return cachedPublicSettings;
  }

  const doc = await Setting.getSingleton();
  cachedPublicSettings = {
    storeName: doc.store.name || 'NovaShop',
    legalName: doc.store.legalName || 'NovaShop',
    email: doc.store.email || '',
    phone: doc.store.phone || '',
    address: doc.address || {},
    currency: doc.locale.currency || 'USD',
    usdToEtbRate: doc.locale.usdToEtbRate || 120,
    freeShippingThreshold: doc.operational.freeShippingThreshold ?? 300,
    returnWindowDays: doc.operational.returnWindowDays ?? 14,
    supportHours: doc.operational.supportHours || 'Monday – Friday, 8:30 AM – 5:30 PM EAT',
    tax: {
      collectTax: Boolean(doc.tax.collectTax),
      includeTax: Boolean(doc.tax.includeTax),
      chargeShipping: Boolean(doc.tax.chargeShipping),
      defaultRate: doc.tax.defaultRate || 15,
      taxName: doc.tax.defaultTaxName || 'VAT',
    },
    orderPrefix: doc.store.orderPrefix || 'NS-',
    timezone: doc.locale.timezone || 'Africa/Addis_Ababa',
    storefrontAccess: doc.store.storefrontAccess || 'Open',
  };

  publicSettingsCacheExpiry = now + 60 * 1000; // 60-second in-memory cache
  return cachedPublicSettings;
};

export const invalidateSettingsCache = () => {
  cachedPublicSettings = null;
  publicSettingsCacheExpiry = 0;
  logger.info('[SettingsService] Public settings cache invalidated');
};

export const getAdminSettings = async () => {
  const doc = await Setting.getSingleton();

  const secretsStatus = {
    chapa: Boolean(process.env.CHAPA_SECRET_KEY) ? 'configured' : 'missing',
    smtp: Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS)
      ? 'configured'
      : 'missing',
    imap: Boolean(process.env.IMAP_USER && process.env.IMAP_PASSWORD) ? 'configured' : 'missing',
    jwt: Boolean(process.env.JWT_SECRET) ? 'configured' : 'missing',
  };

  return {
    version: doc.version,
    store: doc.store,
    address: doc.address,
    locale: doc.locale,
    tax: doc.tax,
    notifications: doc.notifications,
    operational: doc.operational,
    secretsStatus,
    updatedAt: doc.updatedAt,
    updatedBy: doc.updatedBy,
  };
};

export const updateSettingsSection = async (section, data, clientVersion, user, req) => {
  const doc = await Setting.getSingleton();

  if (clientVersion !== undefined && Number(clientVersion) !== Number(doc.version)) {
    throw new ApiError(
      409,
      'Settings were modified by another administrator. Please reload before saving.',
      'STALE_SETTINGS_VERSION'
    );
  }

  const validSections = ['store', 'address', 'locale', 'tax', 'notifications', 'operational'];
  if (!validSections.includes(section)) {
    throw new ApiError(400, `Invalid settings section: ${section}`);
  }

  const changes = [];

  const recordChange = (path, oldVal, newVal) => {
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ field: path, oldValue: oldVal, newValue: newVal });
    }
  };

  if (section === 'store') {
    // Map Store Profile fields
    if (data.name !== undefined || data.storeName !== undefined) {
      const val = data.name !== undefined ? data.name : data.storeName;
      recordChange('store.name', doc.store.name, val);
      doc.store.name = val;
    }
    if (data.legalName !== undefined) {
      recordChange('store.legalName', doc.store.legalName, data.legalName);
      doc.store.legalName = data.legalName;
    }
    if (data.email !== undefined) {
      recordChange('store.email', doc.store.email, data.email);
      doc.store.email = data.email;
    }
    if (data.phone !== undefined) {
      recordChange('store.phone', doc.store.phone, data.phone);
      doc.store.phone = data.phone;
    }
    if (data.logoUrl !== undefined) {
      recordChange('store.logoUrl', doc.store.logoUrl, data.logoUrl);
      doc.store.logoUrl = data.logoUrl;
    }
    if (data.faviconUrl !== undefined) {
      recordChange('store.faviconUrl', doc.store.faviconUrl, data.faviconUrl);
      doc.store.faviconUrl = data.faviconUrl;
    }
    if (data.orderPrefix !== undefined) {
      recordChange('store.orderPrefix', doc.store.orderPrefix, data.orderPrefix);
      doc.store.orderPrefix = data.orderPrefix;
    }
    if (data.storefrontAccess !== undefined) {
      recordChange('store.storefrontAccess', doc.store.storefrontAccess, data.storefrontAccess);
      doc.store.storefrontAccess = data.storefrontAccess;
    }
    if (data.storefrontPassword !== undefined || data.password !== undefined) {
      const val = data.storefrontPassword !== undefined ? data.storefrontPassword : data.password;
      recordChange('store.storefrontPassword', '[HIDDEN]', '[HIDDEN]');
      doc.store.storefrontPassword = val;
    }

    // Map Address fields if submitted with store section
    const street = data.address !== undefined ? data.address : data.street;
    if (street !== undefined) {
      recordChange('address.street', doc.address.street, street);
      doc.address.street = street;
    }
    if (data.city !== undefined) {
      recordChange('address.city', doc.address.city, data.city);
      doc.address.city = data.city;
    }
    const region = data.state !== undefined ? data.state : data.region;
    if (region !== undefined) {
      recordChange('address.region', doc.address.region, region);
      doc.address.region = region;
    }
    if (data.postalCode !== undefined) {
      recordChange('address.postalCode', doc.address.postalCode, data.postalCode);
      doc.address.postalCode = data.postalCode;
    }
    if (data.country !== undefined) {
      recordChange('address.country', doc.address.country, data.country);
      doc.address.country = data.country;
    }

    // Map Regional/Locale fields if submitted with store section
    if (data.timezone !== undefined) {
      recordChange('locale.timezone', doc.locale.timezone, data.timezone);
      doc.locale.timezone = data.timezone;
    }
    if (data.currency !== undefined) {
      recordChange('locale.currency', doc.locale.currency, data.currency);
      doc.locale.currency = data.currency;
    }
    if (data.usdToEtbRate !== undefined) {
      recordChange('locale.usdToEtbRate', doc.locale.usdToEtbRate, data.usdToEtbRate);
      doc.locale.usdToEtbRate = data.usdToEtbRate;
    }
  } else if (section === 'tax') {
    if (data.collectTax !== undefined) {
      recordChange('tax.collectTax', doc.tax.collectTax, data.collectTax);
      doc.tax.collectTax = Boolean(data.collectTax);
    }
    if (data.includeTax !== undefined) {
      recordChange('tax.includeTax', doc.tax.includeTax, data.includeTax);
      doc.tax.includeTax = Boolean(data.includeTax);
    }
    if (data.chargeShipping !== undefined) {
      recordChange('tax.chargeShipping', doc.tax.chargeShipping, data.chargeShipping);
      doc.tax.chargeShipping = Boolean(data.chargeShipping);
    }
    if (data.defaultRate !== undefined) {
      recordChange('tax.defaultRate', doc.tax.defaultRate, data.defaultRate);
      doc.tax.defaultRate = Number(data.defaultRate);
    }
    if (data.defaultTaxName !== undefined) {
      recordChange('tax.defaultTaxName', doc.tax.defaultTaxName, data.defaultTaxName);
      doc.tax.defaultTaxName = data.defaultTaxName;
    }
    if (data.regions !== undefined && Array.isArray(data.regions)) {
      recordChange('tax.regions', doc.tax.regions, data.regions);
      doc.tax.regions = data.regions;
    }
  } else if (section === 'notifications') {
    if (data.teamNotificationEmail !== undefined) {
      recordChange('notifications.teamNotificationEmail', doc.notifications.teamNotificationEmail, data.teamNotificationEmail);
      doc.notifications.teamNotificationEmail = data.teamNotificationEmail;
    }
    if (data.eventPreferences !== undefined) {
      recordChange('notifications.eventPreferences', doc.notifications.eventPreferences, data.eventPreferences);
      doc.notifications.eventPreferences = {
        ...doc.notifications.eventPreferences,
        ...data.eventPreferences,
      };
    }
    if (data.customerEmails !== undefined) {
      recordChange('notifications.customerEmails', doc.notifications.customerEmails, data.customerEmails);
      doc.notifications.customerEmails = {
        ...doc.notifications.customerEmails,
        ...data.customerEmails,
      };
    }
  } else {
    const targetObj = section === 'operational' ? doc.operational : doc[section];
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        const oldVal = targetObj[key];
        recordChange(`${section}.${key}`, oldVal, value);
        targetObj[key] = value;
      }
    }
  }

  doc.version += 1;
  doc.updatedBy = user._id;
  await doc.save();

  if (changes.length > 0) {
    await AuditLog.create({
      action: 'settings_update',
      section,
      performedBy: user._id,
      performerEmail: user.email,
      changes,
      ipAddress: req?.ip || '',
    });
  }

  invalidateSettingsCache();
  return doc;
};

/**
 * Server-side dynamic tax calculation honoring store settings, active tax regions, and snapshots
 */
export const calculateTaxForOrder = async ({ shippingAddress = {}, itemsPrice = 0, shippingPrice = 0 }) => {
  const doc = await Setting.getSingleton();
  const taxConfig = doc.tax;

  if (!taxConfig || !taxConfig.collectTax) {
    return {
      taxName: taxConfig?.defaultTaxName || 'VAT',
      taxRate: 0,
      taxAmount: 0,
      taxIncluded: Boolean(taxConfig?.includeTax),
      taxShippingAmount: 0,
    };
  }

  const targetCountry = (shippingAddress.country || shippingAddress.countryOrRegion || '').trim().toLowerCase();
  const targetSubdivision = (shippingAddress.state || shippingAddress.region || shippingAddress.city || '').trim().toLowerCase();

  // Find matching active tax region
  const activeRegions = (taxConfig.regions || []).filter((r) => r.status === 'Active');
  let matchedRegion = null;

  for (const region of activeRegions) {
    const regionNameMatch = region.region.toLowerCase() === targetCountry;
    const countryCodeMatch = (region.countryCodes || []).some(
      (c) => c.toLowerCase() === targetCountry
    );
    const isoCodeMatch = ISO_COUNTRIES.some(
      (iso) => (iso.name.toLowerCase() === targetCountry || iso.code.toLowerCase() === targetCountry) &&
        (region.countryCodes || []).includes(iso.code)
    );

    if (regionNameMatch || countryCodeMatch || isoCodeMatch) {
      // Check subdivision if applicable
      if (region.subdivisionCodes && region.subdivisionCodes.length > 0) {
        const subMatch = region.subdivisionCodes.some((s) => s.toLowerCase() === targetSubdivision);
        if (subMatch) {
          matchedRegion = region;
          break;
        }
      } else {
        matchedRegion = region;
        break;
      }
    }
  }

  // If no specific region matches and shipping country is Ethiopia or empty, use Ethiopia default active region
  if (!matchedRegion && (!targetCountry || targetCountry === 'ethiopia' || targetCountry === 'et')) {
    matchedRegion = activeRegions.find((r) => r.countryCode === 'ET' || r.region.toLowerCase() === 'ethiopia');
  }

  if (!matchedRegion) {
    return {
      taxName: taxConfig.defaultTaxName || 'VAT',
      taxRate: 0,
      taxAmount: 0,
      taxIncluded: Boolean(taxConfig.includeTax),
      taxShippingAmount: 0,
    };
  }

  const rate = Number(matchedRegion.rate) || 0;
  const taxName = matchedRegion.taxName || taxConfig.defaultTaxName || 'VAT';
  const includeTax = Boolean(taxConfig.includeTax);
  const chargeOnShipping = Boolean(taxConfig.chargeShipping && matchedRegion.appliesToShipping !== false);

  let taxItemAmount = 0;
  let taxShippingAmount = 0;

  if (includeTax) {
    // Tax-inclusive pricing (rate embedded)
    taxItemAmount = Number((itemsPrice - itemsPrice / (1 + rate / 100)).toFixed(2));
    taxShippingAmount = chargeOnShipping
      ? Number((shippingPrice - shippingPrice / (1 + rate / 100)).toFixed(2))
      : 0;
  } else {
    // Tax-exclusive pricing (rate added on top)
    taxItemAmount = Number(((itemsPrice * rate) / 100).toFixed(2));
    taxShippingAmount = chargeOnShipping
      ? Number(((shippingPrice * rate) / 100).toFixed(2))
      : 0;
  }

  const totalTax = Number((taxItemAmount + taxShippingAmount).toFixed(2));

  return {
    taxName,
    taxRate: rate,
    taxAmount: totalTax,
    taxIncluded: includeTax,
    taxShippingAmount,
  };
};
