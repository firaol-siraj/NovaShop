import { useState, useEffect, useMemo, useRef } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { settingsApi } from '../../lib/api/settingsApi';
import { ISO_COUNTRIES } from '../../constants/isoCountries';
import '../../components/admin/admin-dashboard.css';
import './admin-settings.css';

export default function AdminSettingsPage({ currentPath = '/admin/settings/store' }) {
  const { adminUser } = useAdminAuth();

  // Determine active tab from URL or default to Store details
  const pathParts = (currentPath || '').split('/');
  const defaultTab = pathParts[3] || 'store';

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [version, setVersion] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' }

  // Initial clean snapshots to compute dirty state & discard
  const [initialSettings, setInitialSettings] = useState({
    store: null,
    taxes: null,
    taxRegions: [],
    notifications: null,
  });

  // Store details state
  const [storeSettings, setStoreSettings] = useState({
    storeName: 'NovaShop',
    legalName: 'NovaShop',
    email: 'firaolsiraj17@gmail.com',
    phone: '+2519536877',
    address: 'Bole',
    city: 'Addis Ababa',
    state: 'Addis Ababa',
    postalCode: '1102',
    country: 'Ethiopia',
    orderPrefix: 'NS-',
    timezone: 'Africa/Addis_Ababa',
    storefrontAccess: 'Open',
    password: '',
  });

  // Tax settings state
  const [taxSettings, setTaxSettings] = useState({
    collectTax: true,
    includeTax: false,
    chargeShipping: true,
    defaultRate: 15,
    defaultTaxName: 'VAT',
  });
  const [taxRegions, setTaxRegions] = useState([]);

  // Notification settings state
  const [teamNotificationEmail, setTeamNotificationEmail] = useState('sirajfira517@gmail.com');
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
  const [customerEmails, setCustomerEmails] = useState({
    senderName: 'NovaShop',
    replyToEmail: 'firaolsiraj17@gmail.com',
  });

  // Unsaved changes confirmation dialog state
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [pendingTabSwitch, setPendingTabSwitch] = useState(null);

  // Invite Member Modal state (Header action on Team tab)
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'Store Manager' });
  const [isInviting, setIsInviting] = useState(false);

  // Team refresh trigger
  const [teamRefreshKey, setTeamRefreshKey] = useState(0);

  // Load Settings from API on Mount
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    settingsApi.getAdminSettings()
      .then((res) => {
        if (!isMounted) return;
        const data = res.data?.data || res.data;
        if (data) {
          if (data.version) setVersion(data.version);

          const loadedStore = {
            storeName: data.store?.name || 'NovaShop',
            legalName: data.store?.legalName || 'NovaShop',
            email: data.store?.email || 'firaolsiraj17@gmail.com',
            phone: data.store?.phone || '+2519536877',
            address: data.address?.street || 'Bole',
            city: data.address?.city || 'Addis Ababa',
            state: data.address?.region || 'Addis Ababa',
            postalCode: data.address?.postalCode || '1102',
            country: data.address?.country || 'Ethiopia',
            orderPrefix: data.store?.orderPrefix || 'NS-',
            timezone: data.locale?.timezone || 'Africa/Addis_Ababa',
            storefrontAccess: data.store?.storefrontAccess || 'Open',
            password: data.store?.storefrontPassword || '',
          };
          setStoreSettings(loadedStore);

          const loadedTax = {
            collectTax: data.tax?.collectTax ?? true,
            includeTax: data.tax?.includeTax ?? false,
            chargeShipping: data.tax?.chargeShipping ?? true,
            defaultRate: data.tax?.defaultRate ?? 15,
            defaultTaxName: data.tax?.defaultTaxName || 'VAT',
          };
          setTaxSettings(loadedTax);

          const loadedRegions = Array.isArray(data.tax?.regions) && data.tax.regions.length > 0
            ? data.tax.regions
            : [
                { id: 'eth-vat-1', region: 'Ethiopia', sub: 'National jurisdiction', taxName: 'VAT', min: '15.00%', max: '15.00%', rate: 15, status: 'Active' },
              ];
          setTaxRegions(loadedRegions);

          const loadedTeamEmail = data.notifications?.teamNotificationEmail || 'sirajfira517@gmail.com';
          setTeamNotificationEmail(loadedTeamEmail);

          const loadedTeamNotis = {
            orders: { email: data.notifications?.eventPreferences?.orders?.email ?? true, inApp: data.notifications?.eventPreferences?.orders?.inApp ?? true },
            returns: { email: data.notifications?.eventPreferences?.returns?.email ?? true, inApp: data.notifications?.eventPreferences?.returns?.inApp ?? false },
            inventory: { email: data.notifications?.eventPreferences?.inventory?.email ?? true, inApp: data.notifications?.eventPreferences?.inventory?.inApp ?? true },
            customerAccounts: { email: data.notifications?.eventPreferences?.customerAccounts?.email ?? false, inApp: data.notifications?.eventPreferences?.customerAccounts?.inApp ?? true },
            paymentDisputes: { email: data.notifications?.eventPreferences?.paymentDisputes?.email ?? true, inApp: data.notifications?.eventPreferences?.paymentDisputes?.inApp ?? true },
          };
          setTeamNotis(loadedTeamNotis);

          const loadedCustEmails = {
            senderName: data.notifications?.customerEmails?.senderName || 'NovaShop',
            replyToEmail: data.notifications?.customerEmails?.replyToEmail || 'firaolsiraj17@gmail.com',
          };
          setCustomerEmails(loadedCustEmails);

          const loadedCustNotis = {
            orderConf: data.notifications?.customerEmails?.orderConfirmation ?? true,
            shippingConf: data.notifications?.customerEmails?.shippingConfirmation ?? true,
            returnAppr: data.notifications?.customerEmails?.returnApproved ?? true,
            refundIss: data.notifications?.customerEmails?.refundIssued ?? true,
          };
          setCustomerNotis(loadedCustNotis);

          // Save pristine baseline for dirty check
          setInitialSettings({
            store: loadedStore,
            taxes: loadedTax,
            taxRegions: loadedRegions,
            notifications: {
              teamNotificationEmail: loadedTeamEmail,
              teamNotis: loadedTeamNotis,
              customerEmails: loadedCustEmails,
              customerNotis: loadedCustNotis,
            },
          });
        }
      })
      .catch((err) => {
        console.error('Failed to load admin settings:', err);
        showToast(err.message || 'Failed to load store settings', 'error');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  // Compute dirty status for active tab
  const isDirty = useMemo(() => {
    if (activeTab === 'store') {
      if (!initialSettings.store) return false;
      return JSON.stringify(storeSettings) !== JSON.stringify(initialSettings.store);
    }
    if (activeTab === 'taxes') {
      if (!initialSettings.taxes) return false;
      const taxSettingsChanged = JSON.stringify(taxSettings) !== JSON.stringify(initialSettings.taxes);
      const regionsChanged = JSON.stringify(taxRegions) !== JSON.stringify(initialSettings.taxRegions);
      return taxSettingsChanged || regionsChanged;
    }
    if (activeTab === 'notifications') {
      if (!initialSettings.notifications) return false;
      const emailChanged = teamNotificationEmail !== initialSettings.notifications.teamNotificationEmail;
      const teamNotisChanged = JSON.stringify(teamNotis) !== JSON.stringify(initialSettings.notifications.teamNotis);
      const custEmailsChanged = JSON.stringify(customerEmails) !== JSON.stringify(initialSettings.notifications.customerEmails);
      const custNotisChanged = JSON.stringify(customerNotis) !== JSON.stringify(initialSettings.notifications.customerNotis);
      return emailChanged || teamNotisChanged || custEmailsChanged || custNotisChanged;
    }
    return false;
  }, [activeTab, initialSettings, storeSettings, taxSettings, taxRegions, teamNotificationEmail, teamNotis, customerEmails, customerNotis]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Tab switching with unsaved changes prompt
  const handleTabClick = (tab) => {
    if (tab === activeTab) return;
    if (isDirty) {
      setPendingTabSwitch(tab);
      setDiscardConfirmOpen(true);
    } else {
      setActiveTab(tab);
    }
  };

  // Discard changes
  const handleDiscard = () => {
    if (isDirty) {
      setDiscardConfirmOpen(true);
    }
  };

  const confirmDiscardAction = () => {
    if (activeTab === 'store' && initialSettings.store) {
      setStoreSettings({ ...initialSettings.store });
    } else if (activeTab === 'taxes' && initialSettings.taxes) {
      setTaxSettings({ ...initialSettings.taxes });
      setTaxRegions([...initialSettings.taxRegions]);
    } else if (activeTab === 'notifications' && initialSettings.notifications) {
      setTeamNotificationEmail(initialSettings.notifications.teamNotificationEmail);
      setTeamNotis({ ...initialSettings.notifications.teamNotis });
      setCustomerEmails({ ...initialSettings.notifications.customerEmails });
      setCustomerNotis({ ...initialSettings.notifications.customerNotis });
    }

    setDiscardConfirmOpen(false);
    if (pendingTabSwitch) {
      setActiveTab(pendingTabSwitch);
      setPendingTabSwitch(null);
    }
    showToast('Changes discarded', 'success');
  };

  // Save changes for current tab
  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      if (activeTab === 'store') {
        const payload = {
          storeName: storeSettings.storeName,
          legalName: storeSettings.legalName,
          email: storeSettings.email,
          phone: storeSettings.phone,
          address: storeSettings.address,
          city: storeSettings.city,
          state: storeSettings.state,
          postalCode: storeSettings.postalCode,
          country: storeSettings.country,
          orderPrefix: storeSettings.orderPrefix,
          timezone: storeSettings.timezone,
          storefrontAccess: storeSettings.storefrontAccess,
          password: storeSettings.password,
        };
        const res = await settingsApi.updateAdminSettings('store', payload, version);
        const newVersion = res.data?.data?.version || res.data?.version || (version + 1);
        setVersion(newVersion);
        setInitialSettings((prev) => ({ ...prev, store: { ...storeSettings } }));
        showToast('Store details saved successfully');
      } else if (activeTab === 'taxes') {
        const payload = {
          collectTax: taxSettings.collectTax,
          includeTax: taxSettings.includeTax,
          chargeShipping: taxSettings.chargeShipping,
          defaultRate: taxSettings.defaultRate,
          defaultTaxName: taxSettings.defaultTaxName,
          regions: taxRegions,
        };
        const res = await settingsApi.updateAdminSettings('tax', payload, version);
        const newVersion = res.data?.data?.version || res.data?.version || (version + 1);
        setVersion(newVersion);
        setInitialSettings((prev) => ({ ...prev, taxes: { ...taxSettings }, taxRegions: [...taxRegions] }));
        showToast('Tax settings saved successfully');
      } else if (activeTab === 'notifications') {
        const payload = {
          teamNotificationEmail,
          eventPreferences: {
            orders: teamNotis.orders,
            returns: teamNotis.returns,
            inventory: teamNotis.inventory,
            customerAccounts: teamNotis.customerAccounts,
            paymentDisputes: teamNotis.paymentDisputes,
          },
          customerEmails: {
            senderName: customerEmails.senderName,
            replyToEmail: customerEmails.replyToEmail,
            orderConfirmation: customerNotis.orderConf,
            shippingConfirmation: customerNotis.shippingConf,
            returnApproved: customerNotis.returnAppr,
            refundIssued: customerNotis.refundIss,
          },
        };
        const res = await settingsApi.updateAdminSettings('notifications', payload, version);
        const newVersion = res.data?.data?.version || res.data?.version || (version + 1);
        setVersion(newVersion);
        setInitialSettings((prev) => ({
          ...prev,
          notifications: {
            teamNotificationEmail,
            teamNotis: { ...teamNotis },
            customerEmails: { ...customerEmails },
            customerNotis: { ...customerNotis },
          },
        }));
        showToast('Notification settings saved successfully');
      }
    } catch (err) {
      console.error('Save failed:', err);
      if (err.status === 409 || err.response?.status === 409) {
        showToast('Settings were modified by another administrator. Please reload before saving.', 'error');
      } else {
        const errMsg = err.response?.data?.message || err.message || 'Failed to save settings';
        showToast(errMsg, 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Submit invite member
  const handleSendInvite = async (e) => {
    if (e) e.preventDefault();
    if (!inviteForm.email.trim()) {
      showToast('Please enter an email address for invitation', 'error');
      return;
    }
    setIsInviting(true);
    try {
      await settingsApi.inviteMember({
        name: inviteForm.name.trim() || inviteForm.email.split('@')[0],
        email: inviteForm.email.trim(),
        role: inviteForm.role,
      });
      showToast(`Invitation sent to ${inviteForm.email}`);
      setInviteModalOpen(false);
      setInviteForm({ name: '', email: '', role: 'Store Manager' });
      setTeamRefreshKey((k) => k + 1);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to send invite';
      showToast(msg, 'error');
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="admin-dashboard settings-page">
      <div className="settings-page-header">
        <div className="settings-page-title-group">
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted, #8A847C)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            CONFIGURATION & OPERATIONS
          </div>
          <h1 className="admin-page-title">Settings</h1>
          <p className="admin-page-description">Manage your store details, taxes, team, and notifications.</p>
        </div>
        <div className="settings-page-actions">
          {activeTab === 'team' ? (
            <button className="settings-save-btn" onClick={() => setInviteModalOpen(true)}>
              + INVITE MEMBER
            </button>
          ) : (
            <>
              <button
                className="settings-discard-btn"
                onClick={handleDiscard}
                disabled={!isDirty || isSaving}
                style={{ opacity: !isDirty || isSaving ? 0.4 : 1, cursor: !isDirty || isSaving ? 'not-allowed' : 'pointer' }}
              >
                DISCARD
              </button>
              <button
                className="settings-save-btn"
                onClick={handleSave}
                disabled={!isDirty || isSaving}
                style={{ opacity: !isDirty || isSaving ? 0.4 : 1, cursor: !isDirty || isSaving ? 'not-allowed' : 'pointer' }}
              >
                {isSaving ? 'SAVING...' : 'SAVE CHANGES'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="settings-layout">
        <aside className="settings-sidebar">
          <nav className="settings-nav-card">
            <button
              className={`settings-nav-item ${activeTab === 'store' ? 'is-active' : ''}`}
              onClick={() => handleTabClick('store')}
            >
              <AdminIcon name="store" size={16} /> Store details
            </button>
            <button
              className={`settings-nav-item ${activeTab === 'taxes' ? 'is-active' : ''}`}
              onClick={() => handleTabClick('taxes')}
            >
              <AdminIcon name="percent" size={16} /> Taxes
            </button>
            <button
              className={`settings-nav-item ${activeTab === 'team' ? 'is-active' : ''}`}
              onClick={() => handleTabClick('team')}
            >
              <AdminIcon name="customers" size={16} /> Team and permissions
            </button>
            <button
              className={`settings-nav-item ${activeTab === 'notifications' ? 'is-active' : ''}`}
              onClick={() => handleTabClick('notifications')}
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
          {activeTab === 'taxes' && (
            <TaxSettings
              settings={taxSettings}
              onChange={setTaxSettings}
              regions={taxRegions}
              setRegions={setTaxRegions}
              onToast={showToast}
            />
          )}
          {activeTab === 'team' && (
            <TeamSettings
              adminUser={adminUser}
              refreshKey={teamRefreshKey}
              onToast={showToast}
            />
          )}
          {activeTab === 'notifications' && (
            <NotificationSettings
              teamNotificationEmail={teamNotificationEmail}
              setTeamNotificationEmail={setTeamNotificationEmail}
              teamNotis={teamNotis}
              setTeamNotis={setTeamNotis}
              customerEmails={customerEmails}
              setCustomerEmails={setCustomerEmails}
              customerNotis={customerNotis}
              setCustomerNotis={setCustomerNotis}
            />
          )}
        </main>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="settings-toast" style={{ background: toast.type === 'error' ? '#842029' : '#211E1B' }}>
          <AdminIcon name={toast.type === 'error' ? 'close' : 'check'} size={16} style={{ color: toast.type === 'error' ? '#F8D7DA' : 'var(--admin-positive)' }} />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Discard Confirmation Modal */}
      {discardConfirmOpen && (
        <div className="settings-modal-overlay" onClick={() => setDiscardConfirmOpen(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3 className="settings-modal-title">Discard unsaved changes?</h3>
              <button className="settings-modal-close" onClick={() => setDiscardConfirmOpen(false)}>
                <AdminIcon name="close" size={18} />
              </button>
            </div>
            <div className="settings-modal-body">
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary, #6B6660)', lineHeight: 1.5 }}>
                You have unsaved changes in this section. If you continue, your unsaved changes will be lost and reverted to their last saved state.
              </p>
            </div>
            <div className="settings-modal-footer">
              <button className="settings-discard-btn" onClick={() => setDiscardConfirmOpen(false)}>
                Keep editing
              </button>
              <button className="settings-save-btn" onClick={confirmDiscardAction} style={{ background: '#B83227' }}>
                Discard changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {inviteModalOpen && (
        <div className="settings-modal-overlay" onClick={() => setInviteModalOpen(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3 className="settings-modal-title">Invite team member</h3>
              <button className="settings-modal-close" onClick={() => setInviteModalOpen(false)}>
                <AdminIcon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={handleSendInvite}>
              <div className="settings-modal-body">
                <div className="settings-form-group" style={{ marginBottom: '16px' }}>
                  <label className="settings-form-label">FULL NAME</label>
                  <input
                    type="text"
                    className="settings-form-input"
                    placeholder="e.g. Dawit Bekele"
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  />
                </div>
                <div className="settings-form-group" style={{ marginBottom: '16px' }}>
                  <label className="settings-form-label">EMAIL ADDRESS</label>
                  <input
                    type="email"
                    className="settings-form-input"
                    placeholder="colleague@novashop.com"
                    required
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  />
                  <div className="settings-input-helper">An invitation link with a 48-hour secure token will be sent to this email.</div>
                </div>
                <div className="settings-form-group">
                  <label className="settings-form-label">ASSIGNED ROLE</label>
                  <select
                    className="settings-form-input settings-form-select"
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                  >
                    <option value="Store Manager">Store Manager</option>
                    <option value="Admin">Admin</option>
                    <option value="Support Agent">Support Agent</option>
                    <option value="Content Editor">Content Editor</option>
                    {adminUser?.adminRole === 'owner' && <option value="Owner">Owner</option>}
                  </select>
                </div>
              </div>
              <div className="settings-modal-footer">
                <button type="button" className="settings-discard-btn" onClick={() => setInviteModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="settings-save-btn" disabled={isInviting}>
                  {isInviting ? 'Sending...' : 'Send invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StoreDetails({ settings, onChange }) {
  const updateField = (field, value) => {
    onChange((prev) => ({ ...prev, [field]: value }));
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
              onChange={(e) => updateField('storeName', e.target.value)}
            />
          </div>
          <div className="settings-form-group">
            <label className="settings-form-label">LEGAL BUSINESS NAME</label>
            <input
              type="text"
              className="settings-form-input"
              value={settings.legalName}
              onChange={(e) => updateField('legalName', e.target.value)}
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
              onChange={(e) => updateField('email', e.target.value)}
            />
            <div className="settings-input-helper">Customers see this on emails and digital receipts.</div>
          </div>
          <div className="settings-form-group">
            <label className="settings-form-label">PHONE</label>
            <input
              type="tel"
              className="settings-form-input"
              value={settings.phone}
              onChange={(e) => updateField('phone', e.target.value)}
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
              onChange={(e) => updateField('address', e.target.value)}
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
              onChange={(e) => updateField('city', e.target.value)}
            />
          </div>
          <div className="settings-form-group">
            <label className="settings-form-label">STATE OR REGION</label>
            <input
              type="text"
              className="settings-form-input"
              value={settings.state}
              onChange={(e) => updateField('state', e.target.value)}
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
              onChange={(e) => updateField('postalCode', e.target.value)}
            />
            <div className="settings-input-helper" style={{ marginTop: '4px' }}>Primary administrative address printed on all official transaction notes.</div>
          </div>
          <div className="settings-form-group">
            <label className="settings-form-label">COUNTRY</label>
            <select
              className="settings-form-input settings-form-select"
              value={settings.country}
              onChange={(e) => updateField('country', e.target.value)}
            >
              {ISO_COUNTRIES.map((c) => (
                <option key={c.code} value={c.name}>{c.name}</option>
              ))}
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
              onChange={(e) => updateField('timezone', e.target.value)}
            >
              <option value="Africa/Addis_Ababa">(GMT+03:00) East Africa Time (Addis Ababa)</option>
              <option value="America/New_York">(GMT-05:00) Eastern Time (New York)</option>
              <option value="America/Los_Angeles">(GMT-08:00) Pacific Time (Los Angeles)</option>
              <option value="Europe/London">(GMT+00:00) Greenwich Mean Time (London)</option>
              <option value="UTC">(GMT+00:00) Coordinated Universal Time (UTC)</option>
            </select>
          </div>
        </div>
        <div className="settings-form-row single" style={{ marginTop: '12px' }}>
          <div className="settings-form-group" style={{ maxWidth: '240px' }}>
            <label className="settings-form-label">ORDER NUMBER PREFIX</label>
            <input
              type="text"
              className="settings-form-input"
              value={settings.orderPrefix}
              onChange={(e) => updateField('orderPrefix', e.target.value)}
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
            <button type="button" className="settings-branding-btn">REPLACE</button>
          </div>
          <div className="settings-branding-panel">
            <div className="settings-branding-preview favicon">N</div>
            <div className="settings-branding-info">
              <div className="settings-branding-name">Favicon</div>
              <div className="settings-branding-meta">32x32px • ICO</div>
            </div>
            <button type="button" className="settings-branding-btn">REPLACE</button>
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
            type="button"
            className={`settings-segment ${settings.storefrontAccess === 'Open' ? 'is-active' : ''}`}
            onClick={() => updateField('storefrontAccess', 'Open')}
          >
            Open
          </button>
          <button
            type="button"
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
            <div className="settings-form-group" style={{ maxWidth: '300px' }}>
              <label className="settings-form-label">PASSWORD</label>
              <input
                type="password"
                className="settings-form-input"
                placeholder="Enter password..."
                value={settings.password}
                onChange={(e) => updateField('password', e.target.value)}
              />
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function TaxSettings({ settings, onChange, regions, setRegions, onToast }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedRegionForEdit, setSelectedRegionForEdit] = useState(null);
  const [editRateInput, setEditRateInput] = useState('');
  const [menuOpen, setMenuOpen] = useState(null); // id of row

  // New Region Modal Form State
  const [newRegionCountry, setNewRegionCountry] = useState('Ethiopia');
  const [newRegionTaxName, setNewRegionTaxName] = useState('VAT');
  const [newRegionRate, setNewRegionRate] = useState('15.00');
  const [newRegionStatus, setNewRegionStatus] = useState('Active');

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
    onChange((prev) => ({ ...prev, [field]: value }));
  };

  const toggleRegionStatus = (id, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    setRegions((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
    setMenuOpen(null);
    onToast(`Region status changed to ${newStatus}`);
  };

  const deleteRegion = (id) => {
    setRegions((prev) => prev.filter((r) => r.id !== id));
    setMenuOpen(null);
    onToast('Tax region removed');
  };

  const openEditModal = (region) => {
    setSelectedRegionForEdit(region);
    setEditRateInput(String(region.rate ?? 15));
    setEditModalOpen(true);
    setMenuOpen(null);
  };

  const saveEditedRate = () => {
    const rateVal = parseFloat(editRateInput);
    if (isNaN(rateVal) || rateVal < 0 || rateVal > 100) {
      onToast('Please enter a valid rate between 0 and 100%', 'error');
      return;
    }
    const rateStr = `${rateVal.toFixed(2)}%`;
    setRegions((prev) =>
      prev.map((r) =>
        r.id === selectedRegionForEdit.id
          ? { ...r, rate: rateVal, min: rateStr, max: rateStr }
          : r
      )
    );
    setEditModalOpen(false);
    onToast(`Tax rate updated to ${rateStr}`);
  };

  const handleAddRegion = (e) => {
    if (e) e.preventDefault();
    const rateVal = parseFloat(newRegionRate);
    if (isNaN(rateVal) || rateVal < 0 || rateVal > 100) {
      onToast('Rate must be between 0 and 100%', 'error');
      return;
    }

    const rateStr = `${rateVal.toFixed(2)}%`;
    const newRegionObj = {
      id: `reg-${Date.now()}`,
      region: newRegionCountry,
      sub: `${newRegionCountry} jurisdiction`,
      taxName: newRegionTaxName.trim() || 'VAT',
      min: rateStr,
      max: rateStr,
      rate: rateVal,
      status: newRegionStatus,
      countryCodes: [],
      subdivisionCodes: [],
    };

    setRegions((prev) => [...prev, newRegionObj]);
    setModalOpen(false);
    onToast(`Added ${newRegionCountry} to tax jurisdictions`);
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
            <input type="checkbox" checked={settings.collectTax} onChange={(e) => updateToggle('collectTax', e.target.checked)} />
            <span className="settings-toggle-slider"></span>
          </label>
        </div>

        <div className="settings-tax-row">
          <div className="settings-tax-row-info">
            <div className="settings-tax-row-title">Prices include tax</div>
            <div className="settings-tax-row-desc">Gross catalog pricing displays tax-inclusive values (standard in UK and EU jurisdictions).</div>
          </div>
          <label className="settings-toggle">
            <input type="checkbox" checked={settings.includeTax} onChange={(e) => updateToggle('includeTax', e.target.checked)} />
            <span className="settings-toggle-slider"></span>
          </label>
        </div>

        <div className="settings-tax-row">
          <div className="settings-tax-row-info">
            <div className="settings-tax-row-title">Charge tax on shipping</div>
            <div className="settings-tax-row-desc">Apply standard local jurisdiction tax brackets to shipping and fulfillment charges.</div>
          </div>
          <label className="settings-toggle">
            <input type="checkbox" checked={settings.chargeShipping} onChange={(e) => updateToggle('chargeShipping', e.target.checked)} />
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
          <button type="button" className="settings-add-region-btn" onClick={() => setModalOpen(true)}>
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
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((r) => (
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
                    <span className={`settings-status-pill ${(r.status || 'Active').toLowerCase()}`}>
                      <i className="settings-status-dot"></i> {r.status}
                    </span>
                  </td>
                  <td className="settings-table-actions">
                    <button type="button" className="settings-action-btn" onClick={() => setMenuOpen(menuOpen === r.id ? null : r.id)}>
                      <AdminIcon name="more" size={16} />
                    </button>
                    {menuOpen === r.id && (
                      <div className="settings-dropdown">
                        <button type="button" onClick={() => openEditModal(r)}>
                          <AdminIcon name="pencil" size={14} /> Edit tax rate
                        </button>
                        <button type="button" onClick={() => onToast(`${r.region}: ${r.taxName} rate ${r.min || r.rate + '%'}`)}>
                          <AdminIcon name="eye" size={14} /> View details
                        </button>
                        <button type="button" onClick={() => toggleRegionStatus(r.id, r.status)}>
                          <AdminIcon name={r.status === 'Active' ? 'stop' : 'check'} size={14} />
                          {r.status === 'Active' ? 'Disable region' : 'Enable region'}
                        </button>
                        <button type="button" onClick={() => deleteRegion(r.id)} style={{ color: '#D34D4D' }}>
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
        <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted, #8A847C)', lineHeight: 1.4 }}>
          * Rates configure standard indirect consumption tax. All calculations apply during cart valuation.
        </div>
      </section>

      {/* Add Tax Region Modal */}
      {modalOpen && (
        <div className="settings-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3 className="settings-modal-title">Add tax region</h3>
              <button type="button" className="settings-modal-close" onClick={() => setModalOpen(false)}>
                <AdminIcon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={handleAddRegion}>
              <div className="settings-modal-body">
                <div className="settings-form-group" style={{ marginBottom: '16px' }}>
                  <label className="settings-form-label">COUNTRY / REGION</label>
                  <select
                    className="settings-form-input settings-form-select"
                    value={newRegionCountry}
                    onChange={(e) => setNewRegionCountry(e.target.value)}
                  >
                    {ISO_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="settings-form-group" style={{ marginBottom: '16px' }}>
                  <label className="settings-form-label">TAX NAME</label>
                  <input
                    type="text"
                    className="settings-form-input"
                    placeholder="e.g. VAT, GST, Sales Tax"
                    value={newRegionTaxName}
                    onChange={(e) => setNewRegionTaxName(e.target.value)}
                    required
                  />
                </div>
                <div className="settings-form-row">
                  <div className="settings-form-group">
                    <label className="settings-form-label">RATE %</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      className="settings-form-input"
                      placeholder="15.00"
                      value={newRegionRate}
                      onChange={(e) => setNewRegionRate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="settings-form-group">
                    <label className="settings-form-label">STATUS</label>
                    <select
                      className="settings-form-input settings-form-select"
                      value={newRegionStatus}
                      onChange={(e) => setNewRegionStatus(e.target.value)}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="settings-modal-footer">
                <button type="button" className="settings-discard-btn" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="settings-save-btn">
                  Save region
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Tax Rate Modal */}
      {editModalOpen && selectedRegionForEdit && (
        <div className="settings-modal-overlay" onClick={() => setEditModalOpen(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3 className="settings-modal-title">Edit tax rate – {selectedRegionForEdit.region}</h3>
              <button type="button" className="settings-modal-close" onClick={() => setEditModalOpen(false)}>
                <AdminIcon name="close" size={18} />
              </button>
            </div>
            <div className="settings-modal-body">
              <div className="settings-form-group">
                <label className="settings-form-label">TAX RATE PERCENTAGE (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className="settings-form-input"
                  value={editRateInput}
                  onChange={(e) => setEditRateInput(e.target.value)}
                  autoFocus
                />
                <div className="settings-input-helper">Current tax name: {selectedRegionForEdit.taxName}</div>
              </div>
            </div>
            <div className="settings-modal-footer">
              <button type="button" className="settings-discard-btn" onClick={() => setEditModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="settings-save-btn" onClick={saveEditedRate}>
                Update rate
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TeamSettings({ adminUser, refreshKey, onToast }) {
  const [activeSubTab, setActiveSubTab] = useState('members');
  const [members, setMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [roleChangeModalOpen, setRoleChangeModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [targetRole, setTargetRole] = useState('');

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

  // Fetch team members from API
  const fetchMembers = async () => {
    try {
      const res = await settingsApi.getTeamMembers();
      const raw = res?.data ?? res;
      let list = [];
      if (Array.isArray(raw)) {
        list = raw;
      } else if (Array.isArray(raw?.members)) {
        list = raw.members;
      } else if (Array.isArray(raw?.data)) {
        list = raw.data;
      } else if (Array.isArray(raw?.data?.members)) {
        list = raw.data.members;
      }
      setMembers(list);
    } catch (err) {
      console.error('Failed to fetch team members:', err);
      setMembers([]);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [refreshKey]);

  // Outside click handler for row dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuOpenId && !e.target.closest('.settings-table-actions')) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpenId]);

  const renderAccess = (access) => {
    if (access === 'Full') {
      return <span className="settings-role-full"><AdminIcon name="check" size={14} /> Full</span>;
    }
    if (access === 'View') {
      return <span className="settings-role-view">View</span>;
    }
    return <span className="settings-role-none">—</span>;
  };

  const getStatusColor = (status = '') => {
    switch (String(status || '').toLowerCase()) {
      case 'active': return 'active';
      case 'invited': return 'invited';
      case 'deactivated': return 'deactivated';
      default: return 'active';
    }
  };

  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return 'NS';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2 && parts[0]?.[0] && parts[1]?.[0]) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (name.trim().slice(0, 2) || 'NS').toUpperCase();
  };

  // Actions
  const handleResendInvite = async (inviteId) => {
    try {
      await settingsApi.resendInvite(inviteId);
      onToast('Invitation resent successfully');
      setMenuOpenId(null);
    } catch (err) {
      onToast(err.response?.data?.message || err.message || 'Failed to resend invite', 'error');
    }
  };

  const handleRevokeInvite = async (inviteId) => {
    try {
      await settingsApi.revokeInvite(inviteId);
      onToast('Invitation revoked');
      setMenuOpenId(null);
      fetchMembers();
    } catch (err) {
      onToast(err.response?.data?.message || err.message || 'Failed to revoke invite', 'error');
    }
  };

  const handleToggleMemberStatus = async (memberId, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Deactivated' : 'Active';
    try {
      await settingsApi.updateMemberStatus(memberId, newStatus);
      onToast(`Member status changed to ${newStatus}`);
      setMenuOpenId(null);
      fetchMembers();
    } catch (err) {
      onToast(err.response?.data?.message || err.message || 'Failed to update member status', 'error');
    }
  };

  const handleRemoveMember = async (memberId) => {
    try {
      await settingsApi.deleteMember(memberId);
      onToast('Member removed from team');
      setMenuOpenId(null);
      fetchMembers();
    } catch (err) {
      onToast(err.response?.data?.message || err.message || 'Failed to remove member', 'error');
    }
  };

  const openRoleModal = (m) => {
    setSelectedMember(m);
    setTargetRole(m.role);
    setRoleChangeModalOpen(true);
    setMenuOpenId(null);
  };

  const handleSaveRole = async () => {
    if (!selectedMember || !targetRole) return;
    try {
      await settingsApi.updateMemberRole(selectedMember.id, targetRole);
      onToast(`Role updated to ${targetRole}`);
      setRoleChangeModalOpen(false);
      fetchMembers();
    } catch (err) {
      onToast(err.response?.data?.message || err.message || 'Failed to change role', 'error');
    }
  };

  const memberList = Array.isArray(members) ? members : [];

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return memberList;
    const q = searchQuery.toLowerCase();
    return memberList.filter(
      (m) =>
        m?.name?.toLowerCase().includes(q) ||
        m?.email?.toLowerCase().includes(q) ||
        m?.role?.toLowerCase().includes(q)
    );
  }, [memberList, searchQuery]);

  return (
    <>
      <div className="settings-team-tabs">
        <button
          type="button"
          className={`settings-team-tab ${activeSubTab === 'members' ? 'is-active' : ''}`}
          onClick={() => setActiveSubTab('members')}
        >
          Members <span className="settings-team-count">{memberList.length}</span>
        </button>
        <button
          type="button"
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

          <div style={{ overflowX: 'auto' }}>
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
              <input
                type="text"
                placeholder="Search by name or email..."
                className="settings-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="settings-members-table">
              <thead>
                <tr>
                  <th>MEMBER</th>
                  <th>ROLE</th>
                  <th>LAST ACTIVE</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted, #8A847C)', fontSize: '13px' }}>
                      {searchQuery ? `No members matching "${searchQuery}"` : 'No team members found.'}
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m) => {
                    if (!m) return null;
                    const isYou = Boolean(
                      (adminUser?._id && m.id === adminUser._id) ||
                      (adminUser?.email && m.email && m.email.toLowerCase() === adminUser.email.toLowerCase())
                    );

                    return (
                      <tr key={m.id || m.email || Math.random()}>
                        <td>
                          <div className="settings-member-info">
                            <div className="settings-member-avatar">{m.initials || getInitials(m.name)}</div>
                            <div className="settings-member-details">
                              <div className="settings-member-name">
                                {m.name || 'Team Member'} {isYou && <span className="settings-member-you">(You)</span>}
                              </div>
                              <div className="settings-member-email">{m.email || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="settings-member-role">{m.role || 'Admin'}</td>
                        <td className={`settings-member-active ${m.lastActive === 'Active now' ? 'is-active-now' : ''}`}>
                          {m.lastActive || '—'}
                        </td>
                        <td>
                          <span className={`settings-member-status ${getStatusColor(m.status)}`}>
                            <span className="status-dot"></span> {m.status || 'Active'}
                          </span>
                        </td>
                        <td className="settings-table-actions">
                          <button
                            type="button"
                            className="settings-action-btn"
                            onClick={() => setMenuOpenId(menuOpenId === m.id ? null : m.id)}
                          >
                            <AdminIcon name="more" size={16} />
                          </button>
                          {menuOpenId === m.id && (
                            <div className="settings-dropdown">
                              {String(m.status).toLowerCase() === 'invited' ? (
                                <>
                                  <button type="button" onClick={() => handleResendInvite(m.id)}>
                                    <AdminIcon name="mail" size={14} /> Resend invite
                                  </button>
                                  <button type="button" onClick={() => handleRevokeInvite(m.id)} style={{ color: '#D34D4D' }}>
                                    <AdminIcon name="close" size={14} /> Revoke invite
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button type="button" onClick={() => openRoleModal(m)}>
                                    <AdminIcon name="pencil" size={14} /> Change role
                                  </button>
                                  {!isYou && (
                                    <>
                                      <button type="button" onClick={() => handleToggleMemberStatus(m.id, m.status)}>
                                        <AdminIcon name={String(m.status).toLowerCase() === 'active' ? 'stop' : 'check'} size={14} />
                                        {String(m.status).toLowerCase() === 'active' ? 'Deactivate member' : 'Reactivate member'}
                                      </button>
                                      <button type="button" onClick={() => handleRemoveMember(m.id)} style={{ color: '#D34D4D' }}>
                                        <AdminIcon name="trash" size={14} /> Remove member
                                      </button>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Change Role Modal */}
      {roleChangeModalOpen && selectedMember && (
        <div className="settings-modal-overlay" onClick={() => setRoleChangeModalOpen(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3 className="settings-modal-title">Change role – {selectedMember.name}</h3>
              <button type="button" className="settings-modal-close" onClick={() => setRoleChangeModalOpen(false)}>
                <AdminIcon name="close" size={18} />
              </button>
            </div>
            <div className="settings-modal-body">
              <div className="settings-form-group">
                <label className="settings-form-label">ASSIGN NEW ROLE</label>
                <select
                  className="settings-form-input settings-form-select"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                >
                  <option value="Store Manager">Store Manager</option>
                  <option value="Admin">Admin</option>
                  <option value="Support Agent">Support Agent</option>
                  <option value="Content Editor">Content Editor</option>
                  {adminUser?.adminRole === 'owner' && <option value="Owner">Owner</option>}
                </select>
                <div className="settings-input-helper">Note: Store must maintain at least one active Owner.</div>
              </div>
            </div>
            <div className="settings-modal-footer">
              <button type="button" className="settings-discard-btn" onClick={() => setRoleChangeModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="settings-save-btn" onClick={handleSaveRole}>
                Save role
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NotificationSettings({
  teamNotificationEmail,
  setTeamNotificationEmail,
  teamNotis,
  setTeamNotis,
  customerEmails,
  setCustomerEmails,
  customerNotis,
  setCustomerNotis,
}) {
  const updateTeamNoti = (key, type, val) => {
    setTeamNotis((prev) => ({ ...prev, [key]: { ...prev[key], [type]: val } }));
  };

  const updateCustNoti = (key, val) => {
    setCustomerNotis((prev) => ({ ...prev, [key]: val }));
  };

  return (
    <>
      <section className="settings-card">
        <div className="settings-card-header">
          <h2 className="settings-card-title">Team notifications</h2>
          <p className="settings-card-desc">Determine internal staff alerts for vital commercial events and stock alarms.</p>
        </div>

        <div className="settings-form-row single">
          <div className="settings-form-group" style={{ maxWidth: '360px' }}>
            <label className="settings-form-label">SEND NOTIFICATIONS TO</label>
            <input
              type="email"
              className="settings-form-input"
              value={teamNotificationEmail}
              onChange={(e) => setTeamNotificationEmail(e.target.value)}
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
              <input type="checkbox" checked={teamNotis.orders.email} onChange={(e) => updateTeamNoti('orders', 'email', e.target.checked)} />
              <span className="settings-toggle-slider"></span>
            </label>
            <label className="settings-toggle">
              <input type="checkbox" checked={teamNotis.orders.inApp} onChange={(e) => updateTeamNoti('orders', 'inApp', e.target.checked)} />
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
              <input type="checkbox" checked={teamNotis.returns.email} onChange={(e) => updateTeamNoti('returns', 'email', e.target.checked)} />
              <span className="settings-toggle-slider"></span>
            </label>
            <label className="settings-toggle">
              <input type="checkbox" checked={teamNotis.returns.inApp} onChange={(e) => updateTeamNoti('returns', 'inApp', e.target.checked)} />
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
              <input type="checkbox" checked={teamNotis.inventory.email} onChange={(e) => updateTeamNoti('inventory', 'email', e.target.checked)} />
              <span className="settings-toggle-slider"></span>
            </label>
            <label className="settings-toggle">
              <input type="checkbox" checked={teamNotis.inventory.inApp} onChange={(e) => updateTeamNoti('inventory', 'inApp', e.target.checked)} />
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
              <input type="checkbox" checked={teamNotis.customerAccounts.email} onChange={(e) => updateTeamNoti('customerAccounts', 'email', e.target.checked)} />
              <span className="settings-toggle-slider"></span>
            </label>
            <label className="settings-toggle">
              <input type="checkbox" checked={teamNotis.customerAccounts.inApp} onChange={(e) => updateTeamNoti('customerAccounts', 'inApp', e.target.checked)} />
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
              <input type="checkbox" checked={teamNotis.paymentDisputes.email} onChange={(e) => updateTeamNoti('paymentDisputes', 'email', e.target.checked)} />
              <span className="settings-toggle-slider"></span>
            </label>
            <label className="settings-toggle">
              <input type="checkbox" checked={teamNotis.paymentDisputes.inApp} onChange={(e) => updateTeamNoti('paymentDisputes', 'inApp', e.target.checked)} />
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
            <input
              type="text"
              className="settings-form-input"
              value={customerEmails.senderName}
              onChange={(e) => setCustomerEmails({ ...customerEmails, senderName: e.target.value })}
            />
          </div>
          <div className="settings-form-group">
            <label className="settings-form-label">REPLY-TO EMAIL</label>
            <input
              type="email"
              className="settings-form-input"
              value={customerEmails.replyToEmail}
              onChange={(e) => setCustomerEmails({ ...customerEmails, replyToEmail: e.target.value })}
            />
          </div>
        </div>

        <div className="settings-noti-row" style={{ marginTop: '16px' }}>
          <div className="settings-noti-row-info">
            <div className="settings-noti-row-title">Order confirmation</div>
            <div className="settings-noti-row-desc">Sent immediately following a verified credit authorization.</div>
          </div>
          <div className="settings-noti-toggles">
            <label className="settings-toggle">
              <input type="checkbox" checked={customerNotis.orderConf} onChange={(e) => updateCustNoti('orderConf', e.target.checked)} />
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
              <input type="checkbox" checked={customerNotis.shippingConf} onChange={(e) => updateCustNoti('shippingConf', e.target.checked)} />
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
              <input type="checkbox" checked={customerNotis.returnAppr} onChange={(e) => updateCustNoti('returnAppr', e.target.checked)} />
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
              <input type="checkbox" checked={customerNotis.refundIss} onChange={(e) => updateCustNoti('refundIss', e.target.checked)} />
              <span className="settings-toggle-slider"></span>
            </label>
          </div>
        </div>
      </section>
    </>
  );
}
