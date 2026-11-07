import { ShippingZone, ShippingMethod, ShippingRate } from '../models/shippingModel.js';
import Order from '../models/orderModel.js';
import Setting from '../models/settingModel.js';
import logger from '../utils/logger.js';
import { SHIPPING_STATUSES, SHIPPING_RATE_TYPES, DEFAULT_ORIGIN_ADDRESS } from '../constants/shippingConstants.js';

class ShippingService {
  /**
   * Quotes shipping methods & rates for checkout given delivery destination
   */
  async getShippingQuote({ country = 'Ethiopia', region = '', cartTotalUSD = 0, weightKg = 1 }) {
    const normCountry = (country || 'Ethiopia').trim().toLowerCase();
    const normRegion = (region || '').trim().toLowerCase();
    const totalUSD = Number(cartTotalUSD) || 0;

    // 1. Find matching ShippingZone
    let zone = null;

    // Direct match: country and region
    if (normRegion) {
      zone = await ShippingZone.findOne({
        status: SHIPPING_STATUSES.ACTIVE,
        countries: { $regex: new RegExp(`^${normCountry}$`, 'i') },
        regions: { $regex: new RegExp(`^${normRegion}$`, 'i') },
      });
    }

    // Direct match: country with wildcard/empty regions or general
    if (!zone) {
      zone = await ShippingZone.findOne({
        status: SHIPPING_STATUSES.ACTIVE,
        countries: { $regex: new RegExp(`^${normCountry}$`, 'i') },
      }).sort({ sortOrder: 1 });
    }

    // If no zone matches the destination country/region:
    if (!zone) {
      const totalZonesCount = await ShippingZone.countDocuments({ status: SHIPPING_STATUSES.ACTIVE });
      if (totalZonesCount > 0) {
        // Active delivery zones exist, but this destination is unsupported
        return [];
      }

      // Default fallback only if database has no active zones configured yet
      const isFree = totalUSD >= 300;
      return [
        {
          id: 'standard',
          name: 'Standard Delivery',
          carrier: 'Local Courier',
          priceUSD: isFree ? 0 : 5,
          priceETB: isFree ? 0 : 150,
          estimatedDelivery: '2–4 business days',
          minDays: 2,
          maxDays: 4,
          isFree,
          zoneName: 'Domestic Delivery',
        },
        {
          id: 'express',
          name: 'Express Delivery',
          carrier: 'DHL Express',
          priceUSD: 15,
          priceETB: 450,
          estimatedDelivery: '1–2 business days',
          minDays: 1,
          maxDays: 2,
          isFree: false,
          zoneName: 'Domestic Delivery',
        },
      ];
    }

    // 2. Fetch active methods for this zone
    const methods = await ShippingMethod.find({
      zone: zone._id,
      status: SHIPPING_STATUSES.ACTIVE,
    }).sort({ sortOrder: 1 });

    const globalThreshold = Number(await Setting.getSetting('free_shipping_threshold', 300));
    const freeShippingThreshold = (zone.freeOverThresholdUSD !== undefined && zone.freeOverThresholdUSD !== null && Number(zone.freeOverThresholdUSD) > 0)
      ? Number(zone.freeOverThresholdUSD)
      : globalThreshold;

    const quotes = [];

    for (const method of methods) {
      const rate = await ShippingRate.findOne({
        method: method._id,
        zone: zone._id,
      });

      let priceUSD = rate ? rate.amountUSD : (method.rateStructure === 'Free' ? 0 : 5);
      let priceETB = rate ? rate.amountETB : (method.rateStructure === 'Free' ? 0 : 150);

      let isFree = false;
      // Check free shipping threshold for standard methods
      if (
        method.rateStructure === 'Free' ||
        (freeShippingThreshold > 0 && totalUSD >= freeShippingThreshold && method.name.toLowerCase().includes('standard')) ||
        (rate?.freeOverThresholdUSD && totalUSD >= rate.freeOverThresholdUSD)
      ) {
        priceUSD = 0;
        priceETB = 0;
        isFree = true;
      }

      quotes.push({
        id: String(method._id),
        methodId: method._id,
        name: method.name,
        description: method.description || '',
        carrier: method.carrier,
        priceUSD,
        priceETB,
        estimatedDelivery: `${method.estimatedMinDays}–${method.estimatedMaxDays} ${method.estimatedDeliveryNote || 'business days'}`,
        minDays: method.estimatedMinDays,
        maxDays: method.estimatedMaxDays,
        isFree,
        zoneName: zone.name,
        zoneId: zone._id,
      });
    }

    return quotes;
  }

