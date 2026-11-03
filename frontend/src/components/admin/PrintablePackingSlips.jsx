import { useEffect } from 'react';
import { formatCurrency, formatDate } from '../../lib/formatters';

export default function PrintablePackingSlips({ orders = [], onClose }) {
  useEffect(() => {
    // Add print class to body if needed
    document.body.classList.add('packing-slip-active');
    return () => {
      document.body.classList.remove('packing-slip-active');
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-2xl print:m-0 print:max-h-none print:w-full print:p-0 print:shadow-none">
        {/* Screen Action Bar (hidden during print) */}
        <div className="mb-6 flex items-center justify-between border-b border-[#EEE8E0] pb-4 print:hidden">
          <div>
            <h2 className="text-xl font-serif text-[#1B1816]">Print Packing Slips</h2>
            <p className="text-xs text-[#7A726C]">{orders.length} order(s) selected for fulfillment dispatch</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="admin-action-button"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="admin-action-button is-primary"
            >
              Print Now
            </button>
          </div>
        </div>

        {/* Printable Sheets */}
        <div className="space-y-8 print:space-y-0">
          {orders.map((order, idx) => (
            <div
              key={order.id || order.orderNumber || idx}
              className="border border-[#E0D9CF] p-8 print:border-none print:p-8 print:break-after-page"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b-2 border-[#1B1816] pb-4">
                <div>
                  <h1 className="font-serif text-2xl font-bold tracking-widest text-[#1B1816]">NOVASHOP</h1>
                  <p className="text-[10px] tracking-wider text-[#7A726C] uppercase">Luxury Contemporary Apparel</p>
                </div>
                <div className="text-right">
                  <div className="inline-block rounded bg-[#F4EFEA] px-3 py-1 font-mono text-sm font-bold text-[#1B1816]">
                    #{order.orderNumber}
                  </div>
                  <p className="mt-1 text-[11px] text-[#7A726C]">Date: {formatDate(order.paidAt || order.createdAt, 'dateTime')}</p>
                </div>
              </div>

              {/* Addresses Grid */}
              <div className="mt-6 grid grid-cols-2 gap-6 text-xs text-[#332E29]">
                <div className="rounded bg-[#FAF8F5] p-4">
                  <p className="text-[10px] font-bold tracking-wider text-[#8A847C] uppercase">Ship To</p>
                  <p className="mt-1 text-sm font-bold text-[#1B1816]">{order.customerName}</p>
                  <p className="mt-1 leading-relaxed text-[#5F5952]">
                    {order.shippingAddress?.address || 'Standard Delivery'}<br />
                    {order.shippingAddress?.city ? `${order.shippingAddress.city}, ` : ''}
                    {order.shippingAddress?.postalCode || ''}<br />
                    {order.shippingAddress?.country || 'Ethiopia'}<br />
                    {order.shippingAddress?.phone ? `Tel: ${order.shippingAddress.phone}` : ''}
                  </p>
                </div>

                <div className="rounded bg-[#FAF8F5] p-4">
                  <p className="text-[10px] font-bold tracking-wider text-[#8A847C] uppercase">Order Details</p>
                  <p className="mt-1"><strong className="text-[#1B1816]">Customer:</strong> {order.customerEmail}</p>
                  <p className="mt-1"><strong className="text-[#1B1816]">Payment Status:</strong> Paid (Verified)</p>
                  <p className="mt-1"><strong className="text-[#1B1816]">Payment Method:</strong> {order.paymentMethod || 'Chapa Online'}</p>
                  <p className="mt-1"><strong className="text-[#1B1816]">Fulfillment Status:</strong> Ready for Dispatch</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="mt-6">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#1B1816] text-[10px] font-bold tracking-wider text-[#7A726C] uppercase">
                      <th className="py-2">Item Description</th>
                      <th className="py-2">SKU / Variant</th>
                      <th className="py-2 text-center">Qty</th>
                      <th className="py-2 text-right">Price</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFEAE4]">
                    {(order.items || []).map((item, itemIdx) => (
                      <tr key={itemIdx}>
                        <td className="py-3 font-medium text-[#1B1816]">{item.name}</td>
                        <td className="py-3 text-[#7A726C]">
                          {item.sku || 'N/A'} · {[item.color, item.size].filter(Boolean).join(' / ')}
                        </td>
                        <td className="py-3 text-center font-bold text-[#1B1816]">{item.qty || 1}</td>
                        <td className="py-3 text-right text-[#5F5952]">{formatCurrency(item.price, order.currency)}</td>
                        <td className="py-3 text-right font-bold text-[#1B1816]">
                          {formatCurrency((item.price || 0) * (item.qty || 1), order.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#1B1816]">
                      <td colSpan="4" className="py-3 text-right text-xs font-bold text-[#1B1816] uppercase">
                        Order Grand Total:
                      </td>
                      <td className="py-3 text-right font-serif text-sm font-bold text-[#1B1816]">
                        {formatCurrency(order.totalPrice, order.currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Dispatch Sign-off */}
              <div className="mt-8 grid grid-cols-2 gap-8 border-t border-dashed border-[#DDD6CC] pt-4 text-[11px] text-[#7A726C]">
                <div>
                  <p>Quality Inspected By: ___________________________</p>
                  <p className="mt-2">Pack Date: {new Date().toLocaleDateString()}</p>
                </div>
                <div>
                  <p>Courier Signature: ___________________________</p>
                  <p className="mt-2">Tracking / Consignment #: ____________________</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
