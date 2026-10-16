import { useMemo, useState } from 'react';
import { PRODUCT_DATA } from '../../data/products';
import { AdminIcon } from '../../components/admin/AdminLayout';
import './admin-inventory.css';

const initialInventory = [
  {
    id: 'inv-1',
    name: 'Cashmere Overcoat',
    category: 'Outerwear',
    sku: 'NS-OC-0142',
    image: PRODUCT_DATA[1].primaryImage,
    stock: 84,
    reorder: 10,
    updated: '2 days ago',
    date: 'Sep 29, 2026',
    status: 'In stock',
    hasVariants: true,
    expanded: true,
    variants: [
      { id: 'inv-1-cml-s', name: 'Camel / S', sku: 'NS-OC-0142-CML-S', stock: 14, reorder: 10, updated: '2 days ago', date: 'Sep 29, 2026', status: 'In stock' },
      { id: 'inv-1-cml-m', name: 'Camel / M', sku: 'NS-OC-0142-CML-M', stock: 18, reorder: 10, updated: '2 days ago', date: 'Sep 29, 2026', status: 'In stock' },
      { id: 'inv-1-cml-l', name: 'Camel / L', sku: 'NS-OC-0142-CML-L', stock: 12, reorder: 10, updated: '2 days ago', date: 'Sep 29, 2026', status: 'In stock' },
      { id: 'inv-1-blk-s', name: 'Black / S', sku: 'NS-OC-0142-BLK-S', stock: 16, reorder: 10, updated: '3 days ago', date: 'Sep 28, 2026', status: 'In stock' },
    ],
  },
  {
    id: 'inv-2',
    name: 'Silk Slip Dress',
    category: 'Dresses',
    sku: 'NS-DR-0087',
    image: PRODUCT_DATA[6].primaryImage,
    stock: 12,
    reorder: 15,
    updated: '5 days ago',
    date: 'Sep 26, 2026',
    status: 'Low stock',
  },
  {
    id: 'inv-3',
    name: 'Leather Tote Bag',
    category: 'Accessories',
    sku: 'NS-BG-0061',
    image: PRODUCT_DATA[3].primaryImage,
    stock: 0,
    reorder: 5,
    updated: '1 week ago',
    date: 'Sep 22, 2026',
    status: 'Out of stock',
  },
  {
    id: 'inv-4',
    name: 'Merino Wool Sweater',
    category: 'Knitwear',
    sku: 'NS-KN-0124',
    image: PRODUCT_DATA[7].primaryImage,
    stock: 210,
    reorder: 20,
    updated: '3 days ago',
    date: 'Sep 28, 2026',
    status: 'In stock',
  },
  {
    id: 'inv-5',
    name: 'Tailored Wool Trousers',
    category: 'Trousers',
    sku: 'NS-TR-0208',
    image: PRODUCT_DATA[4].primaryImage,
    stock: 63,
    reorder: 10,
    updated: '2 weeks ago',
    date: 'Sep 20, 2026',
    status: 'In stock',
  },
  {
    id: 'inv-6',
    name: 'Suede Chelsea Boots',
    category: 'Footwear',
    sku: 'NS-FT-0094',
    image: PRODUCT_DATA[5].primaryImage,
    stock: 9,
    reorder: 10,
    updated: '1 day ago',
    date: 'Sep 30, 2026',
    status: 'Low stock',
  },
  {
    id: 'inv-7',
    name: 'Silk Scarf',
    category: 'Accessories',
    sku: 'NS-SC-0039',
    image: PRODUCT_DATA[10].primaryImage,
    stock: 150,
    reorder: 20,
    updated: '1 week ago',
    date: 'Sep 22, 2026',
    status: 'In stock',
  },
  {
    id: 'inv-8',
    name: 'Ribbed Mockneck Knit',
    category: 'Knitwear',
    sku: 'NS-KN-0108',
    image: PRODUCT_DATA[2].primaryImage,
    stock: 8,
    reorder: 12,
    updated: '4 days ago',
    date: 'Sep 27, 2026',
    status: 'Low stock',
  },
  {
    id: 'inv-9',
    name: 'Linen Trench Coat',
    category: 'Outerwear',
    sku: 'NS-OC-0183',
    image: PRODUCT_DATA[1].primaryImage,
    stock: 41,
    reorder: 10,
    updated: '6 days ago',
    date: 'Sep 25, 2026',
    status: 'In stock',
  },
  {
    id: 'inv-10',
    name: 'Structured Leather Belt',
    category: 'Accessories',
    sku: 'NS-AC-0017',
    image: PRODUCT_DATA[3].primaryImage,
    stock: 0,
    reorder: 5,
    updated: '3 days ago',
    date: 'Sep 28, 2026',
    status: 'Out of stock',
  },
];