  /**
   * Aggregates stats and tab items for /admin/shipping
   */
  async getShippingStats() {
    const activeZones = await ShippingZone.find({ status: SHIPPING_STATUSES.ACTIVE }).sort({ sortOrder: 1 }).lean();
    const allZones = await ShippingZone.find().sort({ sortOrder: 1 }).lean();
    const activeMethods = await ShippingMethod.find({ status: SHIPPING_STATUSES.ACTIVE }).populate('zone', 'name').lean();
    const allMethods = await ShippingMethod.find().populate('zone', 'name').sort({ sortOrder: 1 }).lean();
    const allRates = await ShippingRate.find().populate('method', 'name carrier').populate('zone', 'name').lean();

    // Unique countries across active zones
    const countriesSet = new Set();
    activeZones.forEach((z) => {
      (z.countries || []).forEach((c) => countriesSet.add(c.trim()));
    });

    // Average delivery days from delivered orders
    const deliveredOrders = await Order.find({
      isDelivered: true,
      deliveredAt: { $exists: true, $ne: null },
      shippedAt: { $exists: true, $ne: null },
    })
      .select('deliveredAt shippedAt')
      .lean();

    let avgDeliveryDays = '-';
    if (deliveredOrders.length > 0) {
      const totalDays = deliveredOrders.reduce((sum, o) => {
        const diffMs = new Date(o.deliveredAt).getTime() - new Date(o.shippedAt).getTime();
        const diffDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
        return sum + diffDays;
      }, 0);
      avgDeliveryDays = `${(totalDays / deliveredOrders.length).toFixed(1)} days`;
    } else {
      // If no shippedAt timestamps exist on legacy orders, calculate average from method estimates
      if (activeMethods.length > 0) {
        const avgEstimate = activeMethods.reduce((sum, m) => sum + ((m.estimatedMinDays + m.estimatedMaxDays) / 2), 0) / activeMethods.length;
        avgDeliveryDays = `${avgEstimate.toFixed(1)} days`;
      }
    }

    // Tab 1: Delivery Zones data
    const zoneMethodsMap = {};
    allMethods.forEach((m) => {
      const zid = String(m.zone?._id || m.zone);
      zoneMethodsMap[zid] = (zoneMethodsMap[zid] || 0) + 1;
    });

    const deliveryZones = allZones.map((z) => ({
      id: String(z._id),
      name: z.name,
      status: z.status,
      countriesCount: z.countries ? z.countries.length : 0,
      countries: z.countries || [],
      regions: z.regions || [],
      methodsCount: zoneMethodsMap[String(z._id)] || 0,
      freeOverThresholdUSD: z.freeOverThresholdUSD || 300,
      handlingTime: z.handlingTime || '1–2 business days',
    }));

    // Tab 2: Shipping Methods data
    const shippingMethods = allMethods.map((m) => ({
      id: String(m._id),
      name: m.name,
      carrier: m.carrier,
      zoneName: m.zone?.name || 'All Zones',
      zoneId: m.zone?._id,
      rateStructure: m.rateStructure || 'Flat rate',
      estimatedDelivery: `${m.estimatedMinDays}–${m.estimatedMaxDays} ${m.estimatedDeliveryNote || 'business days'}`,
      minDays: m.estimatedMinDays,
      maxDays: m.estimatedMaxDays,
      deliveryNote: m.estimatedDeliveryNote,
      status: m.status,
    }));

    // Tab 3: Shipping Rates data
    const shippingRates = allRates.map((r) => {
      let condition = 'All orders';
      if (r.freeOverThresholdUSD) {
        condition = `Free over $${r.freeOverThresholdUSD}`;
      } else if (r.minOrderTotalUSD > 0) {
        condition = `Orders over $${r.minOrderTotalUSD}`;
      }

      return {
        id: String(r._id),
        methodName: r.method?.name || 'Standard',
        methodId: r.method?._id,
        carrier: r.method?.carrier || 'Local Courier',
        zoneName: r.zone?.name || 'General',
        zoneId: r.zone?._id,
        rateType: r.rateType || 'Flat rate',
        amountUSD: r.amountUSD,
        amountETB: r.amountETB,
        condition,
        freeOverThresholdUSD: r.freeOverThresholdUSD,
      };
    });

    // Tab 4: Delivery Times data
    const deliveryTimes = allZones.map((z) => {
      const zoneMethods = allMethods.filter((m) => String(m.zone?._id || m.zone) === String(z._id));
      const standard = zoneMethods.find((m) => m.name.toLowerCase().includes('standard'));
      const express = zoneMethods.find((m) => m.name.toLowerCase().includes('express'));

      const standardTransit = standard ? `${standard.estimatedMinDays}–${standard.estimatedMaxDays} business days` : '2–4 business days';
      const expressTransit = express ? `${express.estimatedMinDays}–${express.estimatedMaxDays} business days` : '1–2 business days';

      return {
        id: String(z._id),
        zoneName: z.name,
        handlingTime: z.handlingTime || '1–2 business days',
        standardTransit,
        expressTransit,
        totalEstimate: `${z.handlingTime || '1–2 business days'} handling + transit`,
      };
    });

    const freeShippingThreshold = Number(await Setting.getSetting('free_shipping_threshold', 300));

    return {
      stats: {
        zonesCount: activeZones.length,
        methodsCount: activeMethods.length,
        countriesCount: countriesSet.size,
        avgDeliveryDays,
        freeShippingThreshold,
      },
      deliveryZones,
      shippingMethods,
      shippingRates,
      deliveryTimes,
    };
  }

