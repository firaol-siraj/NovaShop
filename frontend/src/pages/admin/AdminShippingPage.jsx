import { useMemo, useRef, useState, useEffect } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import './admin-shipping.css';

const ZONES = [
  {
    id: 'ZN-0001',
    name: 'United States',
    countries: 'United States',
    methods: ['Standard', 'Express', 'Overnight'],
    startingRate: 15,
    freeOver: 300,
    estimatedDelivery: '3–6 days',
    estimatedBasis: '(Standard)',
    status: 'active',
    updated: 'Sep 12, 2026',
    rates: { standard: 15, express: 35, overnight: 60 },
    times: { standard: '3–6 days', express: '1–2 days', overnight: '1 day' },
    handlingTime: '1–2 business days',
  },
  {
    id: 'ZN-0002',
    name: 'Canada',
    countries: 'Canada',
    methods: ['Standard', 'Express'],
    startingRate: 25,
    freeOver: 400,
    estimatedDelivery: '4–8 days',
    estimatedBasis: '',
    status: 'active',
    updated: 'Sep 10, 2026',
    rates: { standard: 25, express: 45, overnight: null },
    times: { standard: '4–8 days', express: '2–4 days', overnight: null },
    handlingTime: '1–2 business days',
  },
  {
    id: 'ZN-0003',
    name: 'United Kingdom & Ireland',
    countries: 'United Kingdom, Ireland',
    methods: ['Standard', 'Express'],
    startingRate: 20,
    freeOver: 350,
    estimatedDelivery: '3–6 days',
    estimatedBasis: '',
    status: 'active',
    updated: 'Sep 08, 2026',
    rates: { standard: 20, express: 40, overnight: null },
    times: { standard: '3–6 days', express: '2–3 days', overnight: null },
    handlingTime: '1–2 business days',
  },
  {
    id: 'ZN-0004',
    name: 'European Union',
    countries: '27 countries',
    methods: ['Standard', 'Express'],
    startingRate: 22,
    freeOver: 400,
    estimatedDelivery: '4–8 days',
    estimatedBasis: '',
    status: 'active',
    updated: 'Sep 06, 2026',
    rates: { standard: 22, express: 42, overnight: null },
    times: { standard: '4–8 days', express: '2–4 days', overnight: null },
    handlingTime: '1–2 business days',
  },
  {
    id: 'ZN-0005',
    name: 'Middle East',
    countries: 'United Arab Emirates, Saudi Arabia, Qatar +3',
    methods: ['Standard', 'Express'],
    startingRate: 30,
    freeOver: 500,
    estimatedDelivery: '5–9 days',
    estimatedBasis: '',
    status: 'active',
    updated: 'Sep 03, 2026',
    rates: { standard: 30, express: 55, overnight: null },
    times: { standard: '5–9 days', express: '3–5 days', overnight: null },
    handlingTime: '1–2 business days',
  },
  {
    id: 'ZN-0006',
    name: 'Asia Pacific',
    countries: 'Singapore, Japan, South Korea +5',
    methods: ['Standard', 'Express'],
    startingRate: 28,
    freeOver: 500,
    estimatedDelivery: '5–10 days',
    estimatedBasis: '',
    status: 'active',
    updated: 'Aug 29, 2026',
    rates: { standard: 28, express: 50, overnight: null },
    times: { standard: '5–10 days', express: '3–5 days', overnight: null },
    handlingTime: '1–2 business days',
  },
  {
    id: 'ZN-0007',
    name: 'Rest of world',
    countries: 'All other countries',
    methods: ['Standard'],
    startingRate: 45,
    freeOver: null,
    estimatedDelivery: '7–14 days',
    estimatedBasis: '',
    status: 'inactive',
    updated: 'Aug 20, 2026',
    rates: { standard: 45, express: null, overnight: null },
    times: { standard: '7–14 days', express: null, overnight: null },
    handlingTime: '1–2 business days',
  },
];