const statusClass = (status) => {
  if (status === 'Out of stock') return 'out';
  if (status === 'Low stock') return 'low';
  return 'in';
};

function InventoryStatus({ status }) {
  return (
    <span className={`inventory-status-pill ${statusClass(status)}`}>
      <i />
      {status}
    </span>
  );
}

function StockValue({ stock, status }) {
  if (status === 'Out of stock') {
    return (
      <span className="inventory-stock-value out">
        <i />
        0
      </span>
    );
  }

  if (status === 'Low stock') {
    return (
      <span className="inventory-stock-value low">
        <i />
        {stock}
      </span>
    );
  }

  return <span className="inventory-stock-value healthy">{stock}</span>;
}

export default function AdminInventoryPage({ go }) {
  const [inventory, setInventory] = useState(initialInventory);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All categories');
  const [collection, setCollection] = useState('All collections');
  const [stockFilter, setStockFilter] = useState('All Stock');
  const [expandedIds, setExpandedIds] = useState(['inv-1']);
  const [selectedIds, setSelectedIds] = useState([
    'inv-1',
    'inv-2',
    'inv-3',
  ]);
  const [openMenu, setOpenMenu] = useState(null);
  const [pageSize, setPageSize] = useState('10');
  const [notice, setNotice] = useState('');

  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2300);
  };

  const categories = useMemo(
    () => [...new Set(inventory.map((item) => item.category))],
    [inventory],
  );

  const filteredInventory = useMemo(() => {
    const query = search.trim().toLowerCase();

    return inventory.filter((item) => {
      const matchesSearch =
        !query ||
        `${item.name} ${item.sku} ${item.category}`
          .toLowerCase()
          .includes(query);

      const matchesCategory =
        category === 'All categories' || item.category === category;

      const matchesStock =
        stockFilter === 'All Stock' ||
        (stockFilter === 'Low Stock' && item.status === 'Low stock') ||
        (stockFilter === 'Out of Stock' && item.status === 'Out of stock');

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [inventory, search, category, stockFilter]);

  const visibleRows = useMemo(() => {
    const rows = [];

    filteredInventory.forEach((product) => {
      rows.push({
        ...product,
        rowType: 'parent',
      });

      if (product.hasVariants && expandedIds.includes(product.id)) {
        product.variants.forEach((variant) => {
          rows.push({
            ...variant,
            parentId: product.id,
            category: product.category,
            image: product.image,
            rowType: 'variant',
          });
        });
      }
    });

    return rows;
  }, [expandedIds, filteredInventory]);

  const allVisibleSelected =
    filteredInventory.length > 0 &&
    filteredInventory.every((product) => selectedIds.includes(product.id));

  const toggleSelected = (id) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  };

  const toggleVisible = () => {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter(
            (id) => !filteredInventory.some((product) => product.id === id),
          )
        : [
            ...new Set([
              ...current,
              ...filteredInventory.map((product) => product.id),
            ]),
          ],
    );
  };

  const toggleExpanded = (id) => {
    setExpandedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const exportInventory = () => {
    const rows = [
      [
        'Product',
        'SKU',
        'Category',
        'In stock',
        'Reorder level',
        'Last updated',
        'Status',
      ],
      ...filteredInventory.map((item) => [
        item.name,
        item.sku,
        item.category,
        item.stock,
        item.reorder,
        item.date,
        item.status,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(','),
      )
      .join('\n');

    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    );

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'novashop-inventory.csv';
    anchor.click();

    URL.revokeObjectURL(url);
    notify('Inventory exported.');
  };

  const updateSelectedStock = (amount) => {
    setInventory((current) =>
      current.map((item) => {
        if (!selectedIds.includes(item.id)) return item;

        const nextStock = Math.max(0, item.stock + amount);
        const nextStatus =
          nextStock === 0
            ? 'Out of stock'
            : nextStock <= item.reorder
              ? 'Low stock'
              : 'In stock';

        return {
          ...item,
          stock: nextStock,
          status: nextStatus,
          updated: 'Just now',
          date: 'Oct 4, 2026',
        };
      }),
    );

    notify(
      amount > 0
        ? 'Stock increased for selected products.'
        : 'Stock decreased for selected products.',
    );
  };

  const setReorderLevel = () => {
    setInventory((current) =>
      current.map((item) =>
        selectedIds.includes(item.id)
          ? { ...item, reorder: Math.max(1, item.reorder + 5) }
          : item,
      ),
    );

    notify('Reorder level increased by 5 units.');
  };

  const runRowAction = (action, item) => {
    setOpenMenu(null);

    if (action === 'Adjust stock') {
      setSelectedIds([item.id]);
      notify(`Adjust stock selected for ${item.name}.`);
    } else if (action === 'Set reorder level') {
      setInventory((current) =>
        current.map((product) =>
          product.id === item.id
            ? { ...product, reorder: product.reorder + 5 }
            : product,
        ),
      );
      notify(`Reorder level updated for ${item.name}.`);
    } else if (action === 'View history') {
      notify(`Inventory history opened for ${item.name}.`);
    } else if (action === 'View product') {
      if (go) go('/admin/products');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setCategory('All categories');
    setCollection('All collections');
    setStockFilter('All Stock');
  };

  return (
    <div className="admin-dashboard inventory-page">
      <section className="admin-page-heading inventory-page-heading">
        <div>
          <h1 className="admin-page-title">Inventory</h1>
          <p className="admin-page-description">
            Track stock levels and inventory changes across your catalog.
          </p>
        </div>

        <div className="admin-page-actions">
          <button
            className="admin-action-button"
            type="button"
            onClick={exportInventory}
          >
            <AdminIcon name="download" size={15} />
            Export
          </button>

          <button
            className="admin-action-button is-primary"
            type="button"
            onClick={() => notify('Stock adjustment opened.')}
          >
            <AdminIcon name="sliders" size={15} />
            Adjust Stock
          </button>
        </div>
      </section>

      <div className="inventory-kpi-label">LAST 30 DAYS</div>

      <section className="admin-stat-grid inventory-stat-grid">
        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Total units</span>
            <span className="admin-trend-pill">+640 this month</span>
          </div>
          <div className="admin-stat-value">18,420</div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Inventory value</span>
            <span className="admin-trend-pill">+3.2%</span>
          </div>
          <div className="admin-stat-value">$2,184,300</div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Low stock</span>
            <span className="inventory-warning-pill">+5 this week</span>
          </div>
          <div className="admin-stat-value">37</div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Out of stock</span>
            <span className="inventory-danger-pill">+2 this week</span>
          </div>
          <div className="admin-stat-value">9</div>
        </article>
      </section>

      <section className="inventory-catalog-toolbar">
        <div className="inventory-filter-row">
          <label className="products-search-field inventory-search-field">
            <AdminIcon name="search" size={16} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by product name or SKU"
              aria-label="Search by product name or SKU"
            />
          </label>

          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Filter by category"
          >
            <option>All categories</option>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>

          <select
            value={collection}
            onChange={(event) => setCollection(event.target.value)}
            aria-label="Filter by collection"
          >
            <option>All collections</option>
            <option>Winter 2026</option>
            <option>Evening Edit</option>
            <option>Icons</option>
            <option>Core Collection</option>
            <option>Autumn 2026</option>
            <option>Essentials</option>
            <option>Spring 2026</option>
          </select>
        </div>

        <div className="inventory-quick-row">
          <div
            className="inventory-quick-filters"
            role="group"
            aria-label="Inventory filters"
          >
            <button
              type="button"
              className={`inventory-quick-filter${
                stockFilter === 'All Stock' ? ' is-active' : ''
              }`}
              onClick={() => setStockFilter('All Stock')}
              aria-pressed={stockFilter === 'All Stock'}
            >
              All Stock
              <span>1,248</span>
            </button>

            <button
              type="button"
              className={`inventory-quick-filter${
                stockFilter === 'Low Stock' ? ' is-active' : ''
              }`}
              onClick={() => setStockFilter('Low Stock')}
              aria-pressed={stockFilter === 'Low Stock'}
            >
              <i className="low" />
              Low Stock
              <span>37</span>
            </button>

            <button
              type="button"
              className={`inventory-quick-filter${
                stockFilter === 'Out of Stock' ? ' is-active' : ''
              }`}
              onClick={() => setStockFilter('Out of Stock')}
              aria-pressed={stockFilter === 'Out of Stock'}
            >
              <i className="out" />
              Out of Stock
              <span>9</span>
            </button>
          </div>

          <button
            className="inventory-history-link"
            type="button"
            onClick={() => notify('Stock history ledger selected.')}
          >
            Stock History
          </button>
        </div>
      </section>

      <section className="inventory-table-card" aria-label="Inventory">
        <div className="inventory-table-scroll">
          <table className="inventory-table">
            <thead>
              <tr>
                <th className="inventory-checkbox-cell">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleVisible}
                    aria-label="Select all visible inventory"
                  />
                </th>

                <th>PRODUCT</th>
                <th>IN STOCK</th>
                <th>REORDER LEVEL</th>
                <th>LAST UPDATED</th>
                <th>STATUS</th>
                <th className="inventory-actions-heading">ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {visibleRows.map((item) => {
                const isVariant = item.rowType === 'variant';
                const isExpanded =
                  !isVariant && expandedIds.includes(item.id);

                return (
                  <tr
                    key={item.id}
                    className={isVariant ? 'is-variant' : 'is-parent'}
                  >
                    <td className="inventory-checkbox-cell">
                      {!isVariant ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleSelected(item.id)}
                          aria-label={`Select ${item.name}`}
                        />
                      ) : (
                        <span />
                      )}
                    </td>

                    <td className="inventory-product-cell">
                      <div
                        className={`inventory-product-content${
                          isVariant ? ' is-nested' : ''
                        }`}
                      >
                        {isVariant ? (
                          <span className="inventory-tree-line" />
                        ) : item.hasVariants ? (
                          <button
                            type="button"
                            className={`inventory-expand-button${
                              isExpanded ? ' is-expanded' : ''
                            }`}
                            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${
                              item.name
                            }`}
                            aria-expanded={isExpanded}
                            onClick={() => toggleExpanded(item.id)}
                          >
                            <AdminIcon name="chevron" size={13} />
                          </button>
                        ) : (
                          <span className="inventory-tree-spacer" />
                        )}

                        <img src={item.image} alt="" />

                        <div className="inventory-product-copy">
                          <strong>{item.name}</strong>

                          {isVariant ? (
                            <span className="inventory-variant-sku">
                              {item.sku}
                            </span>
                          ) : (
                            <span>{item.category}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td>
                      <StockValue
                        stock={item.stock}
                        status={item.status}
                      />
                    </td>

                    <td>
                      <span className="inventory-reorder">
                        Alert at {item.reorder}
                      </span>
                    </td>

                    <td>
                      <div className="inventory-updated-cell">
                        <strong>{item.updated}</strong>
                        <span>{item.date}</span>
                      </div>
                    </td>

                    <td>
                      <InventoryStatus status={item.status} />
                    </td>

                    <td className="inventory-actions-cell">
                      <div className="inventory-row-menu-anchor">
                        <button
                          className="products-row-menu-button"
                          type="button"
                          aria-label={`More actions for ${item.name}`}
                          aria-expanded={openMenu === item.id}
                          onClick={() =>
                            setOpenMenu((current) =>
                              current === item.id ? null : item.id,
                            )
                          }
                        >
                          <AdminIcon name="more" size={16} />
                        </button>

                        {openMenu === item.id && (
                          <div className="products-row-menu inventory-row-menu">
                            {[
                              'Adjust stock',
                              'Set reorder level',
                              'View history',
                              'View product',
                            ].map((action) => (
                              <button
                                key={action}
                                type="button"
                                onClick={() => runRowAction(action, item)}
                              >
                                {action}

                                {action === 'View product' && (
                                  <AdminIcon
                                    name="external"
                                    size={11}
                                  />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan="7" className="inventory-empty-state">
                    <AdminIcon name="searchSlash" size={20} />
                    <strong>No inventory matches these filters.</strong>
                    <button type="button" onClick={clearFilters}>
                      Reset filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="inventory-pagination">
          <span>
            Showing 1–10 of 1,248 products
          </span>

          <div className="inventory-pagination-controls">
            <label>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(event.target.value)}
                aria-label="Inventory per page"
              >
                <option value="10">10 per page</option>
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
              </select>
              <AdminIcon name="chevron" size={12} />
            </label>

            <button type="button" disabled>
              Previous
            </button>

            <button type="button" className="is-active">
              1
            </button>

            <button type="button">2</button>
            <button type="button">3</button>
            <span>…</span>
            <button type="button">125</button>

            <button type="button">Next</button>
          </div>
        </div>
      </section>

      {selectedIds.length > 0 && (
        <div className="inventory-bulk-bar">
          <strong>{selectedIds.length} selected</strong>

          <button
            type="button"
            onClick={() => updateSelectedStock(1)}
          >
            <AdminIcon name="sliders" size={14} />
            Adjust stock
          </button>

          <button
            type="button"
            onClick={setReorderLevel}
          >
            <AdminIcon name="bell" size={14} />
            Set reorder level
          </button>

          <button
            type="button"
            onClick={exportInventory}
          >
            <AdminIcon name="download" size={14} />
            Export
          </button>

          <button
            className="inventory-bulk-clear"
            type="button"
            aria-label="Clear selection"
            onClick={() => setSelectedIds([])}
          >
            <AdminIcon name="close" size={16} />
          </button>
        </div>
      )}

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}