  // Zone CRUD
  async getZoneByCountry(country, region = '') {
    const normCountry = (country || 'Ethiopia').trim().toLowerCase();
    const normRegion = (region || '').trim().toLowerCase();

    if (normRegion) {
      const zone = await ShippingZone.findOne({
        status: SHIPPING_STATUSES.ACTIVE,
        countries: { $regex: new RegExp(`^${normCountry}$`, 'i') },
        regions: { $regex: new RegExp(`^${normRegion}$`, 'i') },
      });
      if (zone) return zone;
    }

    return await ShippingZone.findOne({
      status: SHIPPING_STATUSES.ACTIVE,
      countries: { $regex: new RegExp(`^${normCountry}$`, 'i') },
    }).sort({ sortOrder: 1 });
  }

  async getZoneById(id) {
    return await ShippingZone.findById(id);
  }

  async createZone(data) {
    return await ShippingZone.create(data);
  }

  async updateZone(id, data) {
    return await ShippingZone.findByIdAndUpdate(id, data, { returnDocument: 'after' });
  }

  async deleteZone(id) {
    await ShippingRate.deleteMany({ zone: id });
    await ShippingMethod.deleteMany({ zone: id });
    return await ShippingZone.findByIdAndDelete(id);
  }

  // Method CRUD
  async getMethodById(id) {
    return await ShippingMethod.findById(id).populate('zone');
  }

  async createMethod(data) {
    const method = await ShippingMethod.create(data);
    if (data.zone) {
      await ShippingRate.create({
        method: method._id,
        zone: data.zone,
        amountUSD: Number(data.rateUSD) || 5,
        amountETB: Number(data.rateETB) || 150,
        rateType: data.rateStructure || SHIPPING_RATE_TYPES.FLAT,
      });
    }
    return method;
  }

  async updateMethod(id, data) {
    return await ShippingMethod.findByIdAndUpdate(id, data, { returnDocument: 'after' });
  }

  async deleteMethod(id) {
    await ShippingRate.deleteMany({ method: id });
    return await ShippingMethod.findByIdAndDelete(id);
  }

  // Rate CRUD
  async createRate(data) {
    return await ShippingRate.create(data);
  }

  async updateRate(id, data) {
    return await ShippingRate.findByIdAndUpdate(id, data, { returnDocument: 'after' });
  }

  async deleteRate(id) {
    return await ShippingRate.findByIdAndDelete(id);
  }

  // Delivery times update
  async updateDeliveryTime(zoneId, { handlingTime, standardTransitMin, standardTransitMax, expressTransitMin, expressTransitMax }) {
    if (handlingTime) {
      await ShippingZone.findByIdAndUpdate(zoneId, { handlingTime });
    }

    if (standardTransitMin !== undefined && standardTransitMax !== undefined) {
      const standard = await ShippingMethod.findOne({ zone: zoneId, name: { $regex: /standard/i } });
      if (standard) {
        standard.estimatedMinDays = Number(standardTransitMin);
        standard.estimatedMaxDays = Number(standardTransitMax);
        await standard.save();
      }
    }

    if (expressTransitMin !== undefined && expressTransitMax !== undefined) {
      const express = await ShippingMethod.findOne({ zone: zoneId, name: { $regex: /express/i } });
      if (express) {
        express.estimatedMinDays = Number(expressTransitMin);
        express.estimatedMaxDays = Number(expressTransitMax);
        await express.save();
      }
    }

    return { success: true };
  }
}

export const shippingService = new ShippingService();
export default shippingService;
