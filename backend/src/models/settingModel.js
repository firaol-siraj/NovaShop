import mongoose from 'mongoose';
import { DEFAULT_LOW_STOCK_THRESHOLD } from '../constants/orderConstants.js';
import { DEFAULT_STORE_TIMEZONE, DEFAULT_USD_TO_ETB_RATE } from '../constants/paymentConstants.js';
import { DEFAULT_RETURN_WINDOW_DAYS } from '../constants/returnConstants.js';

const taxRegionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    region: { type: String, required: true, trim: true },
    sub: { type: String, default: '', trim: true },
    taxName: { type: String, default: 'VAT', trim: true },
    countryCodes: { type: [String], default: [] },
    subdivisionCodes: { type: [String], default: [] },
    rate: { type: Number, required: true, min: 0, max: 100 },
    rateType: { type: String, enum: ['single', 'subdivision'], default: 'single' },
    min: { type: String, default: '15.00%' },
    max: { type: String, default: '15.00%' },
    appliesToShipping: { type: Boolean, default: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    countryCode: { type: String, default: 'ET', trim: true },
  },
  { _id: false }
);

const settingSchema = new mongoose.Schema(
  {
    isSingleton: {
      type: Boolean,
      default: true,
      unique: true,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
      required: true,
    },
    store: {
      name: { type: String, default: 'NovaShop', trim: true },
      legalName: { type: String, default: 'NovaShop', trim: true },
      email: { type: String, default: 'firaolsiraj17@gmail.com', trim: true, lowercase: true },
      phone: { type: String, default: '+2519536877', trim: true },
      logoUrl: { type: String, default: '' },
      faviconUrl: { type: String, default: '' },
      orderPrefix: { type: String, default: 'NS-', trim: true },
      storefrontAccess: { type: String, enum: ['Open', 'Password protected'], default: 'Open' },
      storefrontPassword: { type: String, default: '' },
    },
    address: {
      country: { type: String, default: 'Ethiopia', trim: true },
      region: { type: String, default: 'Addis Ababa', trim: true },
      city: { type: String, default: 'Addis Ababa', trim: true },
      street: { type: String, default: 'Bole', trim: true },
      postalCode: { type: String, default: '1102', trim: true },
    },
    locale: {
      timezone: { type: String, default: DEFAULT_STORE_TIMEZONE, trim: true },
      currency: { type: String, default: 'USD', trim: true },
      usdToEtbRate: { type: Number, default: DEFAULT_USD_TO_ETB_RATE, min: 1 },
      dateFormat: { type: String, default: 'YYYY-MM-DD' },
    },
    tax: {
      collectTax: { type: Boolean, default: true },
      includeTax: { type: Boolean, default: false },
      chargeShipping: { type: Boolean, default: true },
      defaultRate: { type: Number, default: 15.0, min: 0, max: 100 },
      defaultTaxName: { type: String, default: 'VAT' },
      regions: [taxRegionSchema],
    },
    notifications: {
      teamNotificationEmail: { type: String, default: 'sirajfira517@gmail.com', trim: true, lowercase: true },
      customerEmails: {
        senderName: { type: String, default: 'NovaShop', trim: true },
        replyToEmail: { type: String, default: 'firaolsiraj17@gmail.com', trim: true, lowercase: true },
        orderConfirmation: { type: Boolean, default: true },
        shippingConfirmation: { type: Boolean, default: true },
        returnApproved: { type: Boolean, default: true },
        refundIssued: { type: Boolean, default: true },
      },
      eventPreferences: {
        orders: {
          email: { type: Boolean, default: true },
          inApp: { type: Boolean, default: true },
        },
        returns: {
          email: { type: Boolean, default: true },
          inApp: { type: Boolean, default: false },
        },
        inventory: {
          email: { type: Boolean, default: true },
          inApp: { type: Boolean, default: true },
        },
        customerAccounts: {
          email: { type: Boolean, default: false },
          inApp: { type: Boolean, default: true },
        },
        paymentDisputes: {
          email: { type: Boolean, default: true },
          inApp: { type: Boolean, default: true },
        },
      },
    },
    operational: {
      freeShippingThreshold: { type: Number, default: 300, min: 0 },
      returnWindowDays: { type: Number, default: DEFAULT_RETURN_WINDOW_DAYS, min: 1 },
      lowStockThreshold: { type: Number, default: DEFAULT_LOW_STOCK_THRESHOLD, min: 0 },
      supportHours: { type: String, default: 'Monday – Friday, 8:30 AM – 5:30 PM EAT', trim: true },
      supportMailbox: { type: String, default: 'firaolsiraj17@gmail.com', trim: true },
      autoReplyTemplate: { type: String, default: '' },
    },
    legacySettings: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Retrieve or initialize the singleton Settings document with real seed values
settingSchema.statics.getSingleton = async function () {
  let doc = await this.findOne({ isSingleton: true }).populate('updatedBy', 'name email');
  if (!doc) {
    doc = await this.create({
      isSingleton: true,
      version: 1,
      store: {
        name: 'NovaShop',
        legalName: 'NovaShop',
        email: 'firaolsiraj17@gmail.com',
        phone: '+2519536877',
        orderPrefix: 'NS-',
        storefrontAccess: 'Open',
        password: '',
      },
      address: {
        country: 'Ethiopia',
        region: 'Addis Ababa',
        city: 'Addis Ababa',
        street: 'Bole',
        postalCode: '1102',
      },
      locale: {
        timezone: DEFAULT_STORE_TIMEZONE,
        currency: 'USD',
        usdToEtbRate: DEFAULT_USD_TO_ETB_RATE,
        dateFormat: 'YYYY-MM-DD',
      },
      tax: {
        collectTax: true,
        includeTax: false,
        chargeShipping: true,
        defaultRate: 15,
        defaultTaxName: 'VAT',
        regions: [
          {
            id: 'eth-vat-1',
            region: 'Ethiopia',
            sub: 'National jurisdiction',
            taxName: 'VAT',
            countryCodes: ['ET'],
            subdivisionCodes: [],
            rate: 15,
            rateType: 'single',
            min: '15.00%',
            max: '15.00%',
            appliesToShipping: true,
            status: 'Active',
            countryCode: 'ET',
          },
        ],
      },
      notifications: {
        teamNotificationEmail: 'sirajfira517@gmail.com',
        customerEmails: {
          senderName: 'NovaShop',
          replyToEmail: 'firaolsiraj17@gmail.com',
          orderConfirmation: true,
          shippingConfirmation: true,
          returnApproved: true,
          refundIssued: true,
        },
        eventPreferences: {
          orders: { email: true, inApp: true },
          returns: { email: true, inApp: false },
          inventory: { email: true, inApp: true },
          customerAccounts: { email: false, inApp: true },
          paymentDisputes: { email: true, inApp: true },
        },
      },
      operational: {
        freeShippingThreshold: 300,
        returnWindowDays: 14,
        lowStockThreshold: 5,
        supportHours: 'Monday – Friday, 8:30 AM – 5:30 PM EAT',
        supportMailbox: 'firaolsiraj17@gmail.com',
      },
    });
  }
  return doc;
};

// Backward-compatible getSetting helper for legacy callers
settingSchema.statics.getSetting = async function (key, defaultValue = null) {
  const doc = await this.getSingleton();
  switch (key) {
    case 'lowStockThreshold':
      return doc.operational?.lowStockThreshold ?? defaultValue;
    case 'free_shipping_threshold':
      return doc.operational?.freeShippingThreshold ?? defaultValue;
    case 'return_window_days':
      return doc.operational?.returnWindowDays ?? defaultValue;
    case 'support_email':
      return doc.store?.email || defaultValue;
    case 'support_hours':
      return doc.operational?.supportHours || defaultValue;
    case 'storeTimezone':
      return doc.locale?.timezone || defaultValue;
    case 'usd_to_etb_rate':
      return doc.locale?.usdToEtbRate ?? defaultValue;
    case 'default_currency':
      return doc.locale?.currency || defaultValue;
    default:
      if (doc.legacySettings && doc.legacySettings.has(key)) {
        return doc.legacySettings.get(key);
      }
      return defaultValue;
  }
};

// Backward-compatible setSetting helper for legacy callers
settingSchema.statics.setSetting = async function (key, value) {
  const doc = await this.getSingleton();
  switch (key) {
    case 'lowStockThreshold':
      doc.operational.lowStockThreshold = Number(value);
      break;
    case 'free_shipping_threshold':
      doc.operational.freeShippingThreshold = Number(value);
      break;
    case 'return_window_days':
      doc.operational.returnWindowDays = Number(value);
      break;
    case 'support_email':
      doc.store.email = String(value);
      break;
    case 'support_hours':
      doc.operational.supportHours = String(value);
      break;
    case 'storeTimezone':
      doc.locale.timezone = String(value);
      break;
    case 'usd_to_etb_rate':
      doc.locale.usdToEtbRate = Number(value);
      break;
    default:
      if (!doc.legacySettings) doc.legacySettings = new Map();
      doc.legacySettings.set(key, value);
  }
  doc.version += 1;
  return await doc.save();
};

const Setting = mongoose.model('Setting', settingSchema);
export default Setting;
