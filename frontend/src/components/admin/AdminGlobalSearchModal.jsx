import { useState, useEffect, useRef, useCallback } from 'react';
import adminApi from '../../lib/api/adminApi';
import { AdminIcon } from './AdminLayout';
import { formatCurrency, formatDate } from '../../lib/formatters';

export default function AdminGlobalSearchModal({ isOpen, onClose, go }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ orders: [], products: [], customers: [] });
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const focusTimer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(focusTimer);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setQuery('');
    setResults({ orders: [], products: [], customers: [] });
    onClose();
  }, [onClose]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    const clean = query.trim();
    if (!clean) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await adminApi.globalSearch(clean);
        if (res?.data) {
          setResults(res.data);
        }
      } catch (err) {
        console.error('Global search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const totalResultsCount =
    results.orders.length + results.products.length + results.customers.length;

  const navigateTo = (path) => {
    handleClose();
    go(path);
  };

  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-[#DDD6CC] bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Global Admin Search"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-[#ECE7E0] bg-[#FAF8F5] px-4 py-3.5">
          <AdminIcon name="search" size={20} className="text-[#8A847C]" />
          <input
            ref={inputRef}
            type="search"
            className="w-full bg-transparent text-sm text-[#1B1816] placeholder-[#A29B93] outline-none"
            placeholder="Search orders by number, products by name, customers..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {isLoading && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#1B1816] border-t-transparent" />
          )}
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-[#8A847C] hover:bg-[#EFEAE4] hover:text-[#1B1816]"
            aria-label="Close search"
          >
            <AdminIcon name="close" size={16} />
          </button>
        </div>

        {/* Results Area */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {!query.trim() && (
            <div className="py-12 text-center text-xs text-[#8A847C]">
              Type a search term to find real Orders, Products, or Customers.
            </div>
          )}

          {query.trim() && !isLoading && totalResultsCount === 0 && (
            <div className="py-12 text-center text-xs text-[#8A847C]">
              No results found for &ldquo;{query}&rdquo;.
            </div>
          )}

          {/* Orders Section */}
          {results.orders.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#8A847C]">
                Orders ({results.orders.length})
              </div>
              <div className="divide-y divide-[#F0ECE6] rounded-lg border border-[#EBE5DC] bg-white">
                {results.orders.map((order) => (
                  <div
                    key={order.id}
                    onClick={() => navigateTo(`/admin/orders/${order.id}`)}
                    className="flex cursor-pointer items-center justify-between p-3 transition hover:bg-[#F9F7F4]"
                  >
                    <div>
                      <span className="font-mono text-xs font-bold text-[#1B1816]">
                        #{order.orderNumber}
                      </span>
                      <span className="ml-2 text-xs text-[#7A726C]">
                        {order.customerEmail}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`admin-status-pill ${(order.status || 'pending').toLowerCase()}`}>
                        {order.status}
                      </span>
                      <span className="text-xs font-bold text-[#1B1816]">
                        {formatCurrency(order.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Products Section */}
          {results.products.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#8A847C]">
                Products ({results.products.length})
              </div>
              <div className="divide-y divide-[#F0ECE6] rounded-lg border border-[#EBE5DC] bg-white">
                {results.products.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => navigateTo(`/admin/products/${product.id}/edit`)}
                    className="flex cursor-pointer items-center justify-between p-3 transition hover:bg-[#F9F7F4]"
                  >
                    <div className="flex items-center gap-3">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-9 w-8 rounded object-cover border border-[#E5DFD7]"
                        />
                      ) : (
                        <div className="h-9 w-8 rounded bg-[#F2EDE5] border border-[#E5DFD7]" />
                      )}
                      <div>
                        <div className="text-xs font-bold text-[#1B1816]">{product.name}</div>
                        <div className="text-[10px] text-[#7A726C]">{product.category} · Stock: {product.stock}</div>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-[#1B1816]">
                      {formatCurrency(product.price)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customers Section */}
          {results.customers.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#8A847C]">
                Customers ({results.customers.length})
              </div>
              <div className="divide-y divide-[#F0ECE6] rounded-lg border border-[#EBE5DC] bg-white">
                {results.customers.map((cust) => (
                  <div
                    key={cust.id}
                    onClick={() => navigateTo(`/admin/customers/${cust.id}`)}
                    className="flex cursor-pointer items-center justify-between p-3 transition hover:bg-[#F9F7F4]"
                  >
                    <div>
                      <div className="text-xs font-bold text-[#1B1816]">{cust.name}</div>
                      <div className="text-[10px] text-[#7A726C]">{cust.email} · {cust.phone || 'No phone'}</div>
                    </div>
                    <div className="text-[10px] text-[#8A847C]">
                      Joined {formatDate(cust.joinedAt, 'short')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-[#ECE7E0] bg-[#FAF8F5] px-4 py-2 text-[10px] text-[#8A847C]">
          <span>Press <kbd className="rounded border border-[#DDD6CC] bg-white px-1.5 py-0.5 font-mono">ESC</kbd> to close</span>
          <span>Click any item to view</span>
        </div>
      </div>
    </div>
  );
}
