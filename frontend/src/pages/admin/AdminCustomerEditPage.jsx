import { useState } from 'react';
import AdminCustomerForm from './AdminCustomerForm';
import { hydrateCustomer, upsertCustomerRecord } from './adminCustomerData';

export default function AdminCustomerEditPage({ go, mode = 'create', customerId }) {
  const isCreate = mode === 'create';
  const customer = isCreate ? null : hydrateCustomer(customerId);
  const [notice, setNotice] = useState('');

  if (!isCreate && !customer) {
    return (
      <div className="admin-dashboard cd-page">
        <button className="pe-breadcrumb" type="button" onClick={() => go('/admin/customers')}>← Customers</button>
        <h1>Customer not found</h1>
        <p>That storefront account is not in the customer directory.</p>
      </div>
    );
  }

  const saveCustomer = (record) => {
    upsertCustomerRecord(record);
    if (isCreate) {
      window.sessionStorage.setItem('novashop-customer-flash', 'Customer profile created.');
      go(`/admin/customers/${record.id}`);
      return;
    }
    setNotice('Customer profile updated.');
    window.setTimeout(() => go(`/admin/customers/${record.id}`), 400);
  };

  return (
    <>
      <AdminCustomerForm
        mode={isCreate ? 'create' : 'edit'}
        customer={customer}
        onBack={() => go(isCreate ? '/admin/customers' : `/admin/customers/${customer.id}`)}
        onDiscard={() => go('/admin/customers')}
        onSave={saveCustomer}
      />
      {notice && <div className="admin-toast" role="status">{notice}</div>}
    </>
  );
}
