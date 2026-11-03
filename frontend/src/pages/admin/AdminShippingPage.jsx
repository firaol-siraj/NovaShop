import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import AdminRowActionMenu from '../../components/admin/AdminRowActionMenu';
import shippingApi from '../../lib/api/shippingApi';
import './admin-shipping.css';

const STATUS_OPTIONS = [
  { id: 'all', label: 'All statuses' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
];

const TABS = [
  { id: 'zones', label: 'Delivery Zones' },
  { id: 'methods', label: 'Shipping Methods' },
  { id: 'rates', label: 'Shipping Rates' },
  { id: 'times', label: 'Delivery Times' },
];

function money(value) {
  if (value === null || value === undefined || isNaN(value)) return null;
  return `$${Number(value).toFixed(2)}`;
}

function StatusPill({ status }) {
  const norm = (status || 'active').toLowerCase();
  return (
    <span className={`ship-status-pill is-${norm}`}>
      <i />
      {norm === 'active' ? 'Active' : 'Inactive'}
    </span>
  );
}

function FilterDropdown({ label, value, options, isOpen, onToggle, onChange }) {
  const current = options.find((option) => option.id === value);

  return (
    <div className={`ship-filter-dropdown${isOpen ? ' is-open' : ''}`}>
      <button type="button" onClick={onToggle}>
        <span>{current ? current.label : label}</span>
        <AdminIcon name="chevron" size={13} />
      </button>

      {isOpen && (
        <div className="ship-filter-menu" role="menu">
          {options.map((option) => (
            <button
              type="button"
              key={option.id}
              className={option.id === value ? 'is-selected' : ''}
              onClick={() => onChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminShippingPage({ go }) {
  const getInitialParams = () => {
    try {
      const sp = new URLSearchParams(window.location.search);
      return {
        tab: sp.get('tab') || 'zones',
        search: sp.get('search') || '',
        status: sp.get('status') || 'all',
      };
    } catch {
      return { tab: 'zones', search: '', status: 'all' };
    }
  };

  const initialParams = useMemo(getInitialParams, []);
  const [activeTab, setActiveTab] = useState(initialParams.tab);
  const [search, setSearch] = useState(initialParams.search);
  const [statusFilter, setStatusFilter] = useState(initialParams.status);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [openRowMenu, setOpenRowMenu] = useState(null);
  const [hoveredZoneId, setHoveredZoneId] = useState(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  // Sync state to URL search parameters
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (activeTab && activeTab !== 'zones') sp.set('tab', activeTab);
      else sp.delete('tab');

      if (search) sp.set('search', search);
      else sp.delete('search');

      if (statusFilter && statusFilter !== 'all') sp.set('status', statusFilter);
      else sp.delete('status');

      const newQuery = sp.toString() ? `?${sp.toString()}` : '';
      const newUrl = `${window.location.pathname}${newQuery}`;
      if (window.location.search !== newQuery) {
        window.history.replaceState(null, '', newUrl);
      }
    } catch (err) {
      console.warn('[AdminShipping] URL sync warning:', err);
    }
  }, [activeTab, search, statusFilter]);

  // Back/forward navigation popstate listener
  useEffect(() => {
    const handlePopState = () => {
      try {
        const sp = new URLSearchParams(window.location.search);
        setActiveTab(sp.get('tab') || 'zones');
        setSearch(sp.get('search') || '');
        setStatusFilter(sp.get('status') || 'all');
      } catch (err) {
        console.warn('[AdminShipping] PopState warning:', err);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Real backend data state
  const [stats, setStats] = useState(null);
  const [zones, setZones] = useState([]);
  const [methods, setMethods] = useState([]);
  const [shippingRates, setShippingRates] = useState([]);
  const [deliveryTimes, setDeliveryTimes] = useState([]);

  const [rateEdits, setRateEdits] = useState({});
  const [timeEdits, setTimeEdits] = useState({});

  const filterRef = useRef(null);

  useEffect(() => {
    function handleClick(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setStatusDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2500);
  };

  const fetchShippingData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await shippingApi.getAdminStats();
      if (data) {
        setStats(data.stats);
        setZones(data.deliveryZones || []);
        setMethods(data.shippingMethods || []);
        setShippingRates(data.shippingRates || []);
        setDeliveryTimes(data.deliveryTimes || []);
      }
    } catch (err) {
      console.error('[AdminShipping] Error fetching shipping data:', err);
      notify('Failed to load shipping data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShippingData();
  }, [fetchShippingData]);

  const kpiStats = useMemo(() => {
    if (!stats) {
      return [
        { label: 'Delivery zones', value: '0', trend: '-', tone: 'neutral' },
        { label: 'Active methods', value: '0', trend: '-', tone: 'neutral' },
        { label: 'Countries covered', value: '0', trend: '-', tone: 'neutral' },
        { label: 'Avg. delivery (days)', value: '-', trend: '-', tone: 'neutral' },
      ];
    }

    return [
      { label: 'Delivery zones', value: String(stats.zonesCount || 0), trend: stats.zonesDelta || '-', tone: 'neutral' },
      { label: 'Active methods', value: String(stats.methodsCount || 0), trend: stats.methodsDelta || '-', tone: 'neutral' },
      { label: 'Countries covered', value: String(stats.countriesCount || 0), trend: stats.countriesDelta || '-', tone: 'neutral' },
      { label: 'Avg. delivery (days)', value: stats.avgDeliveryDays || '-', trend: stats.avgDeliveryDelta || '-', tone: 'neutral' },
    ];
  }, [stats]);

  // Transform zones with rates & times for the tables
  const formattedZones = useMemo(() => {
    return zones.map((zone) => {
      const zoneMethods = methods.filter((m) => String(m.zoneId || m.zone) === String(zone.id));
      const methodNames = zoneMethods.map((m) => m.name);

      const standardRateDoc = shippingRates.find(
        (r) => String(r.zoneId || r.zone) === String(zone.id) && (r.methodName || '').toLowerCase().includes('standard')
      );
      const expressRateDoc = shippingRates.find(
        (r) => String(r.zoneId || r.zone) === String(zone.id) && (r.methodName || '').toLowerCase().includes('express')
      );
      const overnightRateDoc = shippingRates.find(
        (r) => String(r.zoneId || r.zone) === String(zone.id) && (r.methodName || '').toLowerCase().includes('overnight')
      );

      const standardMethod = zoneMethods.find((m) => (m.name || '').toLowerCase().includes('standard'));
      const expressMethod = zoneMethods.find((m) => (m.name || '').toLowerCase().includes('express'));

      const standardTransit = standardMethod
        ? `${standardMethod.minDays}–${standardMethod.maxDays} days`
        : '2–4 days';
      const expressTransit = expressMethod
        ? `${expressMethod.minDays}–${expressMethod.maxDays} days`
        : null;

      const startingRate = standardRateDoc ? standardRateDoc.amountUSD : (zoneMethods.length > 0 ? 0 : 0);

      const countriesList = Array.isArray(zone.countries) ? zone.countries.join(', ') : zone.countries;

      return {
        id: zone.id,
        name: zone.name,
        countries: countriesList || 'Ethiopia',
        regions: zone.regions || [],
        methods: methodNames.length > 0 ? methodNames : ['Standard Delivery'],
        startingRate,
        freeOver: zone.freeOverThresholdUSD || 300,
        estimatedDelivery: standardTransit,
        estimatedBasis: '(Standard)',
        status: (zone.status || 'active').toLowerCase(),
        updated: 'Active',
        rates: {
          standard: standardRateDoc ? standardRateDoc.amountUSD : 5,
          express: expressRateDoc ? expressRateDoc.amountUSD : (expressMethod ? 15 : null),
          overnight: overnightRateDoc ? overnightRateDoc.amountUSD : null,
          standardRateId: standardRateDoc?.id,
          expressRateId: expressRateDoc?.id,
        },
        times: {
          standard: standardTransit,
          express: expressTransit,
          overnight: null,
        },
        handlingTime: zone.handlingTime || '1–2 business days',
      };
    });
  }, [zones, methods, shippingRates]);

  const filteredZones = useMemo(() => {
    const query = search.trim().toLowerCase();

    return formattedZones.filter((zone) => {
      const matchesSearch =
        !query ||
        zone.name.toLowerCase().includes(query) ||
        zone.countries.toLowerCase().includes(query);

      const matchesStatus = statusFilter === 'all' || zone.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [formattedZones, search, statusFilter]);

  const filteredMethods = useMemo(() => {
    const query = search.trim().toLowerCase();

    return methods.map((m) => ({
      ...m,
      rateFrom: (shippingRates.find((r) => String(r.methodId) === String(m.id))?.amountUSD) ?? null,
      zonesActive: zones.filter((z) => String(z.id) === String(m.zoneId)).length || 1,
    })).filter((method) => {
      const matchesSearch =
        !query ||
        method.name.toLowerCase().includes(query) ||
        method.carrier.toLowerCase().includes(query);

      const matchesStatus = statusFilter === 'all' || (method.status || 'active').toLowerCase() === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [methods, shippingRates, zones, search, statusFilter]);

  const pendingRateEdits = useMemo(() => {
    let count = 0;
    Object.values(rateEdits).forEach((fields) => {
      count += Object.keys(fields).length;
    });
    return count;
  }, [rateEdits]);

  const updateRateEdit = (zoneId, field, value) => {
    setRateEdits((current) => ({
      ...current,
      [zoneId]: { ...current[zoneId], [field]: value },
    }));
  };

  const updateTimeEdit = (zoneId, value) => {
    setTimeEdits((current) => ({ ...current, [zoneId]: value }));
  };

  const handleSaveRates = async () => {
    notify('Saving rate adjustments…');
    try {
      for (const [zoneId, fields] of Object.entries(rateEdits)) {
        const zoneObj = formattedZones.find((z) => z.id === zoneId);
        if (!zoneObj) continue;

        if (fields.standard !== undefined && zoneObj.rates.standardRateId) {
          await shippingApi.updateRate(zoneObj.rates.standardRateId, {
            amountUSD: Number(fields.standard),
            amountETB: Number((Number(fields.standard) * 120).toFixed(2)),
          });
        }
        if (fields.express !== undefined && zoneObj.rates.expressRateId) {
          await shippingApi.updateRate(zoneObj.rates.expressRateId, {
            amountUSD: Number(fields.express),
            amountETB: Number((Number(fields.express) * 120).toFixed(2)),
          });
        }
      }
      setRateEdits({});
      notify('Shipping rates successfully published.');
      fetchShippingData();
    } catch (err) {
      console.error('[AdminShipping] Save rates error:', err);
      notify('Failed to save rate updates.');
    }
  };

  const handleSaveTimes = async () => {
    notify('Updating transit times…');
    try {
      for (const [zoneId, val] of Object.entries(timeEdits)) {
        const match = val.match(/(\d+)\s*[-–]\s*(\d+)/);
        if (match) {
          await shippingApi.updateDeliveryTimes(zoneId, {
            standardTransitMin: Number(match[1]),
            standardTransitMax: Number(match[2]),
          });
        }
      }
      setTimeEdits({});
      notify('Transit times successfully updated.');
      fetchShippingData();
    } catch (err) {
      console.error('[AdminShipping] Save times error:', err);
      notify('Failed to update transit times.');
    }
  };

  const handleRowMenuAction = async (zone, action) => {
    setOpenRowMenu(null);

    if (action === 'edit') {
      if (go) {
        go(`/admin/shipping/zones/${zone.id}/edit`);
        return;
      }
      notify(`Opening ${zone.name} for editing…`);
      return;
    }
    if (action === 'rates') {
      if (go) {
        go(`/admin/shipping/zones/${zone.id}/rates`);
        return;
      }
      setActiveTab('rates');
      notify(`Showing rates for ${zone.name}.`);
      return;
    }
    if (action === 'toggle') {
      const nextStatus = zone.status === 'active' ? 'inactive' : 'active';
      try {
        await shippingApi.updateZone(zone.id, { status: nextStatus });
        notify(`Zone ${zone.name} is now ${nextStatus}.`);
        fetchShippingData();
      } catch (err) {
        notify(err.response?.data?.message || 'Failed to update zone status');
      }
      return;
    }
    if (action === 'duplicate') {
      try {
        await shippingApi.createZone({
          name: `${zone.name} (Copy)`,
          countries: Array.isArray(zone.countries) ? zone.countries : [zone.countries || 'Ethiopia'],
          regions: zone.regions || [],
          status: 'inactive',
          freeOverThresholdUSD: zone.freeOverThresholdUSD || 300,
          handlingTime: zone.handlingTime || '1–2 business days',
        });
        notify(`Duplicated ${zone.name}.`);
        fetchShippingData();
      } catch (err) {
        notify(err.response?.data?.message || 'Failed to duplicate zone');
      }
      return;
    }
    if (action === 'delete') {
      if (window.confirm(`Are you sure you want to delete zone "${zone.name}"?`)) {
        try {
          await shippingApi.deleteZone(zone.id);
          notify(`${zone.name} removed from delivery zones.`);
          fetchShippingData();
        } catch (err) {
          notify(err.response?.data?.message || 'Failed to delete zone.');
        }
      }
    }
  };

  const handleAddZone = () => {
    if (go) {
      go('/admin/shipping/zones/new');
      return;
    }
    notify('Opening new delivery zone dialog…');
  };

  const handleAddMethod = () => {
    if (go) {
      go('/admin/shipping/methods/new');
      return;
    }
    notify('Opening new shipping method dialog…');
  };

  const handleShippingSettings = () => {
    if (go) {
      go('/admin/shipping/settings');
      return;
    }
    notify('Opening shipping operational settings…');
  };

  return (
    <div className="admin-dashboard shipping-page" onClick={() => setOpenRowMenu(null)}>
      {/* HEADER */}
      <section className="admin-page-heading ship-heading">
        <div>
          <h1 className="admin-page-title">Shipping</h1>
          <p className="admin-page-description">
            Manage delivery zones, shipping methods, rates, and delivery times.
          </p>
        </div>

        <div className="admin-page-actions">
          <button type="button" className="admin-action-button" onClick={handleShippingSettings}>
            <AdminIcon name="sliders" size={14} />
            Shipping settings
          </button>

          {activeTab === 'methods' ? (
            <button type="button" className="admin-action-button is-primary" onClick={handleAddMethod}>
              <AdminIcon name="plus" size={14} />
              Add method
            </button>
          ) : (
            <button type="button" className="admin-action-button is-primary" onClick={handleAddZone}>
              <AdminIcon name="plus" size={14} />
              Add zone
            </button>
          )}
        </div>
      </section>

      {/* KPI STATS */}
      <div className="ship-period-label">Performance overview · Last 30 days</div>

      <section className="ship-stat-grid admin-stat-grid">
        {kpiStats.map((stat) => (
          <article
            className="admin-stat-card ship-stat-card"
            key={stat.label}
            style={{ cursor: 'pointer' }}
            onClick={() => {
              if (stat.label === 'Active zones') {
                setActiveTab('zones');
                setStatusFilter('active');
              } else if (stat.label === 'Active methods') {
                setActiveTab('methods');
                setStatusFilter('active');
              } else if (stat.label === 'Avg. transit time') {
                setActiveTab('times');
              }
            }}
            title={`Filter by ${stat.label}`}
          >
            <span className="admin-stat-label">{stat.label}</span>

            <div className="ship-stat-row">
              <strong className="admin-stat-value">{stat.value}</strong>
              <span className={`ship-trend-pill is-${stat.tone}`}>{stat.trend}</span>
            </div>
          </article>
        ))}
      </section>

      {/* TOOLBAR */}
      <section className="ship-toolbar">
        <label className="products-search-field ship-search-field">
          <AdminIcon name="search" size={13} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter by zone name or country…"
          />
        </label>

        <div ref={filterRef}>
          <FilterDropdown
            label="Status"
            value={statusFilter}
            options={STATUS_OPTIONS}
            isOpen={statusDropdownOpen}
            onToggle={() => setStatusDropdownOpen((open) => !open)}
            onChange={(value) => {
              setStatusFilter(value);
              setStatusDropdownOpen(false);
            }}
          />
        </div>

        {(search || statusFilter !== 'all') && (
          <button
            type="button"
            className="ship-clear-filter-btn"
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
            }}
          >
            Clear filters
          </button>
        )}
      </section>

      {/* TABS */}
      <div className="ship-tabs">
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab.id}
            className={`ship-tab ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.id === 'zones' && <b>{zones.length}</b>}
            {tab.id === 'methods' && <b>{methods.length}</b>}
          </button>
        ))}
      </div>

      {/* TABLE CARD */}
      <section className="ship-table-card">
        <div className="ship-table-scroll">
          {/* ---------------- DELIVERY ZONES ---------------- */}
          {activeTab === 'zones' && (
            <table className="ship-table">
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Methods</th>
                  <th>Starting rate</th>
                  <th>Estimated delivery</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredZones.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#8A847C' }}>
                      {loading ? 'Loading shipping zones…' : 'No delivery zones found.'}
                    </td>
                  </tr>
                ) : (
                  filteredZones.map((zone) => (
                    <tr key={zone.id}>
                      <td>
                        <div
                          className="ship-zone-cell"
                          onMouseEnter={() => setHoveredZoneId(zone.id)}
                          onMouseLeave={() => setHoveredZoneId(null)}
                        >
                          <strong>{zone.name}</strong>
                          <span>{zone.countries}</span>

                          {hoveredZoneId === zone.id && (
                            <div className="ship-tooltip">
                              Free over ${zone.freeOver} · Handling: {zone.handlingTime}
                            </div>
                          )}
                        </div>
                      </td>

                      <td>
                        <span className="ship-methods-count">
                          {zone.methods.length} {zone.methods.length === 1 ? 'method' : 'methods'}
                        </span>
                        <span className="ship-methods-list">({zone.methods.join(', ')})</span>
                      </td>

                      <td>
                        <strong>{money(zone.startingRate)}</strong>
                        <span className="ship-free-over">
                          {zone.freeOver ? `Free over $${zone.freeOver}` : 'No free shipping'}
                        </span>
                      </td>

                      <td>{zone.estimatedDelivery} {zone.estimatedBasis && <em>{zone.estimatedBasis}</em>}</td>

                      <td>
                        <StatusPill status={zone.status} />
                      </td>

                      <td className="ship-actions-cell" onClick={(e) => e.stopPropagation()}>
                        <AdminRowActionMenu
                          item={zone}
                          title={zone.name}
                          subtitle={`${zone.regions?.length || 0} ${(zone.regions?.length || 0) === 1 ? 'region' : 'regions'} · ${zone.status || 'Active'}`}
                          items={[
                            {
                              label: 'Edit zone',
                              icon: 'edit',
                              onClick: () => handleRowMenuAction(zone, 'edit'),
                            },
                            {
                              label: 'Manage rates',
                              icon: 'sliders',
                              onClick: () => handleRowMenuAction(zone, 'rates'),
                            },
                            {
                              label: zone.status === 'active' ? 'Deactivate zone' : 'Activate zone',
                              icon: zone.status === 'active' ? 'stop' : 'check',
                              onClick: () => handleRowMenuAction(zone, 'toggle'),
                            },
                            {
                              label: 'Duplicate zone',
                              icon: 'duplicate',
                              onClick: () => handleRowMenuAction(zone, 'duplicate'),
                            },
                            {
                              divider: true,
                            },
                            {
                              label: 'Delete zone',
                              icon: 'trash',
                              danger: true,
                              onClick: () => handleRowMenuAction(zone, 'delete'),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* ---------------- SHIPPING METHODS ---------------- */}
          {activeTab === 'methods' && (
            <table className="ship-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Carrier</th>
                  <th>Rate structure</th>
                  <th>Estimated delivery</th>
                  <th>Zones active</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredMethods.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#8A847C' }}>
                      {loading ? 'Loading shipping methods…' : 'No shipping methods found.'}
                    </td>
                  </tr>
                ) : (
                  filteredMethods.map((method) => (
                    <tr key={method.id}>
                      <td>
                        <div className="ship-method-cell">
                          <strong>{method.name}</strong>
                          <span>{method.description || 'Doorstep courier service'}</span>
                        </div>
                      </td>

                      <td>
                        <span className="ship-carrier-tag">{method.carrier}</span>
                      </td>

                      <td>
                        <strong>{method.rateStructure || 'Flat rate'}</strong>
                        <span className="ship-free-over">
                          {method.rateFrom !== null
                            ? `From ${money(method.rateFrom)}`
                            : 'Standard rates apply'}
                        </span>
                      </td>

                      <td>
                        {method.estimatedDelivery}
                      </td>

                      <td>{method.zonesActive} {method.zonesActive === 1 ? 'zone' : 'zones'}</td>

                      <td>
                        <StatusPill status={method.status || 'active'} />
                      </td>

                      <td className="ship-actions-cell" onClick={(e) => e.stopPropagation()}>
                        <AdminRowActionMenu
                          item={method}
                          title={method.name}
                          subtitle={`${method.carrier || 'Standard'} · ${method.status || 'Active'}`}
                          items={[
                            {
                              label: 'Edit method',
                              icon: 'edit',
                              onClick: () => {
                                if (go) {
                                  go(`/admin/shipping/methods/${method.id}/edit`);
                                  return;
                                }
                                notify(`Editing ${method.name}…`);
                              },
                            },
                            {
                              label: (method.status || 'active').toLowerCase() === 'active' ? 'Disable method' : 'Enable method',
                              icon: (method.status || 'active').toLowerCase() === 'active' ? 'stop' : 'check',
                              onClick: async () => {
                                const nextStatus = (method.status || 'active').toLowerCase() === 'active' ? 'inactive' : 'active';
                                try {
                                  await shippingApi.updateMethod(method.id, { status: nextStatus });
                                  notify(`${method.name} is now ${nextStatus}.`);
                                  fetchShippingData();
                                } catch {
                                  notify('Failed to update method status.');
                                }
                              },
                            },
                            {
                              label: 'Duplicate method',
                              icon: 'duplicate',
                              onClick: async () => {
                                try {
                                  await shippingApi.createMethod({
                                    name: `${method.name} (Copy)`,
                                    zone: method.zoneId,
                                    carrier: method.carrier,
                                    rateStructure: method.rateStructure,
                                    estimatedMinDays: method.minDays || 2,
                                    estimatedMaxDays: method.maxDays || 4,
                                    estimatedDeliveryNote: method.deliveryNote || 'business days',
                                    status: 'inactive',
                                    rateUSD: 5,
                                    rateETB: 150,
                                  });
                                  notify(`Duplicated ${method.name}.`);
                                  fetchShippingData();
                                } catch {
                                  notify('Failed to duplicate method.');
                                }
                              },
                            },
                            {
                              divider: true,
                            },
                            {
                              label: 'Delete method',
                              icon: 'trash',
                              danger: true,
                              onClick: async () => {
                                if (!window.confirm(`Are you sure you want to delete "${method.name}"?`)) return;
                                try {
                                  await shippingApi.deleteMethod(method.id);
                                  notify(`${method.name} deleted.`);
                                  fetchShippingData();
                                } catch {
                                  notify('Failed to delete method.');
                                }
                              },
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* ---------------- SHIPPING RATES ---------------- */}
          {activeTab === 'rates' && (
            <>
              <table className="ship-table">
                <thead>
                  <tr>
                    <th>Zone</th>
                    <th>Standard shipping</th>
                    <th>Express shipping</th>
                    <th>Overnight shipping</th>
                    <th>Free shipping over</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredZones.map((zone) => {
                    const edited = rateEdits[zone.id] || {};

                    return (
                      <tr key={zone.id}>
                        <td>
                          <strong>{zone.name}</strong>
                        </td>

                        <td>
                          {zone.rates.standard !== null ? (
                            <div
                              className={`ship-rate-input ${
                                'standard' in edited ? 'is-pending' : ''
                              }`}
                            >
                              <span>$</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={
                                  edited.standard ?? (zone.rates.standard !== undefined ? zone.rates.standard.toFixed(2) : '5.00')
                                }
                                onChange={(event) =>
                                  updateRateEdit(zone.id, 'standard', event.target.value)
                                }
                              />
                            </div>
                          ) : (
                            <span className="ship-not-offered">Not offered</span>
                          )}
                        </td>

                        <td>
                          {zone.rates.express !== null ? (
                            <div
                              className={`ship-rate-input ${
                                'express' in edited ? 'is-pending' : ''
                              }`}
                            >
                              <span>$</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={
                                  edited.express ?? (zone.rates.express !== undefined ? zone.rates.express.toFixed(2) : '15.00')
                                }
                                onChange={(event) =>
                                  updateRateEdit(zone.id, 'express', event.target.value)
                                }
                              />
                            </div>
                          ) : (
                            <span className="ship-not-offered">Not offered</span>
                          )}
                        </td>

                        <td>
                          {zone.rates.overnight !== null ? (
                            <strong>{money(zone.rates.overnight)}</strong>
                          ) : (
                            <span className="ship-not-offered">Not offered</span>
                          )}
                        </td>

                        <td>
                          {zone.freeOver ? (
                            <strong>{money(zone.freeOver)}</strong>
                          ) : (
                            <span className="ship-not-offered">Not offered</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="ship-table-footnote" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Inline rate adjustments will be previewed prior to publication</span>
                {pendingRateEdits > 0 && (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span className="ship-pending-flag">
                      {pendingRateEdits} pending edit{pendingRateEdits === 1 ? '' : 's'} detected
                    </span>
                    <button
                      type="button"
                      className="admin-action-button is-primary"
                      style={{ padding: '4px 12px', fontSize: '12px' }}
                      onClick={handleSaveRates}
                    >
                      Save changes
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ---------------- DELIVERY TIMES ---------------- */}
          {activeTab === 'times' && (
            <>
              <table className="ship-table">
                <thead>
                  <tr>
                    <th>Zone</th>
                    <th>Standard shipping</th>
                    <th>Express shipping</th>
                    <th>Overnight shipping</th>
                    <th>Internal handling time</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredZones.map((zone) => (
                    <tr key={zone.id}>
                      <td>
                        <strong>{zone.name}</strong>
                      </td>

                      <td>
                        <div className="ship-time-input">
                          <input
                            type="text"
                            value={timeEdits[zone.id] ?? zone.times.standard}
                            onChange={(event) => updateTimeEdit(zone.id, event.target.value)}
                          />
                        </div>
                      </td>

                      <td>
                        {zone.times.express || (
                          <span className="ship-not-offered">Not offered</span>
                        )}
                      </td>

                      <td>
                        {zone.times.overnight || (
                          <span className="ship-not-offered">Not offered</span>
                        )}
                      </td>

                      <td>
                        <div className="ship-handling-cell">
                          <span>{zone.handlingTime}</span>
                          <em>(Read-only)</em>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {Object.keys(timeEdits).length > 0 && (
                <div className="ship-table-footnote" style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px' }}>
                  <button
                    type="button"
                    className="admin-action-button is-primary"
                    style={{ padding: '6px 14px', fontSize: '13px' }}
                    onClick={handleSaveTimes}
                  >
                    Save delivery times
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {activeTab === 'zones' && (
          <div className="ship-table-footnote">
            <span>
              Showing <strong>1–{filteredZones.length}</strong> of {zones.length} zones
            </span>
            <span>All active zones synced with checkout</span>
          </div>
        )}
      </section>

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
