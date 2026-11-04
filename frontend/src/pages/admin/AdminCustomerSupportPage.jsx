import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import AdminRowActionMenu from '../../components/admin/AdminRowActionMenu';
import supportApi from '../../lib/api/supportApi';
import '../../components/admin/admin-dashboard.css';
import './admin-support.css';

function cleanMessageText(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.trim();

  // Strip standard and inline 'On <date> ... wrote:' reply chains
  const onWroteRegex = /(?:\r?\n|^|\s{1,})On\s+(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,\s+)?(?:[A-Za-z]{3}\s+\d{1,2},\s+\d{4}|\d{1,2}\s+[A-Za-z]{3}\s+\d{4})[\s\S]+?wrote:\s*[\s\S]*$/i;
  const onWroteGeneric = /(?:\r?\n|^|\s{1,})On\s+[\s\S]{5,120}?\s+wrote:\s*[\s\S]*$/i;
  if (onWroteRegex.test(cleaned)) {
    cleaned = cleaned.replace(onWroteRegex, '').trim();
  } else if (onWroteGeneric.test(cleaned)) {
    cleaned = cleaned.replace(onWroteGeneric, '').trim();
  }

  // Strip "-----Original Message-----"
  const origMsgIndex = cleaned.search(/^-{3,}\s*(?:Original Message|Forwarded message)\s*-{3,}/im);
  if (origMsgIndex !== -1) {
    cleaned = cleaned.substring(0, origMsgIndex).trim();
  }

  // Strip Outlook underscore dividers
  const underscoreIndex = cleaned.search(/_{20,}/);
  if (underscoreIndex !== -1) {
    cleaned = cleaned.substring(0, underscoreIndex).trim();
  }

  return cleaned || text.trim();
}

