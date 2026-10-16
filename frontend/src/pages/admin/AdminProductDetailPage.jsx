import { useState } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import './admin-product-detail.css';

const media = [
  'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1548126032-079a0fb0099d?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1591369822096-ffd140ec948f?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=360&q=80',
];

const variants = [
  { color: 'Camel', size: 'S', sku: 'NS-OC-0142-CAM-S', stock: 14, shade: '#B99C78' },
  { color: 'Camel', size: 'M', sku: 'NS-OC-0142-CAM-M', stock: 18, shade: '#B99C78' },
  { color: 'Camel', size: 'L', sku: 'NS-OC-0142-CAM-L', stock: 12, shade: '#B99C78' },
  { color: 'Black', size: 'S', sku: 'NS-OC-0142-BLK-S', stock: 16, shade: '#272624', highlighted: true },
  { color: 'Black', size: 'M', sku: 'NS-OC-0142-BLK-M', stock: 22, shade: '#272624' },
  { color: 'Black', size: 'L', sku: 'NS-OC-0142-BLK-L', stock: 2, shade: '#272624' },
];

const orders = [
  { id: 'NS-10482', customer: 'Sarah Mitchell', email: 'sarah.m@example.com', date: 'Oct 24, 2026', status: 'Delivered', total: '$1,450.00' },
  { id: 'NS-10475', customer: 'James Okafor', email: 'james.o@example.com', date: 'Oct 23, 2026', status: 'Shipped', total: '$2,340.00' },
  { id: 'NS-10469', customer: 'Amelia Chen', email: 'amelia.c@example.com', date: 'Oct 22, 2026', status: 'Processing', total: '$1,450.00' },
  { id: 'NS-10461', customer: 'Lucas Meyer', email: 'lucas.m@example.com', date: 'Oct 21, 2026', status: 'Pending', total: '$2,900.00' },
  { id: 'NS-10454', customer: 'Priya Raman', email: 'priya.r@example.com', date: 'Oct 20, 2026', status: 'Cancelled', total: '$1,450.00' },
];

const ratings = [
  { stars: 5, count: 88 }, { stars: 4, count: 24 }, { stars: 3, count: 10 }, { stars: 2, count: 3 }, { stars: 1, count: 1 },
];

function DetailCard({ children, className = '' }) {
  return <section className={`admin-card product-detail-card ${className}`}>{children}</section>;
}

function CardHeading({ title, subtitle, action }) {
  return <header className="pd-card-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</header>;
}

function Stars({ count = 5 }) {
  return <span className="pd-stars" aria-label={`${count} out of 5 stars`}>{[1, 2, 3, 4, 5].map((star) => <span className={star <= count ? 'is-filled' : star - 0.5 <= count ? 'is-half' : ''} key={star}>★</span>)}</span>;
}

function SalesChart({ range }) {
  const chartPaths = {
    '7D': 'M45 185 C88 166 107 160 144 165 S200 122 238 138 S290 102 326 117 S380 84 414 95 S467 63 506 78 S560 43 598 54 S649 29 690 39',
    '30D': 'M45 185 C82 158 107 173 144 143 S197 151 238 121 S282 131 326 103 S373 125 414 94 S464 114 506 76 S556 96 598 53 S650 70 690 39',
    '90D': 'M45 185 C83 198 107 145 144 159 S199 111 238 134 S282 87 326 112 S375 84 414 99 S466 51 506 76 S557 48 598 59 S654 21 690 39',
  };
  return (
    <div className="pd-chart-wrap">
      <svg className="pd-sales-chart" viewBox="0 0 720 235" role="img" aria-label={`Sales velocity over ${range}`}>
        {[25, 78, 131, 184].map((y, index) => <g key={y}><line x1="45" y1={y} x2="690" y2={y} /><text x="0" y={y + 4}>{['$45k', '$30k', '$15k', '$0'][index]}</text></g>)}
        <path className="pd-chart-area" d={`${chartPaths[range]} L690 184 L45 184 Z`} />
        <path className="pd-chart-line" d={chartPaths[range]} />
        <line className="pd-chart-guide" x1="414" y1="94" x2="414" y2="184" />
        <circle className="pd-chart-point" cx="414" cy="94" r="4" />
        <foreignObject x="355" y="29" width="168" height="48"><div xmlns="http://www.w3.org/1999/xhtml" className="pd-chart-tooltip">Sep 18 · 14 units · $20,300</div></foreignObject>
        <text className="pd-chart-date" x="45" y="218">Sep 1</text><text className="pd-chart-date" x="365" y="218">Sep 15</text><text className="pd-chart-date" x="655" y="218">Sep 29</text>
      </svg>
    </div>
  );
}

