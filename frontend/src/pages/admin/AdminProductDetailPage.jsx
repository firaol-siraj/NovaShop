import { useEffect, useState } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import adminApi from '../../lib/api/adminApi';
import { formatCurrency, formatRelativeTime } from '../../lib/formatters';
import './admin-product-detail.css';

function DetailCard({ children, className = '' }) {
  return <section className={`admin-card product-detail-card ${className}`}>{children}</section>;
}

function CardHeading({ title, subtitle, action }) {
  return (
    <header className="pd-card-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export default function AdminProductDetailPage({ productId, go }) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState('');
  const [notice, setNotice] = useState('');

  const notify = (msg) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(''), 2600);
  };

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    setError('');

    adminApi
      .getProduct(productId)
      .then((res) => {
        if (res.data) {
          setProduct(res.data);
          const firstImg = res.data.image || (res.data.images && res.data.images[0]) || '';
          setSelectedImage(firstImg);
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || err.message || 'Product not found.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [productId]);

  const handleDelete = async () => {
    if (!product) return;
    if (!window.confirm(`Delete "${product.name}"? If it has paid orders, it will be safely archived instead.`)) {
      return;
    }
    try {
      const res = await adminApi.deleteProduct(product._id);
      notify(res.message || 'Product deleted.');
      window.setTimeout(() => go('/admin/products'), 500);
    } catch (err) {
      notify(err.response?.data?.message || err.message || 'Failed to delete product.');
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard p-12 text-center text-xs text-[#8A847C]">
        Loading product details from database…
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="admin-dashboard p-12 text-center">
        <h2 className="text-base font-bold text-[#1B1816]">Item Not Found</h2>
        <p className="text-xs text-[#8A847C] mt-1">{error || 'This item no longer exists in the catalog.'}</p>
        <button
          className="admin-action-button is-primary mt-4 inline-flex"
          type="button"
          onClick={() => go('/admin/products')}
        >
          Back to Products
        </button>
      </div>
    );
  }

  const metrics = product.metrics || { unitsSold: 0, totalRevenue: 0, ordersCount: 0 };
  const variants = product.variants || [];
  const images = (product.images && product.images.length > 0 ? product.images : [product.image]).filter(Boolean);

  return (
    <div className="admin-dashboard product-detail-page">
      {/* Header */}
      <section className="admin-page-heading pd-page-heading">
        <div className="pd-heading-text">
          <div className="pd-breadcrumb">
            <button type="button" onClick={() => go('/admin/products')}>
              Products
            </button>
            <span>/</span>
            <span>{product.name}</span>
          </div>
          <div className="pd-title-row">
            <h1 className="admin-page-title">{product.name}</h1>
            <span className={`products-status-pill ${product.status.toLowerCase()}`}>
              <i />
              {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
            </span>
          </div>
          <p className="pd-meta-line">
            Category: <strong>{product.category?.name || 'Uncategorized'}</strong> · Brand: <strong>{product.brand}</strong> · Base Price: <strong>{formatCurrency(product.price)}</strong>
          </p>
        </div>

        <div className="admin-page-actions pd-page-actions">
          <button
            className="admin-action-button"
            type="button"
            onClick={() => window.open(`/product/${product.slug || product._id}`, '_blank')}
          >
            <AdminIcon name="sliders" size={15} /> Storefront
          </button>
          <button
            className="admin-action-button"
            type="button"
            onClick={handleDelete}
          >
            <AdminIcon name="close" size={14} /> Delete
          </button>
          <button
            className="admin-action-button is-primary"
            type="button"
            onClick={() => go(`/admin/products/${product._id}/edit`)}
          >
            <AdminIcon name="pencil" size={14} /> Edit Product
          </button>
        </div>
      </section>

      {/* KPI Cards */}
      <section className="admin-stat-grid pd-stat-grid" aria-label="Product performance">
        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Total Units Sold (Paid)</span>
          </div>
          <div className="admin-stat-value">{metrics.unitsSold}</div>
          <span className="text-[11px] text-[#8A847C] font-medium">Across all completed orders</span>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Total Revenue</span>
          </div>
          <div className="admin-stat-value">{formatCurrency(metrics.totalRevenue)}</div>
          <span className="text-[11px] text-[#8A847C] font-medium">Paid orders volume</span>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Available Inventory</span>
          </div>
          <div className="admin-stat-value">{product.countInStock}</div>
          <span className="text-[11px] text-[#8A847C] font-medium">
            {variants.length} active SKU variant{variants.length === 1 ? '' : 's'}
          </span>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Orders Count</span>
          </div>
          <div className="admin-stat-value">{metrics.ordersCount}</div>
          <span className="text-[11px] text-[#8A847C] font-medium">Purchased in {metrics.ordersCount} order(s)</span>
        </article>
      </section>

      {/* Product Content Grid */}
      <div className="pd-grid">
        {/* Left Column: Visuals & Variants */}
        <div className="pd-main-column space-y-6">
          {/* Gallery & Description */}
          <DetailCard>
            <CardHeading title="Product Overview" subtitle="Description & High-resolution Imagery" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div>
                <div className="aspect-[4/3] rounded-lg overflow-hidden border border-[#DDD6CC] bg-[#F7F5F0]">
                  {selectedImage ? (
                    <img src={selectedImage} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-[#8A847C]">No image</div>
                  )}
                </div>
                {images.length > 1 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                    {images.map((src, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedImage(src)}
                        className={`w-14 h-14 rounded-md overflow-hidden border flex-shrink-0 ${selectedImage === src ? 'border-[#1B1816] ring-1 ring-[#1B1816]' : 'border-[#DDD6CC]'}`}
                      >
                        <img src={src} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-bold text-[#1B1816] uppercase tracking-wider mb-2">Description</h3>
                <p className="text-xs text-[#524C46] leading-relaxed whitespace-pre-wrap">{product.description}</p>
                <div className="mt-6 border-t border-[#ECE7E0] pt-4 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#F5F2ED]">
                    <span className="text-[#8A847C]">Slug</span>
                    <span className="font-mono font-medium text-[#1B1816]">{product.slug}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F5F2ED]">
                    <span className="text-[#8A847C]">Base Price</span>
                    <span className="font-bold text-[#1B1816]">{formatCurrency(product.price)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F5F2ED]">
                    <span className="text-[#8A847C]">Gender</span>
                    <span className="capitalize font-medium text-[#1B1816]">{product.gender || 'Unisex'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#8A847C]">Created Date</span>
                    <span className="font-medium text-[#1B1816]">{new Date(product.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </DetailCard>

          {/* Variants Table */}
          <DetailCard>
            <CardHeading
              title="Variants & Real Stock"
              subtitle="Stock levels, reservations, and stock health status"
              action={
                <button
                  type="button"
                  className="admin-action-button text-xs py-1"
                  onClick={() => go('/admin/inventory')}
                >
                  Adjust in Inventory →
                </button>
              }
            />
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#ECE7E0] text-[11px] uppercase tracking-wider text-[#766247]">
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Size</th>
                    <th className="py-2.5 px-3">Color</th>
                    <th className="py-2.5 px-3">On Hand</th>
                    <th className="py-2.5 px-3">Reserved</th>
                    <th className="py-2.5 px-3">Available</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0ECE6]">
                  {variants.map((v) => {
                    const colorName = typeof v.color === 'object' ? v.color?.name : v.color || 'Default';
                    const colorHex = typeof v.color === 'object' ? v.color?.hex : '#000000';
                    const available = v.available != null ? v.available : Math.max(0, (v.stock || 0) - (v.reserved || 0));
                    return (
                      <tr key={v._id || v.sku} className="hover:bg-[#FAF8F5]">
                        <td className="py-2.5 px-3 font-mono font-semibold text-[#1B1816]">{v.sku}</td>
                        <td className="py-2.5 px-3 font-semibold">{v.size}</td>
                        <td className="py-2.5 px-3">
                          <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full border border-black/10 inline-block" style={{ backgroundColor: colorHex }} />
                            {colorName}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[#1B1816]">{v.stock}</td>
                        <td className="py-2.5 px-3 text-[#766247]">{v.reserved || 0}</td>
                        <td className="py-2.5 px-3 font-bold text-[#1B1816]">{available}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              available === 0
                                ? 'bg-[#F9EEEB] text-[#B04F3D]'
                                : v.stockStatus === 'critical' || v.stockStatus === 'low stock'
                                ? 'bg-[#FDF6E2] text-[#8C6D23]'
                                : 'bg-[#EBF5EE] text-[#2C6B4F]'
                            }`}
                          >
                            {v.stockStatus ? v.stockStatus.toUpperCase() : available === 0 ? 'OUT OF STOCK' : 'IN STOCK'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </DetailCard>
        </div>

        {/* Right Column: Recent Orders for this Product */}
        <div className="pd-side-column space-y-6">
          <DetailCard>
            <CardHeading title="Recent Orders" subtitle="Latest orders containing this product" />
            <div className="mt-4 space-y-3">
              {(product.recentOrders || []).length === 0 ? (
                <p className="text-xs text-[#8A847C] py-6 text-center">No orders placed for this product yet.</p>
              ) : (
                (product.recentOrders || []).map((order) => (
                  <div
                    key={order._id}
                    onClick={() => go(`/admin/orders/${order._id}`)}
                    className="p-3 rounded-lg border border-[#EDE8E1] hover:border-[#DDD6CC] bg-[#FAF8F5] hover:bg-white cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-[#1B1816]">
                        #{order.orderNumber || order._id.slice(-6)}
                      </span>
                      <span className="text-[10px] text-[#8A847C]">
                        {formatRelativeTime(order.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-xs">
                      <span className="text-[#6F6962] truncate max-w-[160px]">
                        {order.customerEmail || 'Customer'}
                      </span>
                      <span className="font-bold text-[#1B1816]">
                        {formatCurrency(order.totalPrice)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`products-status-pill text-[10px] ${order.status.toLowerCase()}`}>
                        <i />
                        {order.status}
                      </span>
                      {order.isPaid && (
                        <span className="text-[10px] font-bold text-[#2C6B4F]">✓ Paid</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </DetailCard>
        </div>
      </div>

      {notice && <div className="admin-toast" role="status">{notice}</div>}
    </div>
  );
}