export default function AdminCustomerSupportPage({ go, search: searchProp }) {
  const [conversations, setConversations] = useState([]);
  const [counts, setCounts] = useState({ all: 0, open: 0, replied: 0, resolved: 0 });
  const [stats, setStats] = useState({
    open: { value: 0, subtext: '+0 this week' },
    unread: { value: 0, subtext: '+0 today' },
    avgFirstResponse: { value: '2.4 h', subtext: '−0.6 h' },
    resolvedThisWeek: { value: 0, subtext: '+0%' },
  });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notFoundError, setNotFoundError] = useState(false);

  const [search, setSearch] = useState('');
  const [topicFilter, setTopicFilter] = useState('All Topics');
  const [assignedFilter, setAssignedFilter] = useState('All Assignees');
  const [dateFilter, setDateFilter] = useState('All Dates');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');

  const [selectedId, setSelectedId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const [composerTab, setComposerTab] = useState('Reply');
  const [composerText, setComposerText] = useState('');

  const [toast, setToast] = useState(null); // { message, conversationId }

  const messagesEndRef = useRef(null);
  const listItemsRef = useRef({});
  const messageElementsRef = useRef({});

  // Helper to extract target conversation ID from search prop or window.location.search
  const getTargetConversationId = useCallback(() => {
    try {
      const sp = new URLSearchParams(searchProp || window.location.search);
      return sp.get('conversation') || null;
    } catch {
      return null;
    }
  }, [searchProp]);

  // Helper to extract target message ID from window.location.hash
  const getTargetMessageId = () => {
    try {
      const hash = window.location.hash || '';
      const match = hash.match(/message=([a-zA-Z0-9_-]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };

  // Fetch conversations from live backend
  const loadConversations = useCallback(async (isPolling = false) => {
    try {
      if (!isPolling) setLoading(true);
      const params = {
        status: statusFilter,
        topic: topicFilter,
        assignedTo: assignedFilter,
        dateRange: dateFilter,
        unreadOnly,
        search: search.trim() || undefined,
      };

      const res = await supportApi.getConversations(params);
      const items = res?.data || res?.items || (Array.isArray(res) ? res : []);
      const tabCounts = res?.counts || {
        all: items.length,
        open: items.filter(c => c.status === 'Open').length,
        replied: items.filter(c => c.status === 'Replied').length,
        resolved: items.filter(c => c.status === 'Resolved').length,
      };

      setConversations(items);
      setCounts(tabCounts);

      // Maintain URL selection or keep current selection without race condition
      const targetUrlId = getTargetConversationId();
      if (targetUrlId) {
        if (items.some(c => c.id === targetUrlId)) {
          setSelectedId(targetUrlId);
          setNotFoundError(false);
        }
        // If not in items, do not overwrite selectedId with items[0].id
      } else if (items.length > 0) {
        setSelectedId(prev => {
          if (prev && items.some(c => c.id === prev)) return prev;
          return items[0].id;
        });
      } else {
        setSelectedId(null);
      }
    } catch (err) {
      console.error('Failed to load support conversations:', err);
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [statusFilter, topicFilter, assignedFilter, dateFilter, unreadOnly, search, getTargetConversationId]);

  // Fetch KPI stats
  const loadStats = useCallback(async () => {
    try {
      const res = await supportApi.getStats();
      if (res) {
        setStats({
          open: res.open || { value: 0, subtext: '+0 this week' },
          unread: res.unread || { value: 0, subtext: '+0 today' },
          avgFirstResponse: res.avgFirstResponse || { value: '2.4 h', subtext: '−0.6 h' },
          resolvedThisWeek: res.resolvedThisWeek || { value: 0, subtext: '+0%' },
        });
      }
    } catch (err) {
      console.error('Failed to load support stats:', err);
    }
  }, []);

  // Initial load & dependency effect
  useEffect(() => {
    loadConversations();
    loadStats();
  }, [loadConversations, loadStats]);

  // Periodic polling (every 20s) for live inbound messages
  useEffect(() => {
    const timer = setInterval(() => {
      loadConversations(true);
      loadStats();
    }, 20000);
    return () => clearInterval(timer);
  }, [loadConversations, loadStats]);

  // Find currently selected conversation
  const selectedConversation = useMemo(() => {
    return conversations.find(c => c.id === selectedId) || null;
  }, [conversations, selectedId]);

  // Handle outside click for menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuOpen && !event.target.closest('.support-more-menu-wrap')) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Auto-scroll messages or target message
  useEffect(() => {
    const targetMsgId = getTargetMessageId();
    if (targetMsgId && messageElementsRef.current[targetMsgId]) {
      messageElementsRef.current[targetMsgId].scrollIntoView({ behavior: 'smooth', block: 'center' });
      messageElementsRef.current[targetMsgId].classList.add('is-highlighted');
      const timer = setTimeout(() => {
        messageElementsRef.current[targetMsgId]?.classList.remove('is-highlighted');
      }, 2500);
      return () => clearTimeout(timer);
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedConversation?.messages]);

  // Scroll active conversation item into view in sidebar
  useEffect(() => {
    if (selectedId && listItemsRef.current[selectedId]) {
      listItemsRef.current[selectedId].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedId, conversations]);

  // Fetch specific conversation if requested via URL param (e.g. from notification click)
  useEffect(() => {
    const targetId = getTargetConversationId();
    if (!targetId) return;

    const inList = conversations.find(c => c.id === targetId);
    if (inList) {
      if (selectedId !== targetId) {
        setSelectedId(targetId);
      }
      setNotFoundError(false);
      if (inList.unread) {
        supportApi.markUnread(targetId, false).catch(() => {});
        setConversations(prev => prev.map(c => c.id === targetId ? { ...c, unread: false } : c));
      }
      return;
    }

    let isCurrent = true;
    supportApi.getConversationById(targetId)
      .then((conv) => {
        if (!isCurrent) return;
        if (conv && conv.id) {
          setNotFoundError(false);
          setConversations(prev => {
            if (prev.some(c => c.id === conv.id)) return prev;
            return [conv, ...prev];
          });
          setSelectedId(conv.id);
          if (conv.unread) {
            supportApi.markUnread(conv.id, false).catch(() => {});
          }
        } else {
          setSelectedId(null);
          setNotFoundError(true);
        }
      })
      .catch(() => {
        if (!isCurrent) return;
        setSelectedId(null);
        setNotFoundError(true);
      });

    return () => {
      isCurrent = false;
    };
  }, [getTargetConversationId, conversations, selectedId]);

  const handleSelectConversation = (conv) => {
    setSelectedId(conv.id);
    setNotFoundError(false);

    try {
      const url = new URL(window.location.href);
      url.searchParams.set('conversation', conv.id);
      url.hash = '';
      window.history.pushState({}, '', url.pathname + url.search);
    } catch {}

    if (conv.unread) {
      supportApi.markUnread(conv.id, false).catch(() => {});
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread: false } : c));
    }
  };

  // Real CSV export
  const exportData = async () => {
    try {
      const blob = await supportApi.exportCsv();
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `novashop-support-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export customer support data:', err);
      alert('Failed to export support data. Please try again.');
    }
  };

  const handleStatusChange = (status) => {
    setStatusFilter(status);
  };

  const markAsResolved = async () => {
    if (!selectedConversation) return;
    const convId = selectedConversation.id;

    try {
      await supportApi.updateStatus(convId, 'Resolved');

      setConversations(prev =>
        prev.map(c => (c.id === convId ? { ...c, status: 'Resolved', unread: false } : c))
      );
      setCounts(prev => ({
        ...prev,
        open: Math.max(0, prev.open - 1),
        resolved: prev.resolved + 1,
      }));

      setToast({
        message: 'Conversation resolved',
        conversationId: convId,
      });

      setMenuOpen(false);

      setTimeout(() => {
        setToast(null);
      }, 5000);

      loadStats();
    } catch (err) {
      console.error('Failed to resolve conversation:', err);
    }
  };

  const undoResolve = async () => {
    if (!toast) return;
    const convId = toast.conversationId;

    try {
      await supportApi.updateStatus(convId, 'Open');

      setConversations(prev =>
        prev.map(c => (c.id === convId ? { ...c, status: 'Open' } : c))
      );
      setCounts(prev => ({
        ...prev,
        open: prev.open + 1,
        resolved: Math.max(0, prev.resolved - 1),
      }));

      setToast(null);
      loadStats();
    } catch (err) {
      console.error('Failed to undo resolve:', err);
    }
  };

  const assignToMe = async () => {
    if (!selectedConversation) return;
    const convId = selectedConversation.id;

    try {
      await supportApi.assignConversation(convId, 'Me');
      setConversations(prev =>
        prev.map(c => (c.id === convId ? { ...c, assignedTo: 'Me' } : c))
      );
      setMenuOpen(false);
    } catch (err) {
      console.error('Failed to assign conversation:', err);
    }
  };

  const markAsUnread = async () => {
    if (!selectedConversation) return;
    const convId = selectedConversation.id;

    try {
      await supportApi.markUnread(convId, true);
      setConversations(prev =>
        prev.map(c => (c.id === convId ? { ...c, unread: true } : c))
      );
      setMenuOpen(false);
      loadStats();
    } catch (err) {
      console.error('Failed to mark conversation unread:', err);
    }
  };

  const sendMessage = async () => {
    if (!selectedConversation || !composerText.trim() || sending) return;
    const convId = selectedConversation.id;
    const textToSend = composerText.trim();
    setSending(true);

    try {
      let updated;
      if (composerTab === 'Reply') {
        updated = await supportApi.sendReply(convId, { content: textToSend });
      } else {
        updated = await supportApi.saveInternalNote(convId, { content: textToSend });
      }

      setComposerText('');

      if (updated && updated.messages) {
        setConversations(prev =>
          prev.map(c => (c.id === convId ? updated : c))
        );
      } else {
        await loadConversations(true);
      }
      loadStats();
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Counts for tabs
  const allCount = counts.all;
  const openCount = counts.open;
  const repliedCount = counts.replied;
  const resolvedCount = counts.resolved;

  return (
    <div className="admin-dashboard support-page">
      <section className="admin-page-heading">
        <div>
          <h1 className="admin-page-title">Customer Support</h1>
          <p className="admin-page-description">View and respond to customer messages.</p>
        </div>
        <div className="admin-page-actions">
          <button className="admin-action-button" type="button" onClick={exportData}>
            <AdminIcon name="download" size={15} /> Export
          </button>
        </div>
      </section>

      <section className="customers-kpi-section" aria-label="Performance Metrics">
        <div className="customers-kpi-eyebrow">LAST 7 DAYS</div>
        <div className="admin-stat-grid">
          <article className="admin-stat-card">
            <div className="admin-stat-heading">
              <span className="admin-stat-label">Open conversations</span>
            </div>
            <div className="admin-stat-value">{stats.open.value}</div>
            <div className="admin-stat-subtext"><span className="admin-trend-pill">{stats.open.subtext}</span></div>
          </article>
          <article className="admin-stat-card">
            <div className="admin-stat-heading">
              <span className="admin-stat-label">Unread</span>
            </div>
            <div className="admin-stat-value">{stats.unread.value}</div>
            <div className="admin-stat-subtext"><span className="admin-trend-pill">{stats.unread.subtext}</span></div>
          </article>
          <article className="admin-stat-card">
            <div className="admin-stat-heading">
              <span className="admin-stat-label">Avg. first response</span>
            </div>
            <div className="admin-stat-value">{stats.avgFirstResponse.value}</div>
            <div className="admin-stat-subtext"><span className="admin-trend-pill" style={{background: 'var(--admin-positive-soft)', color: 'var(--admin-positive)'}}>{stats.avgFirstResponse.subtext}</span></div>
          </article>
          <article className="admin-stat-card">
            <div className="admin-stat-heading">
              <span className="admin-stat-label">Resolved this week</span>
            </div>
            <div className="admin-stat-value">{stats.resolvedThisWeek.value}</div>
            <div className="admin-stat-subtext"><span className="admin-trend-pill">{stats.resolvedThisWeek.subtext}</span></div>
          </article>
        </div>
      </section>

      <div className="support-filters-bar">
        <label className="support-search-field">
          <AdminIcon name="search" size={16} />
          <input
            type="search"
            placeholder="Search by customer, order, or message"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </label>

        <select className="support-filter-select" value={topicFilter} onChange={e => setTopicFilter(e.target.value)}>
          <option>All Topics</option>
          <option>Shipping</option>
          <option>Returns</option>
          <option>Payments</option>
          <option>Product Inquiry</option>
          <option>Discounts</option>
        </select>

        <select className="support-filter-select" value={assignedFilter} onChange={e => setAssignedFilter(e.target.value)}>
          <option>All Assignees</option>
          <option>Me</option>
          <option>Unassigned</option>
        </select>

        <select className="support-filter-select" value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
          <option>All Dates</option>
          <option>Today</option>
          <option>Yesterday</option>
          <option>Last 7 days</option>
        </select>

        <label className="support-unread-check">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={e => setUnreadOnly(e.target.checked)}
          />
          Unread only
        </label>
      </div>

      <div className="support-status-tabs">
        <button
          className={`support-status-tab ${statusFilter === 'All' ? 'is-active' : ''}`}
          onClick={() => handleStatusChange('All')}
        >
          All <span className="count">{allCount}</span>
        </button>
        <button
          className={`support-status-tab ${statusFilter === 'Open' ? 'is-active' : ''}`}
          onClick={() => handleStatusChange('Open')}
        >
          <i className="status-dot open"></i> Open <span className="count">{openCount}</span>
        </button>
        <button
          className={`support-status-tab ${statusFilter === 'Replied' ? 'is-active' : ''}`}
          onClick={() => handleStatusChange('Replied')}
        >
          <i className="status-dot replied"></i> Replied <span className="count">{repliedCount}</span>
        </button>
        <button
          className={`support-status-tab ${statusFilter === 'Resolved' ? 'is-active' : ''}`}
          onClick={() => handleStatusChange('Resolved')}
        >
          <i className="status-dot resolved"></i> Resolved <span className="count">{resolvedCount}</span>
        </button>
      </div>

      <div className={`support-workspace ${selectedConversation ? 'has-selection' : ''}`}>
        <div className="support-list-col">
          <div className="support-list-scroll">
            {loading ? (
              <div style={{padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted, #8A847C)', fontSize: '13px'}}>
                Loading conversations...
              </div>
            ) : conversations.length > 0 ? (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  ref={el => { if (el) listItemsRef.current[conv.id] = el; }}
                  className={`support-list-item ${conv.id === selectedId ? 'is-selected' : ''} ${conv.unread ? 'is-unread' : ''}`}
                  onClick={() => handleSelectConversation(conv)}
                >
                  <div className="support-item-avatar">{conv.customer.avatar}</div>
                  <div className="support-item-content">
                    <div className="support-item-header">
                      <span className="support-item-name">{conv.customer.name}</span>
                      <span className="support-item-time">{conv.timestamp}</span>
                    </div>
                    <div className="support-item-subject">{conv.subject}</div>
                    <div className="support-item-preview">{cleanMessageText(conv.preview)}</div>
                  </div>
                  {conv.status === 'Open' && <i className="support-item-status-dot open" style={{background: 'var(--admin-amber)'}}></i>}
                  {conv.status === 'Replied' && <i className="support-item-status-dot replied" style={{background: 'var(--admin-blue)'}}></i>}
                  {conv.status === 'Resolved' && <i className="support-item-status-dot resolved" style={{background: 'var(--admin-positive)'}}></i>}
                </div>
              ))
            ) : (
              <div style={{padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted, #8A847C)', fontSize: '13px'}}>
                No conversations match the current filters.
              </div>
            )}
          </div>
        </div>

        <div className="support-detail-col">
          {selectedConversation ? (
            <>
              <div className="support-detail-header">
                <div className="support-detail-header-left">
                  <button
                    type="button"
                    className="support-mobile-back-btn"
                    onClick={() => setSelectedId(null)}
                    aria-label="Back to conversations list"
                  >
                    <AdminIcon name="left" size={14} />
                    <span>Back</span>
                  </button>
                  <div className="support-item-avatar">{selectedConversation.customer.avatar}</div>
                  <div className={`support-detail-status-badge ${selectedConversation.status.toLowerCase()}`}>
                    <i className={`status-dot ${selectedConversation.status.toLowerCase()}`}></i> {selectedConversation.status}
                  </div>
                </div>
                <div className="support-detail-actions">
                  <button
                    className={`support-resolve-btn ${selectedConversation.status === 'Resolved' ? 'is-resolved' : ''}`}
                    onClick={markAsResolved}
                  >
                    <AdminIcon name="check" size={14} />
                    {selectedConversation.status === 'Resolved' ? 'RESOLVED' : 'MARK AS RESOLVED'}
                  </button>
                  <div className="support-more-menu-wrap">
                    <AdminRowActionMenu
                      item={selectedConversation}
                      title={selectedConversation.ticketNumber || 'Ticket'}
                      subtitle={`${selectedConversation.customer?.name || 'Customer'} · ${selectedConversation.customer?.email || ''}`}
                      items={[
                        {
                          label: 'Assign to me',
                          icon: 'customers',
                          onClick: assignToMe,
                        },
                        {
                          label: 'Mark as unread',
                          icon: 'email',
                          onClick: markAsUnread,
                        },
                        {
                          label: 'View customer',
                          icon: 'eye',
                          onClick: () => go(selectedConversation.customer.id ? `/admin/customers/${selectedConversation.customer.id}` : `/admin/customers`),
                        },
                        {
                          label: 'View order',
                          icon: 'document',
                          hidden: !selectedConversation.customer?.recentOrder,
                          onClick: () => go(`/admin/orders/${selectedConversation.customer.recentOrder.replace('#', '')}`),
                        },
                        {
                          divider: true,
                        },
                        {
                          label: 'Mark as resolved',
                          icon: 'check',
                          onClick: markAsResolved,
                        },
                      ]}
                    />
                  </div>
                </div>
              </div>

              <div className="support-customer-bar">
                <button
                  className="support-customer-bar-toggle"
                  onClick={() => setDetailsExpanded(!detailsExpanded)}
                >
                  Customer details <AdminIcon name="chevron" size={14} style={{transform: detailsExpanded ? 'rotate(180deg)' : 'none'}} />
                </button>
                {detailsExpanded && (
                  <div className="support-customer-details">
                    <div>
                      <strong>Name</strong>
                      <span>{selectedConversation.customer.name}</span>
                    </div>
                    <div>
                      <strong>Email</strong>
                      <span>{selectedConversation.customer.email}</span>
                    </div>
                    <div>
                      <strong>Customer since</strong>
                      <span>{selectedConversation.customer.since}</span>
                    </div>
                    <div>
                      <strong>Recent order</strong>
                      <span style={{color: 'var(--admin-primary)', fontWeight: '600', cursor: 'pointer'}} onClick={() => go(`/admin/orders/${selectedConversation.customer.recentOrder.replace('#', '')}`)}>
                        {selectedConversation.customer.recentOrder}
                      </span>
                    </div>
                    <div>
                      <strong>Order status</strong>
                      <span>{selectedConversation.customer.orderStatus}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="support-messages-scroll">
                <div className="support-message-subject">{selectedConversation.subject}</div>
                {selectedConversation.messages && selectedConversation.messages.map(msg => (
                  <div
                    key={msg.id}
                    ref={el => { if (el) messageElementsRef.current[msg.id] = el; }}
                    className={`support-message ${msg.type}`}
                  >
                    <div className="support-message-bubble">{cleanMessageText(msg.content)}</div>
                    <div className="support-message-meta">{msg.timestamp}</div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className={`support-composer ${composerTab === 'Internal note' ? 'is-internal' : ''}`}>
                <div className="support-composer-tabs">
                  <button
                    className={`support-composer-tab ${composerTab === 'Reply' ? 'is-active' : ''}`}
                    onClick={() => setComposerTab('Reply')}
                  >
                    Reply
                  </button>
                  <button
                    className={`support-composer-tab ${composerTab === 'Internal note' ? 'is-active' : ''}`}
                    onClick={() => setComposerTab('Internal note')}
                  >
                    Internal note
                  </button>
                </div>
                {composerTab === 'Reply' && (
                  <div className="support-composer-to">
                    To: <strong>{selectedConversation.customer.name}</strong> ({selectedConversation.customer.email})
                  </div>
                )}
                <div className="support-composer-input-area">
                  <textarea
                    className="support-composer-textarea"
                    placeholder={composerTab === 'Reply' ? `Write a reply to ${selectedConversation.customer.name}...` : 'Write an internal note (only visible to staff)...'}
                    value={composerText}
                    onChange={e => setComposerText(e.target.value)}
                    disabled={sending}
                  />
                  <div className="support-composer-toolbar">
                    <div className="support-composer-tools">
                      <button className="support-composer-tool" title="Attach file"><AdminIcon name="document" size={16} /></button>
                    </div>
                    <button className="support-composer-send" onClick={sendMessage} disabled={sending || !composerText.trim()}>
                      {sending ? 'Sending...' : (composerTab === 'Reply' ? 'Send reply' : 'Save note')}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : notFoundError ? (
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-subtle, #8A847C)', padding: '40px 24px', textAlign: 'center'}}>
              <div style={{width: 48, height: 48, borderRadius: '50%', background: 'var(--admin-border, #E4E1DB)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, color: 'var(--admin-muted, #736E66)'}}>
                <AdminIcon name="support" size={24} />
              </div>
              <h3 style={{fontFamily: 'serif', fontSize: '18px', fontWeight: 600, color: 'var(--admin-text, #1F1D1A)', margin: '0 0 8px 0'}}>
                This conversation no longer exists
              </h3>
              <p style={{fontSize: '13px', maxWidth: '380px', margin: '0 0 20px 0', lineHeight: 1.5}}>
                The support ticket or conversation you are looking for may have been archived, deleted, or you do not have permission to view it.
              </p>
              <button
                type="button"
                className="admin-secondary-btn"
                onClick={() => {
                  setNotFoundError(false);
                  try {
                    const url = new URL(window.location.href);
                    url.searchParams.delete('conversation');
                    url.hash = '';
                    window.history.pushState({}, '', url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : ''));
                  } catch {}
                  if (conversations.length > 0) {
                    handleSelectConversation(conversations[0]);
                  }
                }}
                style={{padding: '8px 16px', fontSize: '13px', fontWeight: 500, borderRadius: '6px', border: '1px solid var(--admin-border, #D0CCC5)', background: 'var(--bg-surface-raised, #FFFFFF)', color: 'var(--text-primary, #1B1816)', cursor: 'pointer'}}
              >
                Return to conversations
              </button>
            </div>
          ) : (
            <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted, #8A847C)'}}>
              Select a conversation to view details
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="support-toast">
          <AdminIcon name="check" size={16} style={{color: 'var(--admin-positive)'}} />
          <span>{toast.message}</span>
          <button className="support-toast-undo" onClick={undoResolve}>UNDO</button>
          <button className="support-toast-close" onClick={() => setToast(null)}>
            <AdminIcon name="close" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
