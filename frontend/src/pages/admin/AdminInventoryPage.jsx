import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminApi } from '../../lib/api/adminApi';
import { AdminIcon } from '../../components/admin/AdminLayout';
import AdminCustomSelect from '../../components/admin/AdminCustomSelect';
import AdminAdjustStockModal from '../../components/admin/AdminAdjustStockModal';
import AdminReorderLevelModal from '../../components/admin/AdminReorderLevelModal';
import AdminStockHistoryModal from '../../components/admin/AdminStockHistoryModal';
import AdminRowActionMenu from '../../components/admin/AdminRowActionMenu';
import './admin-inventory.css';

const statusClass = (status) => {
  if (status === 'Out of stock') return 'out';
  if (status === 'Low stock' || status === 'Critical') return 'low';
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

  if (status === 'Low stock' || status === 'Critical') {
    return (
      <span className="inventory-stock-value low">
        <i />
        {stock}
      </span>
    );
  }

  return <span className="inventory-stock-value healthy">{stock}</span>;
}

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
};

const formatRelative = (value) => {
  if (!value) return 'Recently';
  const diffMs = Date.now() - new Date(value).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
};

export default function AdminInventoryPage({ go }) {
  const [inventory, setInventory] = useState([]);
  const [backendCategories, setBackendCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All categories');
  const [stockFilter, setStockFilter] = useState('All Stock');
  const [expandedIds, setExpandedIds] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [pageSize, setPageSize] = useState('10');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');

  const [globalThreshold, setGlobalThreshold] = useState(5);
  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [historyModal, setHistoryModal] = useState(null);
  const [historyMovements, setHistoryMovements] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [reorderItem, setReorderItem] = useState(null);
  const [reorderModalOpen, setReorderModalOpen] = useState(false);

  // Portal row menu target state
  const [menuTarget, setMenuTarget] = useState(null);
  const triggerRefs = useRef({});

  const notify = (message) => {
    setNotice(message);
    window.clearTimeout(window.__novaInventoryToast);
    window.__novaInventoryToast = window.setTimeout(() => setNotice(''), 2500);
  };

  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const [inventoryRes, productsRes, settingsRes, categoriesRes] = await Promise.all([
        adminApi.getInventory({ limit: 100 }).catch((err) => {
          console.warn('Inventory fetch notice:', err?.message);
          return null;
        }),
        adminApi.getProducts({ page: 1, limit: 100, status: 'all' }).catch((err) => {
          console.warn('Products fetch notice:', err?.message);
          return null;
        }),
        adminApi.getInventorySettings().catch(() => null),
        adminApi.getCategories().catch(() => null),
      ]);

      if (categoriesRes && Array.isArray(categoriesRes.data?.data || categoriesRes.data)) {
        const catList = categoriesRes.data?.data || categoriesRes.data;
        setBackendCategories(catList.map((c) => c.name).filter(Boolean));
      }

      if (!inventoryRes && !productsRes) {
        setLoadError('Unable to load catalog inventory from server.');
        setInventory([]);
        return;
      }

      const threshold =
        settingsRes?.data?.lowStockThreshold ??
        settingsRes?.lowStockThreshold ??
        inventoryRes?.stats?.globalThreshold ??
        5;
      setGlobalThreshold(threshold);

      // Raw variants from inventory endpoint
      const rawVariants = Array.isArray(inventoryRes?.data)
        ? inventoryRes.data
        : Array.isArray(inventoryRes?.inventory)
        ? inventoryRes.inventory
        : Array.isArray(inventoryRes)
        ? inventoryRes
        : [];

      // Raw products from products endpoint
      const rawProducts = Array.isArray(productsRes?.data)
        ? productsRes.data
        : Array.isArray(productsRes?.data?.products)
        ? productsRes.data.products
        : Array.isArray(productsRes?.products)
        ? productsRes.products
        : Array.isArray(productsRes)
        ? productsRes
        : [];

      const productMap = new Map();

      // 1. Initialize product map from products list
      for (const prod of rawProducts) {
        const prodId = String(prod._id || prod.id);
        const prodVariants = Array.isArray(prod.variants) ? prod.variants : [];
        const prodStock = Number(prod.countInStock) || 0;
        const catName = prod.category?.name || prod.category || 'Uncategorized';
        const prodImg =
          prod.images?.[0] ||
          prod.image ||
          '/placeholder.png';

        productMap.set(prodId, {
          id: prodId,
          productId: prodId,
          name: prod.name,
          category: catName,
          sku: prod.slug || '—',
          image: prodImg,
          stock: prodStock,
          reorder: threshold,
          updated: formatRelative(prod.updatedAt),
          date: formatDate(prod.updatedAt || prod.createdAt),
          status:
            prodStock <= 0
              ? 'Out of stock'
              : prodStock <= threshold
              ? 'Low stock'
              : 'In stock',
          hasVariants: prodVariants.length > 0,
          variants: [],
          price: prod.price || 0,
        });

        for (const v of prodVariants) {
          const vStock = Number(v.stock) || 0;
          const vReserved = Number(v.reserved) || 0;
          const vAvail = Math.max(0, vStock - vReserved);
          const vThresh = Number(v.lowStockThreshold) || threshold;
          const colorName =
            typeof v.color === 'string'
              ? v.color
              : v.color?.name || 'Standard';

          productMap.get(prodId).variants.push({
            id: String(v._id || v.id || `${prodId}-${v.sku}`),
            variantId: String(v._id || v.id),
            productId: prodId,
            name: `${colorName} / ${v.size || 'OS'}`,
            sku: v.sku || 'N/A',
            stock: vStock,
            reserved: vReserved,
            available: vAvail,
            reorder: vThresh,
            updated: formatRelative(prod.updatedAt),
            date: formatDate(prod.updatedAt || prod.createdAt),
            status:
              vStock <= 0
                ? 'Out of stock'
                : vAvail <= vThresh
                ? 'Low stock'
                : 'In stock',
          });
        }
      }

      // 2. Add or enrich from rawVariants (from getAdminInventoryList)
      for (const v of rawVariants) {
        const prodId = String(
          v.product?._id ||
          v.product?.id ||
          v.product ||
          'general'
        );
        const prodName = v.product?.name || 'Catalog Item';
        const prodCategory =
          v.product?.category?.name ||
          v.product?.category ||
          'Uncategorized';
        const prodImg =
          v.product?.image ||
          (v.product?.images && v.product?.images[0]) ||
          '/placeholder.png';
        const prodSlug = v.product?.slug || v.sku || '—';

        if (!productMap.has(prodId)) {
          productMap.set(prodId, {
            id: prodId,
            productId: prodId,
            name: prodName,
            category: prodCategory,
            sku: prodSlug,
            image: prodImg,
            stock: 0,
            reorder: threshold,
            updated: formatRelative(v.updatedAt),
            date: formatDate(v.updatedAt),
            status: 'In stock',
            hasVariants: true,
            variants: [],
            price: v.price || 0,
          });
        }

        const parent = productMap.get(prodId);
        const colorName =
          typeof v.color === 'string'
            ? v.color
            : v.color?.name || 'Standard';
        const vDisplayName = `${colorName} / ${v.size || 'OS'}`;
        const vId = String(v.id || v._id);

        const existingVarIdx = parent.variants.findIndex(
          (item) => item.id === vId || (item.sku && item.sku === v.sku)
        );

        const vStock = Number(v.stock) || 0;
        const vReserved = Number(v.reserved) || 0;
        const vAvail =
          v.available !== undefined
            ? Number(v.available)
            : Math.max(0, vStock - vReserved);
        const vThresh =
          Number(v.effectiveThreshold || v.lowStockThreshold) || threshold;

        const variantObj = {
          id: vId,
          variantId: vId,
          productId: prodId,
          name: vDisplayName,
          sku: v.sku || 'N/A',
          stock: vStock,
          reserved: vReserved,
          available: vAvail,
          reorder: vThresh,
          updated: formatRelative(v.updatedAt),
          date: formatDate(v.updatedAt),
          status:
            vStock <= 0
              ? 'Out of stock'
              : vAvail <= vThresh
              ? 'Low stock'
              : 'In stock',
        };

        if (existingVarIdx >= 0) {
          parent.variants[existingVarIdx] = variantObj;
        } else {
          parent.variants.push(variantObj);
        }
      }

      // 3. Compute parent totals & statuses
      const mapped = Array.from(productMap.values()).map((prod) => {
        if (prod.variants.length > 0) {
          prod.hasVariants = true;
          prod.stock = prod.variants.reduce((sum, v) => sum + v.stock, 0);
          if (prod.stock <= 0) {
            prod.status = 'Out of stock';
          } else if (
            prod.variants.some(
              (v) => v.status === 'Low stock' || v.status === 'Critical'
            )
          ) {
            prod.status = 'Low stock';
          } else {
            prod.status = 'In stock';
          }
        }
        return prod;
      });

      setInventory(mapped);
      if (mapped.length > 0) {
        setExpandedIds((current) =>
          current.length > 0 ? current : [mapped[0].id]
        );
      }
      setLoadError('');
    } catch (err) {
      setLoadError(
        err?.response?.data?.message ||
          err.message ||
          'Unable to load catalog inventory.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // Merge categories from inventory and backend API
  const categories = useMemo(() => {
    const fromInv = inventory.map((item) => item.category).filter(Boolean);
    const combined = new Set([...fromInv, ...backendCategories]);
    return [...combined].sort();
  }, [inventory, backendCategories]);

  const stats = useMemo(() => {
    const totalUnits = inventory.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
    const totalValue = inventory.reduce((sum, p) => sum + (Number(p.stock) || 0) * (Number(p.price) || 0), 0);
    const lowStockCount = inventory.filter((p) => p.status === 'Low stock' || p.status === 'Critical').length;
    const outOfStockCount = inventory.filter((p) => p.status === 'Out of stock').length;

    return {
      totalUnits,
      totalValue,
      lowStockCount,
      outOfStockCount,
    };
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    const query = search.trim().toLowerCase();

    return inventory.filter((item) => {
      const matchesSearch =
        !query ||
        `${item.name} ${item.sku} ${item.category}`
          .toLowerCase()
          .includes(query) ||
        (item.variants &&
          item.variants.some((v) =>
            `${v.name} ${v.sku}`.toLowerCase().includes(query)
          ));

      const matchesCategory =
        category === 'All categories' || item.category === category;

      const matchesStock =
        stockFilter === 'All Stock' ||
        (stockFilter === 'Low Stock' &&
          (item.status === 'Low stock' || item.status === 'Critical')) ||
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
        : [...current, id]
    );
  };

  const toggleVisible = () => {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter(
            (id) => !filteredInventory.some((product) => product.id === id)
          )
        : [
            ...new Set([
              ...current,
              ...filteredInventory.map((product) => product.id),
            ]),
          ]
    );
  };

  const toggleExpanded = (id) => {
    setExpandedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
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
      ...filteredInventory.flatMap((item) => {
        const parentRow = [
          item.name,
          item.sku,
          item.category,
          item.stock,
          item.reorder,
          item.date,
          item.status,
        ];
        const variantRows = (item.variants || []).map((v) => [
          `  ${item.name} (${v.name})`,
          v.sku,
          item.category,
          v.stock,
          v.reorder,
          v.date,
          v.status,
        ]);
        return [parentRow, ...variantRows];
      }),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(',')
      )
      .join('\n');

    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    );

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'novashop-inventory.csv';
    anchor.click();

    URL.revokeObjectURL(url);
    notify('Inventory exported.');
  };

  const handleAdjustSave = async ({ variantId, mode, value, reason }) => {
    await adminApi.adjustInventoryStock({
      variantId,
      mode,
      value,
      reason,
    });
    notify('Stock adjustment saved.');
    await loadInventory();
  };

  const handleReorderSave = async (newThreshold, targetItem) => {
    const targetVariantId =
      targetItem?.variantId ||
      targetItem?.variants?.[0]?.variantId ||
      (targetItem?.rowType === 'variant' ? targetItem.id : null);

    if (targetVariantId) {
      await adminApi.updateVariantThreshold(targetVariantId, newThreshold);
      notify(`Reorder level updated to ${newThreshold} units.`);
    } else {
      await adminApi.updateInventorySettings({
        lowStockThreshold: newThreshold,
      });
      setGlobalThreshold(newThreshold);
      notify(`Catalog low-stock threshold updated to ${newThreshold} units.`);
    }
    await loadInventory();
  };

  const openHistory = async (item) => {
    const targetVariantId =
      item?.variantId ||
      item?.variants?.[0]?.variantId ||
      (item?.rowType === 'variant' ? item.id : null);

    setHistoryModal(item || null);
    setHistoryLoading(true);
    try {
      const res = await adminApi.getInventoryMovements({
        variantId: targetVariantId || undefined,
        limit: 50,
      });
      const data = res?.data?.data || res?.data || [];
      setHistoryMovements(Array.isArray(data) ? data : []);
    } catch (err) {
      notify('Unable to load movement history.');
      setHistoryMovements([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setCategory('All categories');
    setStockFilter('All Stock');
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / Number(pageSize)));

  useEffect(() => {
    setPage(1);
  }, [search, category, stockFilter, pageSize]);

  useEffect(() => {
    if (page > totalPages && totalPages >= 1) {
      setPage(1);
    }
  }, [page, totalPages]);

  const paginatedVisibleRows = useMemo(() => {
    const pSize = Number(pageSize);
    return visibleRows.slice((page - 1) * pSize, page * pSize);
  }, [page, pageSize, visibleRows]);

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
            onClick={() => {
              const target =
                selectedIds.length > 0
                  ? inventory.find((i) => selectedIds.includes(i.id))
                  : null;
              setAdjustItem(target);
              setAdjustModalOpen(true);
            }}
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
            <span className="admin-trend-pill">Catalog total</span>
          </div>
          <div className="admin-stat-value">
            {stats.totalUnits.toLocaleString('en-US')}
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Inventory value</span>
            <span className="admin-trend-pill">Asset value</span>
          </div>
          <div className="admin-stat-value">
            ${stats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Low stock</span>
            <span className="inventory-warning-pill">
              ≤ {globalThreshold} units
            </span>
          </div>
          <div className="admin-stat-value">{stats.lowStockCount}</div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Out of stock</span>
            <span className="inventory-danger-pill">0 units</span>
          </div>
          <div className="admin-stat-value">{stats.outOfStockCount}</div>
        </article>
      </section>

      {loading && (
        <p className="inventory-empty-state" role="status">
          Loading catalog inventory…
        </p>
      )}
      {loadError && (
        <p className="inventory-empty-state" role="alert">
          {loadError}{' '}
          <button type="button" onClick={loadInventory}>
            Retry
          </button>
        </p>
      )}

      <section className="inventory-catalog-toolbar">
        <div className="inventory-filter-row" style={{ gridTemplateColumns: 'minmax(240px, 1fr) minmax(180px, 260px)' }}>
          <label className="products-search-field inventory-search-field">
            <AdminIcon name="search" size={16} />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by product name or SKU"
              aria-label="Search by product name or SKU"
            />
          </label>

          <AdminCustomSelect
            value={category}
            onChange={(val) => {
              setCategory(val);
              setPage(1);
            }}
            options={['All categories', ...categories]}
            ariaLabel="Filter by category"
            placeholder="All categories"
          />
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
              onClick={() => {
                setStockFilter('All Stock');
                setPage(1);
              }}
              aria-pressed={stockFilter === 'All Stock'}
            >
              All Stock
              <span>{inventory.length}</span>
            </button>

            <button
              type="button"
              className={`inventory-quick-filter${
                stockFilter === 'Low Stock' ? ' is-active' : ''
              }`}
              onClick={() => {
                setStockFilter('Low Stock');
                setPage(1);
              }}
              aria-pressed={stockFilter === 'Low Stock'}
            >
              <i className="low" />
              Low Stock
              <span>{stats.lowStockCount}</span>
            </button>

            <button
              type="button"
              className={`inventory-quick-filter${
                stockFilter === 'Out of Stock' ? ' is-active' : ''
              }`}
              onClick={() => {
                setStockFilter('Out of Stock');
                setPage(1);
              }}
              aria-pressed={stockFilter === 'Out of Stock'}
            >
              <i className="out" />
              Out of Stock
              <span>{stats.outOfStockCount}</span>
            </button>
          </div>

          <button
            className="inventory-history-link"
            type="button"
            onClick={() => openHistory(null)}
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
              {paginatedVisibleRows.map((item) => {
                const isVariant = item.rowType === 'variant';
                const isExpanded = !isVariant && expandedIds.includes(item.id);

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
                            aria-label={`${
                              isExpanded ? 'Collapse' : 'Expand'
                            } ${item.name}`}
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
                          ref={(el) => (triggerRefs.current[item.id] = el)}
                          className="products-row-menu-button"
                          type="button"
                          aria-label={`More actions for ${item.name}`}
                          aria-expanded={menuTarget?.item?.id === item.id}
                          onClick={() => {
                            setMenuTarget(
                              menuTarget?.item?.id === item.id
                                ? null
                                : {
                                    item,
                                    triggerRef: { current: triggerRefs.current[item.id] },
                                  }
                            );
                          }}
                        >
                          <AdminIcon name="more" size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedVisibleRows.length === 0 && !loading && (
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
            Showing{' '}
            {visibleRows.length === 0
              ? 0
              : (page - 1) * Number(pageSize) + 1}
            –
            {Math.min(page * Number(pageSize), visibleRows.length)} of{' '}
            {visibleRows.length} items
          </span>

          <div className="inventory-pagination-controls">
            <label>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(event.target.value);
                  setPage(1);
                }}
                aria-label="Inventory per page"
              >
                <option value="10">10 per page</option>
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
              </select>
              <AdminIcon name="chevron" size={12} />
            </label>

            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((c) => Math.max(1, c - 1))}
            >
              Previous
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(
              (pNum) => (
                <button
                  type="button"
                  key={pNum}
                  className={page === pNum ? 'is-active' : ''}
                  onClick={() => setPage(pNum)}
                >
                  {pNum}
                </button>
              )
            )}
            {totalPages > 5 && <span>…</span>}
            {totalPages > 5 && (
              <button
                type="button"
                className={page === totalPages ? 'is-active' : ''}
                onClick={() => setPage(totalPages)}
              >
                {totalPages}
              </button>
            )}

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((c) => Math.min(totalPages, c + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {selectedIds.length > 0 && (
        <div className="inventory-bulk-bar">
          <strong>{selectedIds.length} selected</strong>

          <button
            type="button"
            onClick={() => {
              const target = inventory.find((i) => selectedIds.includes(i.id));
              setAdjustItem(target || null);
              setAdjustModalOpen(true);
            }}
          >
            <AdminIcon name="sliders" size={14} />
            Adjust stock
          </button>

          <button
            type="button"
            onClick={() => {
              setReorderItem(null);
              setReorderModalOpen(true);
            }}
          >
            <AdminIcon name="bell" size={14} />
            Set reorder level
          </button>

          <button type="button" onClick={exportInventory}>
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

      {/* Portal Row Action Menu */}
      <AdminRowActionMenu
        isOpen={Boolean(menuTarget)}
        onClose={() => setMenuTarget(null)}
        triggerRef={menuTarget?.triggerRef}
        header={{
          title: menuTarget?.item?.name,
          subtitle: `SKU: ${menuTarget?.item?.sku || '—'} · Stock: ${menuTarget?.item?.stock ?? 0}`,
        }}
        items={[
          {
            id: 'adjust',
            label: 'Adjust stock',
            icon: 'sliders',
            onClick: () => {
              setAdjustItem(menuTarget.item);
              setAdjustModalOpen(true);
            },
          },
          {
            id: 'reorder',
            label: 'Set reorder level',
            icon: 'alert',
            onClick: () => {
              setReorderItem(menuTarget.item);
              setReorderModalOpen(true);
            },
          },
          {
            id: 'history',
            label: 'View stock history',
            icon: 'receipt',
            onClick: () => {
              openHistory(menuTarget.item);
            },
          },
          {
            id: 'divider',
            isDivider: true,
          },
          {
            id: 'product',
            label: 'View in catalog',
            icon: 'external',
            onClick: () => {
              if (go && (menuTarget?.item?.productId || menuTarget?.item?.id)) {
                go(`/admin/products/${menuTarget.item.productId || menuTarget.item.id}`);
              }
            },
          },
        ]}
      />

      {/* Adjust Stock Modal */}
      <AdminAdjustStockModal
        item={adjustItem}
        catalog={inventory}
        globalThreshold={globalThreshold}
        isOpen={adjustModalOpen}
        onClose={() => {
          setAdjustModalOpen(false);
          setAdjustItem(null);
        }}
        onSave={handleAdjustSave}
      />

      {/* Stock History Modal */}
      <AdminStockHistoryModal
        item={historyModal}
        movements={historyMovements}
        loading={historyLoading}
        isOpen={Boolean(historyModal !== null || historyLoading)}
        onClose={() => {
          setHistoryModal(null);
          setHistoryMovements([]);
        }}
      />

      {/* Reorder Level Modal */}
      <AdminReorderLevelModal
        item={reorderItem}
        currentLevel={globalThreshold}
        isOpen={reorderModalOpen}
        onClose={() => {
          setReorderModalOpen(false);
          setReorderItem(null);
        }}
        onSave={handleReorderSave}
      />

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