const METHODS = [
  {
    id: 'SM-01',
    name: 'Standard Shipping',
    description: 'Tracked delivery to your door',
    carrier: 'DHL',
    rateStructure: 'Flat rate',
    rateFrom: 15,
    estimatedDelivery: '3–14 days',
    estimatedNote: 'Business days',
    zonesActive: 7,
    status: 'active',
  },
  {
    id: 'SM-02',
    name: 'Express Shipping',
    description: 'Faster tracked delivery',
    carrier: 'FedEx',
    rateStructure: 'Flat rate',
    rateFrom: 35,
    estimatedDelivery: '1–5 days',
    estimatedNote: '',
    zonesActive: 6,
    status: 'active',
  },
  {
    id: 'SM-03',
    name: 'Overnight Shipping',
    description: 'Next business day delivery',
    carrier: 'FedEx',
    rateStructure: 'Flat rate',
    rateFrom: 60,
    estimatedDelivery: '1 day',
    estimatedNote: '',
    zonesActive: 1,
    status: 'active',
  },
  {
    id: 'SM-04',
    name: 'Free Shipping',
    description: 'Free delivery over a minimum order',
    carrier: 'DHL',
    rateStructure: 'Free',
    rateFrom: null,
    rateNote: 'Over $300–$500',
    estimatedDelivery: '3–10 days',
    estimatedNote: '',
    zonesActive: 6,
    status: 'active',
  },
  {
    id: 'SM-05',
    name: 'Store Pickup',
    description: 'Collect from a NovaShop location',
    carrier: 'In-house',
    rateStructure: 'Free',
    rateFrom: null,
    rateNote: 'No charge',
    estimatedDelivery: 'Same day',
    estimatedNote: 'Order before 2pm',
    zonesActive: 1,
    status: 'inactive',
  },
];

const KPI_STATS = [
  { label: 'Delivery zones', value: '7', trend: '+1 this month', tone: 'positive' },
  { label: 'Active methods', value: '4', trend: 'No change', tone: 'neutral' },
  { label: 'Countries covered', value: '48', trend: '+6 this month', tone: 'positive' },
  { label: 'Avg. delivery (days)', value: '4.2', trend: '−0.3 days', tone: 'positive' },
];

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
  if (value === null || value === undefined) return null;
  return `$${value.toFixed(2)}`;
}