export default function AdminProductDetailPage({ go }) {
  const [activeMedia, setActiveMedia] = useState(0);
  const [range, setRange] = useState('30D');
  const [specsOpen, setSpecsOpen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2200);
  };

  return (
    <div className="admin-dashboard product-detail-page">
      <header className="pd-page-header">
        <div className="pd-title-block">
          <button className="pd-breadcrumb" type="button" onClick={() => go('/admin/products')}><AdminIcon name="left" size={14} /> Products</button>
          <div className="pd-title-row"><h1>Cashmere Overcoat</h1><span className="products-status-pill active"><i /> ACTIVE</span></div>
          <p>Outerwear · Updated 2 days ago</p>
        </div>
        <div className="pd-header-actions">
          <div className="pd-menu-anchor"><button className="admin-action-button pd-overflow-button" type="button" aria-label="More product actions" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><AdminIcon name="more" size={17} /></button>{menuOpen && <div className="pd-overflow-menu"><button type="button" onClick={() => { setMenuOpen(false); notify('Product link copied.'); }}>Copy product link</button><button type="button" onClick={() => { setMenuOpen(false); notify('Product duplicated as a draft.'); }}>Duplicate product</button><button type="button" onClick={() => { setMenuOpen(false); notify('Product archived from the storefront.'); }}>Archive product</button></div>}</div>
          <button className="admin-action-button" type="button" onClick={() => notify('Storefront preview opened.')}>View in store <span aria-hidden="true">↗</span></button>
          <button className="admin-action-button is-primary" type="button" onClick={() => go('/admin/products/cashmere-overcoat/edit')}><span aria-hidden="true">✎</span> Edit product</button>
        </div>
      </header>

      <DetailCard className="pd-performance-card">
        <div className="pd-performance-heading"><h2>LAST 30 DAYS PERFORMANCE</h2><span>Sep 25 – Oct 24, 2026</span></div>
        <div className="pd-performance-stats">
          <div><span>Units sold <b className="pd-positive">+14%</b></span><strong>312</strong></div>
          <div><span>Revenue <b className="pd-positive">+9%</b></span><strong>$452,400</strong></div>
          <div><span>Conversion <b className="pd-negative">−0.4%</b></span><strong>3.8%</strong></div>
          <div><span>In stock <b className="pd-variant-count">6 variants</b></span><strong>84</strong></div>
        </div>
      </DetailCard>

      <div className="pd-content-columns">
        <div className="pd-main-column">
          <DetailCard className="pd-media-card">
            <CardHeading title="Media (5 assets)" action={<button className="admin-text-link" type="button" onClick={() => notify('Media upload selected.')}>↑ Upload new</button>} />
            <div className="pd-media-gallery">
              <div className="pd-primary-media"><img src={media[activeMedia]} alt="Cashmere overcoat from the product catalog" /><span>PRIMARY VIEW</span></div>
              <div className="pd-media-thumbnails" aria-label="Product media">
                {media.slice(1).map((image, index) => <button type="button" key={image} className={activeMedia === index + 1 ? 'is-active' : ''} onClick={() => setActiveMedia(index + 1)} aria-label={`Show product image ${index + 2}`}><img src={image} alt="" />{index === 3 && <span>+2</span>}</button>)}
              </div>
            </div>
          </DetailCard>

          <DetailCard className="pd-sales-card">
            <CardHeading title="Sales Velocity" subtitle="Aggregate gross volume across retail channels" action={<div className="admin-segmented-control" role="group" aria-label="Sales chart range">{['7D', '30D', '90D'].map((option) => <button type="button" key={option} className={range === option ? 'is-active' : ''} aria-pressed={range === option} onClick={() => setRange(option)}>{option}</button>)}</div>} />
            <SalesChart range={range} />
          </DetailCard>

          <DetailCard className="pd-variants-card">
            <CardHeading title="Variants & Stock" subtitle="84 total pieces in stock across 6 SKUs" action={<span className="pd-sync-pill"><i /> Syncing inventory</span>} />
            <div className="pd-table-scroll"><table className="pd-variants-table"><thead><tr><th>VARIANT</th><th>PRICE</th><th>INVENTORY LEVEL</th><th>STATUS</th></tr></thead><tbody>{variants.map((variant) => <tr key={variant.sku} className={variant.highlighted ? 'is-highlighted' : ''}><td><div className="pd-variant-name"><i style={{ background: variant.shade }} /><div><strong>{variant.color} / {variant.size}</strong><span>{variant.sku}</span></div></div></td><td>$1,450.00</td><td><div className="pd-stock-level"><span>{variant.stock} in stock</span><div><i style={{ width: `${Math.max(12, variant.stock / 22 * 100)}%` }} /></div><small>{variant.stock < 5 ? 'Low stock' : 'Healthy'}</small></div></td><td><span className="products-status-pill active"><i /> Active</span></td></tr>)}</tbody></table></div>
          </DetailCard>

          <DetailCard className="pd-orders-card">
            <CardHeading title="Recent Orders" subtitle="Purchases containing this garment in the last 7 days" action={<button className="admin-text-link" type="button" onClick={() => notify('All product orders selected.')}>View all orders <span>→</span></button>} />
            <div className="pd-table-scroll"><table className="pd-orders-table"><colgroup><col /><col /><col /><col /></colgroup><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>STATUS</th><th>TOTAL</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><div className="pd-order-copy"><strong>#{order.id}</strong><span>{order.date}</span></div></td><td><div className="pd-order-copy"><strong>{order.customer}</strong><span>{order.email}</span></div></td><td><span className={`admin-status-pill ${order.status.toLowerCase()}`}>{order.status}</span></td><td>{order.total}</td></tr>)}</tbody></table></div>
          </DetailCard>

          <DetailCard className="pd-feedback-card">
            <CardHeading title="Customer Feedback" subtitle="Verified purchaser sentiment and sizing notes" action={<button className="admin-text-link" type="button" onClick={() => notify('All product reviews selected.')}>View all reviews <span>→</span></button>} />
            <div className="pd-feedback-summary"><div className="pd-rating-total"><strong>4.8</strong><Stars count={4.5} /><span>126 verified reviews</span></div><div className="pd-rating-breakdown">{ratings.map(({ stars, count }) => <div key={stars}><span>{stars}★</span><div><i style={{ width: `${count / 88 * 100}%` }} /></div><b>{count}</b></div>)}</div></div>
            <article className="pd-review-entry"><div className="pd-review-meta"><span className="pd-review-avatar">ER</span><div><strong>Elena Rostova</strong><span>Verified Buyer · Oct 14, 2026</span></div><Stars /></div><blockquote>“Exceptional weight and drape. The fabric has an understated sheen that speaks to the cashmere quality, and the tailored shoulders fit impeccably over a suit or fine knit.”</blockquote></article>
          </DetailCard>
        </div>

        <aside className="pd-side-column">
          <DetailCard className="pd-storefront-card"><div className="pd-storefront-heading"><h2>STOREFRONT STATUS</h2><span className="products-status-pill active"><i /> Active</span></div><p>Visible in your store and indexed across all international catalogs.</p><div className="pd-storefront-links"><button type="button" onClick={() => notify('Storefront preview opened.')}>View in store ↗</button><button type="button" onClick={() => notify('Product archived from the storefront.')}>Archive</button></div></DetailCard>

          <DetailCard className="pd-pricing-card"><h2>Pricing</h2><div className="pd-price-rows"><div><span>Retail price</span><strong>$1,450.00</strong></div><div><span>Compare-at price</span><strong className="pd-compare-price">$1,650.00</strong></div><div><span>Cost per item</span><strong>$620.00</strong></div></div><div className="pd-margin-row"><div><strong>Profit Margin</strong><span>Net per unit</span></div><div><b>57%</b><span>$830.00 profit</span></div></div></DetailCard>

          <DetailCard className="pd-organization-card"><h2>Organization</h2><div className="pd-organization-field"><span>CATEGORY</span><strong>Outerwear</strong></div><div className="pd-organization-field"><span>COLLECTIONS</span><div className="pd-tags"><span>Autumn Winter</span><span>Best Sellers</span></div></div><div className="pd-organization-field"><span>TAGS</span><div className="pd-tags muted"><span>cashmere</span><span>coat</span><span>tailored</span></div></div></DetailCard>

          <DetailCard className="pd-description-card"><h2>Description</h2><p>Double-faced cashmere overcoat with a notch lapel and concealed button closure. Fully lined with cupro silk and crafted from {descriptionOpen ? 'responsibly sourced Mongolian cashmere, finished with hand-stitched edges and a softly structured shoulder for enduring warmth and a refined silhouette.' : '…'}</p><button className="admin-text-link" type="button" aria-expanded={descriptionOpen} onClick={() => setDescriptionOpen((open) => !open)}>{descriptionOpen ? 'Show less ⌃' : 'Show more ⌄'}</button></DetailCard>

          <DetailCard className="pd-specs-card"><button className="pd-accordion-trigger" type="button" aria-expanded={specsOpen} onClick={() => setSpecsOpen((open) => !open)}><h2>Garment Specifications</h2><AdminIcon name="chevron" size={15} /></button>{specsOpen && <dl className="pd-spec-list"><div><dt>Fabric composition</dt><dd>100% Grade-A Mongolian cashmere</dd></div><div><dt>Care instructions</dt><dd>Professional dry clean only</dd></div><div><dt>Fit notes</dt><dd>Relaxed tailored fit · true to size</dd></div><div><dt>Country of origin</dt><dd>Made in Italy</dd></div><div><dt>Weight</dt><dd>1.25 kg</dd></div></dl>}</DetailCard>
        </aside>
      </div>
      {notice && <div className="admin-toast" role="status">{notice}</div>}
    </div>
  );
}