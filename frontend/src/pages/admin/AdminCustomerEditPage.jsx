import { useEffect, useState } from 'react';
import adminApi from '../../lib/api/adminApi';
import AdminCustomerForm from './AdminCustomerForm';

export default function AdminCustomerEditPage({ go, customerId, mode = 'create' }) {
  const isCreate = mode === 'create' || !customerId;
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [serverErrors, setServerErrors] = useState({});

  const notify = (msg) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(''), 3500);
  };

  useEffect(() => {
    if (isCreate) {
      setLoading(false);
      return;
    }

    setLoading(true);
    adminApi
      .getCustomer(customerId)
      .then((res) => {
        if (res.data) {
          setCustomer(res.data);
        }
      })
      .catch((err) => {
        notify(err.response?.data?.message || err.message || 'Failed to load customer profile.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [customerId, isCreate]);

  const handleSave = async (payload) => {
    setSaving(true);
    setServerErrors({});

    try {
      if (isCreate) {
        const res = await adminApi.createCustomer(payload);
        notify(res.message || 'Customer created and invitation sent.');
        const newId = res.data?._id || res.data?.id;
        window.setTimeout(() => {
          if (newId && go) go(`/admin/customers/${newId}`);
          else if (go) go('/admin/customers');
        }, 600);
      } else {
        const res = await adminApi.updateCustomer(customerId, payload);
        notify(res.message || 'Customer details updated successfully.');
        window.setTimeout(() => {
          if (go) go(`/admin/customers/${customerId}`);
        }, 600);
      }
    } catch (err) {
      const resp = err.response?.data;
      const message = resp?.message || err.message || 'Failed to save customer.';
      notify(message);

      // Handle field-level validation errors
      if (resp?.errors && typeof resp.errors === 'object') {
        setServerErrors(resp.errors);
      } else if (message.toLowerCase().includes('email')) {
        setServerErrors({ email: message });
      } else if (message.toLowerCase().includes('phone')) {
        setServerErrors({ phone: message });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard p-12 text-center text-xs text-[var(--text-muted)]">
        Loading customer record from database…
      </div>
    );
  }

  if (!isCreate && !customer) {
    return (
      <div className="admin-dashboard cd-page p-8 text-center">
        <button className="pe-breadcrumb" type="button" onClick={() => go('/admin/customers')}>
          ← Back to Customers
        </button>
        <h1 className="text-base font-bold text-[var(--text-primary)] mt-3">Customer Not Found</h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">That storefront account does not exist.</p>
        <button
          className="admin-action-button is-primary mt-4 inline-flex"
          type="button"
          onClick={() => go('/admin/customers')}
        >
          Return to Directory
        </button>
      </div>
    );
  }

  return (
    <>
      <AdminCustomerForm
        mode={isCreate ? 'create' : 'edit'}
        customer={customer}
        isSaving={saving}
        serverErrors={serverErrors}
        onBack={() => {
          if (!isCreate && customerId) go(`/admin/customers/${customerId}`);
          else go('/admin/customers');
        }}
        onDiscard={() => {
          if (!isCreate && customerId) go(`/admin/customers/${customerId}`);
          else go('/admin/customers');
        }}
        onSave={handleSave}
      />
      {notice && <div className="admin-toast" role="status">{notice}</div>}
    </>
  );
}