function StatusPill({ status }) {
  return (
    <span className={`ship-status-pill is-${status}`}>
      <i />
      {status === 'active' ? 'Active' : 'Inactive'}
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
  const [activeTab, setActiveTab] = useState('zones');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [openRowMenu, setOpenRowMenu] = useState(null);
  const [hoveredZoneId, setHoveredZoneId] = useState(null);
  const [notice, setNotice] = useState('');

  const [rateEdits, setRateEdits] = useState({
    'ZN-0001': { standard: '16.00', express: '38.00' },
  });
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
    window.setTimeout(() => setNotice(''), 2200);
  };

  const filteredZones = useMemo(() => {
    const query = search.trim().toLowerCase();

    return ZONES.filter((zone) => {
      const matchesSearch =
        !query ||
        zone.name.toLowerCase().includes(query) ||
        zone.countries.toLowerCase().includes(query);

      const matchesStatus = statusFilter === 'all' || zone.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter]);

  const filteredMethods = useMemo(() => {
    const query = search.trim().toLowerCase();

    return METHODS.filter((method) => {
      const matchesSearch =
        !query ||
        method.name.toLowerCase().includes(query) ||
        method.carrier.toLowerCase().includes(query);

      const matchesStatus = statusFilter === 'all' || method.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter]);

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

  const handleRowMenuAction = (zone, action) => {
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
      setActiveTab('rates');
      notify(`Showing rates for ${zone.name}.`);
      return;
    }
    if (action === 'delete') {
      notify(`${zone.name} removed from delivery zones.`);
    }
  };

  const handleAddZone = () => {
    if (go) {
      go('/admin/shipping/zones/new');
      return;
    }
    notify('New delivery zone draft created.');
  };

  const handleShippingSettings = () => {
    if (go) {
      go('/admin/settings');
      return;
    }
    notify('Opening global shipping settings…');
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

          <button type="button" className="admin-action-button is-primary" onClick={handleAddZone}>
            <AdminIcon name="plus" size={14} />
            Add zone
          </button>
        </div>
      </section>

      {/* KPI STATS */}
      <div className="ship-period-label">Performance overview · Last 30 days</div>

      <section className="ship-stat-grid admin-stat-grid">
        {KPI_STATS.map((stat) => (
          <article className="admin-stat-card ship-stat-card" key={stat.label}>
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
            {tab.id === 'zones' && <b>{ZONES.length}</b>}
            {tab.id === 'methods' && <b>{METHODS.length}</b>}
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
                {filteredZones.map((zone) => (
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
                            Updated {zone.updated} · {zone.id}
                          </div>
                        )}
                      </div>
                    </td>

                    <td>
                      <span className="ship-methods-count">{zone.methods.length} methods</span>
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

                    <td className="ship-actions-cell">
                      <div
                        className="ship-row-menu-anchor"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="products-row-menu-button"
                          onClick={() =>
                            setOpenRowMenu(openRowMenu === zone.id ? null : zone.id)
                          }
                          aria-label={`Actions for ${zone.name}`}
                        >
                          <AdminIcon name="more" size={15} />
                        </button>

                        {openRowMenu === zone.id && (
                          <div className="ship-row-menu">
                            <button type="button" onClick={() => handleRowMenuAction(zone, 'edit')}>
                              <AdminIcon name="pencil" size={13} />
                              Edit zone
                            </button>
                            <button type="button" onClick={() => handleRowMenuAction(zone, 'rates')}>
                              <AdminIcon name="sliders" size={13} />
                              Manage rates
                            </button>
                            <div className="ship-row-menu-divider" />
                            <button
                              type="button"
                              className="is-danger"
                              onClick={() => handleRowMenuAction(zone, 'delete')}
                            >
                              <AdminIcon name="trash" size={13} />
                              Delete zone
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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
                {filteredMethods.map((method) => (
                  <tr key={method.id}>
                    <td>
                      <div className="ship-method-cell">
                        <strong>{method.name}</strong>
                        <span>{method.description}</span>
                      </div>
                    </td>

                    <td>
                      <span className="ship-carrier-tag">{method.carrier}</span>
                    </td>

                    <td>
                      <strong>{method.rateStructure}</strong>
                      <span className="ship-free-over">
                        {method.rateFrom
                          ? `From ${money(method.rateFrom)}`
                          : method.rateNote}
                      </span>
                    </td>

                    <td>
                      {method.estimatedDelivery}
                      {method.estimatedNote && <em>{method.estimatedNote}</em>}
                    </td>

                    <td>{method.zonesActive} {method.zonesActive === 1 ? 'zone' : 'zones'}</td>

                    <td>
                      <StatusPill status={method.status} />
                    </td>

                    <td className="ship-actions-cell">
                      <div
                        className="ship-row-menu-anchor"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="products-row-menu-button"
                          onClick={() =>
                            setOpenRowMenu(openRowMenu === method.id ? null : method.id)
                          }
                          aria-label={`Actions for ${method.name}`}
                        >
                          <AdminIcon name="more" size={15} />
                        </button>

                        {openRowMenu === method.id && (
                          <div className="ship-row-menu">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenRowMenu(null);
                                if (go) {
                                  go(`/admin/shipping/methods/${method.id}/edit`);
                                  return;
                                }
                                notify(`Editing ${method.name}…`);
                              }}
                            >
                              <AdminIcon name="pencil" size={13} />
                              Edit method
                            </button>
                            <div className="ship-row-menu-divider" />
                            <button
                              type="button"
                              className="is-danger"
                              onClick={() => {
                                setOpenRowMenu(null);
                                notify(`${method.name} disabled.`);
                              }}
                            >
                              <AdminIcon name="stop" size={13} />
                              Disable method
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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
                                  edited.standard ?? zone.rates.standard.toFixed(2)
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
                                  edited.express ?? zone.rates.express.toFixed(2)
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

              <div className="ship-table-footnote">
                <span>Inline rate adjustments will be previewed prior to publication</span>
                {pendingRateEdits > 0 && (
                  <span className="ship-pending-flag">
                    {pendingRateEdits} pending edit{pendingRateEdits === 1 ? '' : 's'} detected
                  </span>
                )}
              </div>
            </>
          )}

          {/* ---------------- DELIVERY TIMES ---------------- */}
          {activeTab === 'times' && (
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
          )}
        </div>

        {activeTab === 'zones' && (
          <div className="ship-table-footnote">
            <span>
              Showing <strong>1–{filteredZones.length}</strong> of {ZONES.length} zones
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