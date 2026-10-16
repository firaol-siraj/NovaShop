import { useState, useEffect } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import '../../components/admin/admin-dashboard.css';
import './admin-settings.css';

const MOCK_TAX_REGIONS = [
  { id: '1', region: 'United States', sub: 'Calculated by state', taxName: 'Sales tax', min: '0.00%', max: '10.25%', status: 'Active' },
  { id: '2', region: 'Canada', sub: 'All provinces', taxName: 'GST / HST', min: '5.00%', max: '15.00%', status: 'Active' },
  { id: '3', region: 'United Kingdom', sub: 'United Kingdom', taxName: 'VAT', min: '20.00%', max: '20.00%', status: 'Active' },
  { id: '4', region: 'European Union', sub: '27 countries', taxName: 'VAT', min: '17.00%', max: '27.00%', status: 'Active' },
  { id: '5', region: 'Singapore', sub: 'Singapore', taxName: 'GST', min: '9.00%', max: '9.00%', status: 'Active' },
  { id: '6', region: 'United Arab Emirates', sub: 'United Arab Emirates', taxName: 'VAT', min: '5.00%', max: '5.00%', status: 'Inactive' },
];

export default function AdminSettingsPage({ currentPath }) {
  // Determine active tab from URL or default to Store details
  const pathParts = currentPath.split('/');
  const defaultTab = pathParts[3] || 'store';
  
  const [activeTab, setActiveTab] = useState(defaultTab);
  
  // Store details state
  const [storeSettings, setStoreSettings] = useState({
    storeName: 'NovaShop',
    legalName: 'NovaShop Inc.',
    email: 'support@novashop.com',
    phone: '+1 (212) 555-0100',
    address: '350 Fifth Avenue, Suite 4200',
    city: 'New York',
    state: 'NY',
    postalCode: '10118',
    country: 'United States',
    orderPrefix: 'NS-',
    timezone: '(GMT-05:00) Eastern Time',
    storefrontAccess: 'Open',
    password: ''
  });

  // Tax settings state
  const [taxSettings, setTaxSettings] = useState({
    collectTax: true,
    includeTax: false,
    chargeShipping: true,
  });

  const [taxRegions, setTaxRegions] = useState(MOCK_TAX_REGIONS);
  const [toast, setToast] = useState(null);

  // Handle saving
  const handleSave = () => {
    // In a real app, make API call here
    setToast('Settings saved successfully');
    setTimeout(() => setToast(null), 3000);
  };

  const handleDiscard = () => {
    // Reset to initial mock state
    if (activeTab === 'store') {
      setStoreSettings({
        storeName: 'NovaShop',
        legalName: 'NovaShop Inc.',
        email: 'support@novashop.com',
        phone: '+1 (212) 555-0100',
        address: '350 Fifth Avenue, Suite 4200',
        city: 'New York',
        state: 'NY',
        postalCode: '10118',
        country: 'United States',
        orderPrefix: 'NS-',
        timezone: '(GMT-05:00) Eastern Time',
        storefrontAccess: 'Open',
        password: ''
      });
    } else if (activeTab === 'taxes') {
      setTaxSettings({ collectTax: true, includeTax: false, chargeShipping: true });
      setTaxRegions(MOCK_TAX_REGIONS);
    }
  };

  return (
    <div className="admin-dashboard settings-page">
      <div className="settings-page-header">
        <div className="settings-page-title-group">
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#8A847C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>CONFIGURATION & OPERATIONS</div>
          <h1 className="admin-page-title">Settings</h1>
          <p className="admin-page-description">Manage your store details, taxes, team, and notifications.</p>
        </div>
        <div className="settings-page-actions">
          {activeTab === 'team' ? (
            <button className="settings-save-btn">+ INVITE MEMBER</button>
          ) : (
            <>
              <button className="settings-discard-btn" onClick={handleDiscard}>DISCARD</button>
              <button className="settings-save-btn" onClick={handleSave}>SAVE CHANGES</button>
            </>
          )}
        </div>
      </div>

      <div className="settings-layout">
        <aside className="settings-sidebar">
          <nav className="settings-nav-card">
            <button 
              className={`settings-nav-item ${activeTab === 'store' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('store')}
            >
              <AdminIcon name="store" size={16} /> Store details
            </button>
            <button 
              className={`settings-nav-item ${activeTab === 'taxes' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('taxes')}
            >
              <AdminIcon name="percent" size={16} /> Taxes
            </button>
            <button 
              className={`settings-nav-item ${activeTab === 'team' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('team')}
            >
              <AdminIcon name="customers" size={16} /> Team and permissions
            </button>
            <button 
              className={`settings-nav-item ${activeTab === 'notifications' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              <AdminIcon name="bell" size={16} /> Notifications
            </button>
          </nav>
          <div className="settings-nav-helper">
            Shipping, payments, and support options have their own dedicated administrative pages.
          </div>
        </aside>

        <main className="settings-content">
          {activeTab === 'store' && <StoreDetails settings={storeSettings} onChange={setStoreSettings} />}
          {activeTab === 'taxes' && <TaxSettings settings={taxSettings} onChange={setTaxSettings} regions={taxRegions} setRegions={setTaxRegions} />}
          {activeTab === 'team' && <TeamSettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
        </main>
      </div>

      {toast && (
        <div className="settings-toast">
          <AdminIcon name="check" size={16} style={{color: 'var(--admin-positive)'}} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

function StoreDetails({ settings, onChange }) {
  const updateField = (field, value) => {
    onChange(prev => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <section className="settings-card">
        <div className="settings-card-header">
          <h2 className="settings-card-title">Store profile</h2>
          <p className="settings-card-desc">Basic brand and contact details visible on customer receipts and transactional invoices.</p>
        </div>
        <div className="settings-form-row">
          <div className="settings-form-group">
            <label className="settings-form-label">STORE NAME</label>
            <input 
              type="text" 
              className="settings-form-input" 
              value={settings.storeName} 
              onChange={e => updateField('storeName', e.target.value)} 
            />
          </div>
          <div className="settings-form-group">
            <label className="settings-form-label">LEGAL BUSINESS NAME</label>
            <input 
              type="text" 
              className="settings-form-input" 
              value={settings.legalName} 
              onChange={e => updateField('legalName', e.target.value)} 
            />
          </div>
        </div>
        <div className="settings-form-row">
          <div className="settings-form-group">
            <label className="settings-form-label">STORE EMAIL</label>
            <input 
              type="email" 
              className="settings-form-input" 
              value={settings.email} 
              onChange={e => updateField('email', e.target.value)} 
            />
            <div className="settings-input-helper">Customers see this on emails and digital receipts.</div>
          </div>
          <div className="settings-form-group">
            <label className="settings-form-label">PHONE</label>
            <input 
              type="tel" 
              className="settings-form-input" 
              value={settings.phone} 
              onChange={e => updateField('phone', e.target.value)} 
            />
          </div>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-header">
          <h2 className="settings-card-title">Business address</h2>
          <p className="settings-card-desc">Used on invoices, tax filings, and shipping customs documentation.</p>
        </div>
        <div className="settings-form-row single">
          <div className="settings-form-group">
            <label className="settings-form-label">ADDRESS</label>
            <input 
              type="text" 
              className="settings-form-input" 
              value={settings.address} 
              onChange={e => updateField('address', e.target.value)} 
            />
          </div>
        </div>
        <div className="settings-form-row">
          <div className="settings-form-group">
            <label className="settings-form-label">CITY</label>
            <input 
              type="text" 
              className="settings-form-input" 
              value={settings.city} 
              onChange={e => updateField('city', e.target.value)} 
            />
          </div>
          <div className="settings-form-group">
            <label className="settings-form-label">STATE OR REGION</label>
            <input 
              type="text" 
              className="settings-form-input" 
              value={settings.state} 
              onChange={e => updateField('state', e.target.value)} 
            />
          </div>
        </div>
        <div className="settings-form-row">
          <div className="settings-form-group">
            <label className="settings-form-label">POSTAL CODE</label>
            <input 
              type="text" 
              className="settings-form-input" 
              value={settings.postalCode} 
              onChange={e => updateField('postalCode', e.target.value)} 
            />
            <div className="settings-input-helper" style={{marginTop: '4px'}}>Primary administrative address printed on all official transaction notes.</div>
          </div>
          <div className="settings-form-group">
            <label className="settings-form-label">COUNTRY</label>
            <select 
              className="settings-form-input settings-form-select" 
              value={settings.country} 
              onChange={e => updateField('country', e.target.value)}
            >
              <option>United States</option>
              <option>Canada</option>
              <option>United Kingdom</option>
            </select>
          </div>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-header">
          <h2 className="settings-card-title">Regional settings</h2>
          <p className="settings-card-desc">Determine ledger presentation currency, local time zones, and invoice sequences.</p>
        </div>
        <div className="settings-form-row">
          <div className="settings-form-group">
            <label className="settings-form-label">STORE CURRENCY</label>
            <div className="settings-input-icon-wrap">
              <span className="settings-input-icon"><AdminIcon name="lock" size={14} /></span>
              <input 
                type="text" 
                className="settings-form-input settings-input-with-icon" 
                value="USD – US dollar" 
                readOnly 
              />
            </div>
            <div className="settings-input-helper">Currency cannot be altered after processing live orders. Contact concierge support.</div>
          </div>
          <div className="settings-form-group">
            <label className="settings-form-label">TIME ZONE</label>
            <select 
              className="settings-form-input settings-form-select" 
              value={settings.timezone} 
              onChange={e => updateField('timezone', e.target.value)}
            >
              <option>(GMT-05:00) Eastern Time</option>
              <option>(GMT-08:00) Pacific Time</option>
              <option>(GMT+00:00) UTC</option>
            </select>
          </div>
        </div>
        <div className="settings-form-row single" style={{marginTop: '12px'}}>
          <div className="settings-form-group" style={{maxWidth: '240px'}}>
            <label className="settings-form-label">ORDER NUMBER PREFIX</label>
            <input 
              type="text" 
              className="settings-form-input" 
              value={settings.orderPrefix} 
              onChange={e => updateField('orderPrefix', e.target.value)} 
            />
            <div className="settings-input-helper">Orders appear as #{settings.orderPrefix}10482 in customer accounts and warehouse picks.</div>
          </div>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-header">
          <h2 className="settings-card-title">Branding</h2>
          <p className="settings-card-desc">Used across customer checkout headers, email templates, and web bookmarks.</p>
        </div>
        <div className="settings-branding-grid">
          <div className="settings-branding-panel">
            <div className="settings-branding-preview">N</div>
            <div className="settings-branding-info">
              <div className="settings-branding-name">LOGO</div>
              <div className="settings-branding-meta">400x400px • PNG</div>
            </div>
            <button className="settings-branding-btn">REPLACE</button>
          </div>
          <div className="settings-branding-panel">
            <div className="settings-branding-preview favicon">N</div>
            <div className="settings-branding-info">
              <div className="settings-branding-name">Favicon</div>
              <div className="settings-branding-meta">32x32px • ICO</div>
            </div>
            <button className="settings-branding-btn">REPLACE</button>
          </div>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-header">
          <h2 className="settings-card-title">Storefront access</h2>
          <p className="settings-card-desc">Control public shopping availability or restrict preview access with a passphrase.</p>
        </div>
        <div className="settings-segmented-control">
          <button 
            className={`settings-segment ${settings.storefrontAccess === 'Open' ? 'is-active' : ''}`}
            onClick={() => updateField('storefrontAccess', 'Open')}
          >
            Open
          </button>
          <button 
            className={`settings-segment ${settings.storefrontAccess === 'Password protected' ? 'is-active' : ''}`}
            onClick={() => updateField('storefrontAccess', 'Password protected')}
          >
            Password protected
          </button>
        </div>
        <div className="settings-segment-desc">
          {settings.storefrontAccess === 'Open' ? 
            'Anyone can visit your storefront and complete checkout orders.' :
            'Only visitors with the password can access your store.'
          }
        </div>
        
        {settings.storefrontAccess === 'Password protected' && (
          <div className="settings-form-row single">
            <div className="settings-form-group" style={{maxWidth: '300px'}}>
              <label className="settings-form-label">PASSWORD</label>
              <input 
                type="password" 
                className="settings-form-input" 
                placeholder="Enter password..."
                value={settings.password}
                onChange={e => updateField('password', e.target.value)}
              />
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function TaxSettings({ settings, onChange, regions, setRegions }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null); // id of row

  // Handle outside click for menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuOpen && !event.target.closest('.settings-table-actions')) {
        setMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const updateToggle = (field, value) => {
    onChange(prev => ({ ...prev, [field]: value }));
  };

  const toggleRegionStatus = (id, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    setRegions(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    setMenuOpen(null);
  };

  const deleteRegion = (id) => {
    setRegions(prev => prev.map(r => r.id === id ? { ...r, status: 'Deleted' } : r).filter(r => r.status !== 'Deleted'));
    setMenuOpen(null);
  };

  return (
    <>
      <section className="settings-card">
        <div className="settings-card-header">
          <h2 className="settings-card-title">Tax collection</h2>
          <p className="settings-card-desc">Specify automated fiscal calculation rules applied during checkout cart valuation.</p>
        </div>
        
        <div className="settings-tax-row">
          <div className="settings-tax-row-info">
            <div className="settings-tax-row-title">Collect tax on orders</div>
            <div className="settings-tax-row-desc">Automatically calculate and apply taxes based on customer shipping destinations.</div>
          </div>
          <label className="settings-toggle">
            <input type="checkbox" checked={settings.collectTax} onChange={e => updateToggle('collectTax', e.target.checked)} />
            <span className="settings-toggle-slider"></span>
          </label>
        </div>

        <div className="settings-tax-row">
          <div className="settings-tax-row-info">
            <div className="settings-tax-row-title">Prices include tax</div>
            <div className="settings-tax-row-desc">Gross catalog pricing displays tax-inclusive values (standard in UK and EU jurisdictions).</div>
          </div>
          <label className="settings-toggle">
            <input type="checkbox" checked={settings.includeTax} onChange={e => updateToggle('includeTax', e.target.checked)} />
            <span className="settings-toggle-slider"></span>
          </label>
        </div>

        <div className="settings-tax-row">
          <div className="settings-tax-row-info">
            <div className="settings-tax-row-title">Charge tax on shipping</div>
            <div className="settings-tax-row-desc">Apply standard local jurisdiction tax brackets to shipping and fulfillment charges.</div>
          </div>
          <label className="settings-toggle">
            <input type="checkbox" checked={settings.chargeShipping} onChange={e => updateToggle('chargeShipping', e.target.checked)} />
            <span className="settings-toggle-slider"></span>
          </label>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-tax-header">
          <div>
            <h2 className="settings-card-title">Tax rates</h2>
            <p className="settings-card-desc">Manage country jurisdictions, provinces, and automated calculation rules.</p>
          </div>
          <button className="settings-add-region-btn" onClick={() => setModalOpen(true)}>
            <AdminIcon name="plus" size={14} /> Add region
          </button>
        </div>

        <div className="settings-table-wrapper">
          <table className="settings-table">
            <thead>
              <tr>
                <th>REGION</th>
                <th>TAX NAME</th>
                <th>RATE</th>
                <th>STATUS</th>
                <th style={{textAlign: 'right'}}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {regions.map(r => (
                <tr key={r.id}>
                  <td>
                    <div className="settings-region-cell">
                      <span className="settings-region-name">{r.region}</span>
                      <span className="settings-region-sub">{r.sub}</span>
                    </div>
                  </td>
                  <td><span className="settings-tax-name">{r.taxName}</span></td>
                  <td>
                    <span className="settings-tax-rate">
                      {r.min === r.max ? r.min : `${r.min} – ${r.max}`}
                    </span>
                  </td>
                  <td>
                    <span className={`settings-status-pill ${r.status.toLowerCase()}`}>
                      <i className="settings-status-dot"></i> {r.status}
                    </span>
                  </td>
                  <td className="settings-table-actions">
                    <button className="settings-action-btn" onClick={() => setMenuOpen(menuOpen === r.id ? null : r.id)}>
                      <AdminIcon name="more" size={16} />
                    </button>
                    {menuOpen === r.id && (
                      <div className="settings-dropdown">
                        <button><AdminIcon name="pencil" size={14} /> Edit tax rate</button>
                        <button><AdminIcon name="eye" size={14} /> View details</button>
                        <button onClick={() => toggleRegionStatus(r.id, r.status)}>
                          <AdminIcon name={r.status === 'Active' ? 'stop' : 'check'} size={14} /> 
                          {r.status === 'Active' ? 'Disable region' : 'Enable region'}
                        </button>
                        <button onClick={() => deleteRegion(r.id)} style={{color: '#D34D4D'}}>
                          <AdminIcon name="trash" size={14} /> Delete region
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="settings-table-footer">
          <span>Showing 1–{regions.length} of {regions.length} regions</span>
          <span>Nexus Auto-Resolution Engine: Nominal</span>
        </div>
      </section>

      {modalOpen && (
        <div className="settings-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="settings-modal" onClick={e => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3 className="settings-modal-title">Add tax region</h3>
              <button className="settings-modal-close" onClick={() => setModalOpen(false)}>
                <AdminIcon name="close" size={18} />
              </button>
            </div>
            <div className="settings-modal-body">
              <div className="settings-form-group" style={{marginBottom: '16px'}}>
                <label className="settings-form-label">COUNTRY / REGION</label>
                <select className="settings-form-input settings-form-select">
                  <option>Select country...</option>
                  <option>Australia</option>
                  <option>Japan</option>
                  <option>Mexico</option>
                </select>
              </div>
              <div className="settings-form-group" style={{marginBottom: '16px'}}>
                <label className="settings-form-label">TAX NAME</label>
                <input type="text" className="settings-form-input" placeholder="e.g. VAT, GST" />
              </div>
              <div className="settings-form-row">
                <div className="settings-form-group">
                  <label className="settings-form-label">RATE %</label>
                  <input type="number" className="settings-form-input" placeholder="0.00" />
                </div>
                <div className="settings-form-group">
                  <label className="settings-form-label">STATUS</label>
                  <select className="settings-form-input settings-form-select">
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="settings-modal-footer">
              <button className="settings-discard-btn" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="settings-save-btn" onClick={() => setModalOpen(false)}>Save region</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TeamSettings() {
  const [activeSubTab, setActiveSubTab] = useState('members');

  const permissions = [
    { domain: 'Orders', owner: 'Full', admin: 'Full', storeManager: 'Full', supportAgent: 'View', contentEditor: '—' },
    { domain: 'Products and Inventory', owner: 'Full', admin: 'Full', storeManager: 'Full', supportAgent: 'View', contentEditor: '—' },
    { domain: 'Customers', owner: 'Full', admin: 'Full', storeManager: 'Full', supportAgent: 'View', contentEditor: '—' },
    { domain: 'Customer Support', owner: 'Full', admin: 'Full', storeManager: 'Full', supportAgent: 'Full', contentEditor: '—' },
    { domain: 'Payments', owner: 'Full', admin: 'Full', storeManager: 'View', supportAgent: '—', contentEditor: '—' },
    { domain: 'Analytics', owner: 'Full', admin: 'Full', storeManager: 'View', supportAgent: '—', contentEditor: '—' },
    { domain: 'Discounts', owner: 'Full', admin: 'Full', storeManager: 'Full', supportAgent: '—', contentEditor: '—' },
    { domain: 'Content', owner: 'Full', admin: 'Full', storeManager: 'Full', supportAgent: '—', contentEditor: 'Full' },
    { domain: 'Settings and Team', owner: 'Full', admin: 'Full', storeManager: '—', supportAgent: '—', contentEditor: '—' },
  ];

  const mockMembers = [
    { id: 1, name: 'Marcus Hale', initials: 'MH', email: 'marcus.hale@novashop.com', role: 'Owner', lastActive: '2 hours ago', status: 'Active', isYou: false },
    { id: 2, name: 'Elena Vasquez', initials: 'EV', email: 'elena.vasquez@novashop.com', role: 'Store Manager', lastActive: 'Active now', status: 'Active', isYou: true },
    { id: 3, name: 'Grace Lin', initials: 'GL', email: 'grace.lin@novashop.com', role: 'Admin', lastActive: '3 days ago', status: 'Active', isYou: false },
    { id: 4, name: 'Priya Nair', initials: 'PN', email: 'priya.nair@novashop.com', role: 'Support Agent', lastActive: '1 hour ago', status: 'Active', isYou: false },
    { id: 5, name: 'Tomas Berg', initials: 'TB', email: 'tomas.berg@novashop.com', role: 'Content Editor', lastActive: 'Yesterday', status: 'Active', isYou: false },
    { id: 6, name: 'Omar Haddad', initials: 'OH', email: 'omar.haddad@novashop.com', role: 'Support Agent', lastActive: '—', status: 'Invited', isYou: false },
    { id: 7, name: 'Julia Weiss', initials: 'JW', email: 'julia.weiss@novashop.com', role: 'Content Editor', lastActive: '2 months ago', status: 'Deactivated', isYou: false },
  ];

  const renderAccess = (access) => {
    if (access === 'Full') {
      return <span className="settings-role-full"><AdminIcon name="check" size={14} /> Full</span>;
    }
    if (access === 'View') {
      return <span className="settings-role-view">View</span>;
    }
    return <span className="settings-role-none">—</span>;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'active';
      case 'Invited': return 'invited';
      case 'Deactivated': return 'deactivated';
      default: return '';
    }
  };

  return (
    <>
      <div className="settings-team-tabs">
        <button 
          className={`settings-team-tab ${activeSubTab === 'members' ? 'is-active' : ''}`}
          onClick={() => setActiveSubTab('members')}
        >
          Members <span className="settings-team-count">7</span>
        </button>
        <button 
          className={`settings-team-tab ${activeSubTab === 'roles' ? 'is-active' : ''}`}
          onClick={() => setActiveSubTab('roles')}
        >
          Roles <span className="settings-team-count">5</span>
        </button>
      </div>

      {activeSubTab === 'roles' ? (
        <section className="settings-card">
          <div className="settings-card-header">
            <h2 className="settings-card-title">Role permissions</h2>
            <p className="settings-card-desc">Summary permission tiers determining capability access across administrative domains.</p>
          </div>
          
          <div style={{overflowX: 'auto'}}>
            <table className="settings-role-table">
              <thead>
                <tr>
                  <th>DOMAIN AREA</th>
                  <th>OWNER</th>
                  <th>ADMIN</th>
                  <th>STORE MANAGER</th>
                  <th>SUPPORT AGENT</th>
                  <th>CONTENT EDITOR</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map((p, i) => (
                  <tr key={i}>
                    <td className="domain-area">{p.domain}</td>
                    <td>{renderAccess(p.owner)}</td>
                    <td>{renderAccess(p.admin)}</td>
                    <td>{renderAccess(p.storeManager)}</td>
                    <td>{renderAccess(p.supportAgent)}</td>
                    <td>{renderAccess(p.contentEditor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="settings-card settings-members-card" style={{ padding: '0' }}>
          <div className="settings-members-header">
            <div className="settings-search-container">
              <span className="settings-search-icon">
                <AdminIcon name="search" size={16} />
              </span>
              <input type="text" placeholder="Search by name or email..." className="settings-search-input" />
            </div>
          </div>
          <div style={{overflowX: 'auto'}}>
            <table className="settings-members-table">
              <thead>
                <tr>
                  <th>MEMBER</th>
                  <th>ROLE</th>
                  <th>LAST ACTIVE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {mockMembers.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div className="settings-member-info">
                        <div className="settings-member-avatar">{m.initials}</div>
                        <div className="settings-member-details">
                          <div className="settings-member-name">
                            {m.name} {m.isYou && <span className="settings-member-you">(You)</span>}
                          </div>
                          <div className="settings-member-email">{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="settings-member-role">{m.role}</td>
                    <td className={`settings-member-active ${m.lastActive === 'Active now' ? 'is-active-now' : ''}`}>
                      {m.lastActive}
                    </td>
                    <td>
                      <span className={`settings-member-status ${getStatusColor(m.status)}`}>
                        <span className="status-dot"></span> {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function NotificationSettings() {
  const [teamNotis, setTeamNotis] = useState({
    orders: { email: true, inApp: true },
    returns: { email: true, inApp: false },
    inventory: { email: true, inApp: true },
    customerAccounts: { email: false, inApp: true },
    paymentDisputes: { email: true, inApp: true },
  });

  const [customerNotis, setCustomerNotis] = useState({
    orderConf: true,
    shippingConf: true,
    returnAppr: true,
    refundIss: true,
  });

  const updateTeamNoti = (key, type, val) => {
    setTeamNotis(prev => ({ ...prev, [key]: { ...prev[key], [type]: val } }));
  };

  const updateCustNoti = (key, val) => {
    setCustomerNotis(prev => ({ ...prev, [key]: val }));
  };

  return (
    <>
      <section className="settings-card">
        <div className="settings-card-header">
          <h2 className="settings-card-title">Team notifications</h2>
          <p className="settings-card-desc">Determine internal staff alerts for vital commercial events and stock alarms.</p>
        </div>

        <div className="settings-form-row single">
          <div className="settings-form-group" style={{maxWidth: '360px'}}>
            <label className="settings-form-label">SEND NOTIFICATIONS TO</label>
            <input 
              type="email" 
              className="settings-form-input" 
              defaultValue="orders@novashop.com"
            />
            <div className="settings-input-helper">Recipient inbox for internal fulfillment warnings.</div>
          </div>
        </div>

        <div className="settings-noti-header-row">
          <div className="settings-noti-header-label">EVENT GROUP & TRIGGER</div>
          <div className="settings-noti-toggles-header">
            <span className="settings-noti-header-label">EMAIL</span>
            <span className="settings-noti-header-label">IN-APP</span>
          </div>
        </div>

        <div className="settings-noti-row">
          <div className="settings-noti-row-info">
            <div className="settings-noti-row-title">Orders</div>
            <div className="settings-noti-row-desc">Instant alert when a client completes a purchase cart.</div>
          </div>
          <div className="settings-noti-toggles">
            <label className="settings-toggle">
              <input type="checkbox" checked={teamNotis.orders.email} onChange={e => updateTeamNoti('orders', 'email', e.target.checked)} />
              <span className="settings-toggle-slider"></span>
            </label>
            <label className="settings-toggle">
              <input type="checkbox" checked={teamNotis.orders.inApp} onChange={e => updateTeamNoti('orders', 'inApp', e.target.checked)} />
              <span className="settings-toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="settings-noti-row">
          <div className="settings-noti-row-info">
            <div className="settings-noti-row-title">Returns</div>
            <div className="settings-noti-row-desc">Customer initiates a return label request.</div>
          </div>
          <div className="settings-noti-toggles">
            <label className="settings-toggle">
              <input type="checkbox" checked={teamNotis.returns.email} onChange={e => updateTeamNoti('returns', 'email', e.target.checked)} />
              <span className="settings-toggle-slider"></span>
            </label>
            <label className="settings-toggle">
              <input type="checkbox" checked={teamNotis.returns.inApp} onChange={e => updateTeamNoti('returns', 'inApp', e.target.checked)} />
              <span className="settings-toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="settings-noti-row">
          <div className="settings-noti-row-info">
            <div className="settings-noti-row-title">Inventory alerts</div>
            <div className="settings-noti-row-desc">Stock falls beneath safety buffer threshold (under 5 units).</div>
          </div>
          <div className="settings-noti-toggles">
            <label className="settings-toggle">
              <input type="checkbox" checked={teamNotis.inventory.email} onChange={e => updateTeamNoti('inventory', 'email', e.target.checked)} />
              <span className="settings-toggle-slider"></span>
            </label>
            <label className="settings-toggle">
              <input type="checkbox" checked={teamNotis.inventory.inApp} onChange={e => updateTeamNoti('inventory', 'inApp', e.target.checked)} />
              <span className="settings-toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="settings-noti-row">
          <div className="settings-noti-row-info">
            <div className="settings-noti-row-title">Customer accounts</div>
            <div className="settings-noti-row-desc">New VIP client signups or tier threshold upgrades.</div>
          </div>
          <div className="settings-noti-toggles">
            <label className="settings-toggle">
              <input type="checkbox" checked={teamNotis.customerAccounts.email} onChange={e => updateTeamNoti('customerAccounts', 'email', e.target.checked)} />
              <span className="settings-toggle-slider"></span>
            </label>
            <label className="settings-toggle">
              <input type="checkbox" checked={teamNotis.customerAccounts.inApp} onChange={e => updateTeamNoti('customerAccounts', 'inApp', e.target.checked)} />
              <span className="settings-toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="settings-noti-row">
          <div className="settings-noti-row-info">
            <div className="settings-noti-row-title">Payment disputes</div>
            <div className="settings-noti-row-desc">Immediate notice for chargebacks or processor holds.</div>
          </div>
          <div className="settings-noti-toggles">
            <label className="settings-toggle">
              <input type="checkbox" checked={teamNotis.paymentDisputes.email} onChange={e => updateTeamNoti('paymentDisputes', 'email', e.target.checked)} />
              <span className="settings-toggle-slider"></span>
            </label>
            <label className="settings-toggle">
              <input type="checkbox" checked={teamNotis.paymentDisputes.inApp} onChange={e => updateTeamNoti('paymentDisputes', 'inApp', e.target.checked)} />
              <span className="settings-toggle-slider"></span>
            </label>
          </div>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-header">
          <h2 className="settings-card-title">Customer emails</h2>
          <p className="settings-card-desc">Automated transaction templates sent directly to clients during the order lifecycle.</p>
        </div>

        <div className="settings-form-row">
          <div className="settings-form-group">
            <label className="settings-form-label">SENDER NAME</label>
            <input type="text" className="settings-form-input" defaultValue="NovaShop" />
          </div>
          <div className="settings-form-group">
            <label className="settings-form-label">REPLY-TO EMAIL</label>
            <input type="email" className="settings-form-input" defaultValue="support@novashop.com" />
          </div>
        </div>

        <div className="settings-noti-row" style={{marginTop: '16px'}}>
          <div className="settings-noti-row-info">
            <div className="settings-noti-row-title">Order confirmation</div>
            <div className="settings-noti-row-desc">Sent immediately following a verified credit authorization.</div>
          </div>
          <div className="settings-noti-toggles">
            <label className="settings-toggle">
              <input type="checkbox" checked={customerNotis.orderConf} onChange={e => updateCustNoti('orderConf', e.target.checked)} />
              <span className="settings-toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="settings-noti-row">
          <div className="settings-noti-row-info">
            <div className="settings-noti-row-title">Shipping confirmation</div>
            <div className="settings-noti-row-desc">Sent once package tracking bar-code scans at the courier hub.</div>
          </div>
          <div className="settings-noti-toggles">
            <label className="settings-toggle">
              <input type="checkbox" checked={customerNotis.shippingConf} onChange={e => updateCustNoti('shippingConf', e.target.checked)} />
              <span className="settings-toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="settings-noti-row">
          <div className="settings-noti-row-info">
            <div className="settings-noti-row-title">Return approved</div>
            <div className="settings-noti-row-desc">Provides pre-paid shipping waybill and QR return instructions.</div>
          </div>
          <div className="settings-noti-toggles">
            <label className="settings-toggle">
              <input type="checkbox" checked={customerNotis.returnAppr} onChange={e => updateCustNoti('returnAppr', e.target.checked)} />
              <span className="settings-toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="settings-noti-row">
          <div className="settings-noti-row-info">
            <div className="settings-noti-row-title">Refund issued</div>
            <div className="settings-noti-row-desc">Confirms processor credit back to original funding source.</div>
          </div>
          <div className="settings-noti-toggles">
            <label className="settings-toggle">
              <input type="checkbox" checked={customerNotis.refundIss} onChange={e => updateCustNoti('refundIss', e.target.checked)} />
              <span className="settings-toggle-slider"></span>
            </label>
          </div>
        </div>
      </section>
    </>
  );
}
