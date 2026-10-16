import { useState, useMemo, useEffect, useRef } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import '../../components/admin/admin-dashboard.css';
import './admin-support.css';

const MOCK_CONVERSATIONS = [
  {
    id: '1',
    customer: { name: 'Amelia Chen', email: 'amelia.chen@email.com', avatar: 'AC', since: 'Oct 2024', recentOrder: '#SB-10482', orderStatus: 'Processing' },
    subject: "Where is my order?",
    preview: "Hi, I ordered the Silk Slip Dress on Sep 28 and haven't had a shipping update. When will it ship?",
    timestamp: "12 min ago",
    status: 'Open',
    unread: true,
    assignedTo: 'Unassigned',
    topic: 'Shipping',
    messages: [
      { id: "m1", sender: "Amelia Chen", type: "customer", content: "Hi, I ordered the Silk Slip Dress on Sep 28 and haven't had a shipping update. When will it ship?", timestamp: "Amelia Chen · 9:12 AM" },
      { id: 'm2', sender: 'Admin', type: 'admin', content: 'Good morning Amelia, thank you for reaching out. Let me check the fulfillment dispatch queue with our Singapore air courier partner right now.', timestamp: 'Admin · 9:18 AM' }
    ]
  },
  {
    id: '2',
    customer: { name: 'James Okafor', email: 'james.o@email.com', avatar: 'JO', since: 'Aug 2025', recentOrder: '#SB-10483', orderStatus: 'Delivered' },
    subject: 'Wrong size received',
    preview: 'The Leather Tote Bag looks fine, but the overcoat is the wrong size...',
    timestamp: '1 hour ago',
    status: 'Open',
    unread: false,
    assignedTo: 'Me',
    topic: 'Returns',
    messages: [
      { id: 'm1', sender: 'James Okafor', type: 'customer', content: 'The Leather Tote Bag looks fine, but the overcoat is the wrong size. I ordered a Medium but received a Large. How can I exchange this?', timestamp: 'James Okafor · 8:00 AM' }
    ]
  },
  {
    id: '3',
    customer: { name: 'Sofia Rossi', email: 'sofia.rossi@email.com', avatar: 'SR', since: 'Jan 2026', recentOrder: '#SB-10484', orderStatus: 'Pending' },
    subject: 'Can I change my shipping address?',
    preview: 'I moved last week and need to update my shipping address before the order ships...',
    timestamp: '3 hours ago',
    status: 'Open',
    unread: false,
    assignedTo: 'Unassigned',
    topic: 'Shipping',
    messages: [
      { id: 'm1', sender: 'Sofia Rossi', type: 'customer', content: 'I moved last week and need to update my shipping address before the order ships. My new address is 123 Main St.', timestamp: 'Sofia Rossi · 6:00 AM' }
    ]
  },
  {
    id: '4',
    customer: { name: 'Lucas Meyer', email: 'lucas.m@email.com', avatar: 'LM', since: 'Nov 2025', recentOrder: '#SB-10485', orderStatus: 'Delivered' },
    subject: 'Is the overcoat available in navy?',
    preview: 'Thanks, I will check back next month.',
    timestamp: 'Yesterday',
    status: 'Replied',
    unread: false,
    assignedTo: 'Me',
    topic: 'Product Inquiry',
    messages: [
      { id: 'm1', sender: 'Lucas Meyer', type: 'customer', content: 'Is the cashmere overcoat available in navy blue? I only see black and camel on the website.', timestamp: 'Lucas Meyer · Yesterday 10:00 AM' },
      { id: 'm2', sender: 'Admin', type: 'admin', content: 'Hi Lucas, the navy blue overcoat will be restocked next month. Please sign up for back-in-stock notifications on the product page.', timestamp: 'Admin · Yesterday 11:00 AM' },
      { id: 'm3', sender: 'Lucas Meyer', type: 'customer', content: 'Thanks, I will check back next month.', timestamp: 'Lucas Meyer · Yesterday 11:30 AM' }
    ]
  },
  {
    id: '5',
    customer: { name: 'Priya Raman', email: 'priya.raman@email.com', avatar: 'PR', since: 'May 2026', recentOrder: '#SB-10486', orderStatus: 'Cancelled' },
    subject: 'Payment failed at checkout',
    preview: 'I tried twice and my card was declined, but I see a pending charge on my bank statement...',
    timestamp: 'Yesterday',
    status: 'Open',
    unread: true,
    assignedTo: 'Unassigned',
    topic: 'Payments',
    messages: [
      { id: 'm1', sender: 'Priya Raman', type: 'customer', content: 'I tried twice and my card was declined, but I see a pending charge on my bank statement. Did my order go through?', timestamp: 'Priya Raman · Yesterday 2:00 PM' }
    ]
  },
  {
    id: '6',
    customer: { name: 'Hannah Becker', email: 'hannah.b@email.com', avatar: 'HB', since: 'Sep 2025', recentOrder: '#SB-10487', orderStatus: 'Refunded' },
    subject: "Refund not received",
    preview: "It has been five days since you received my return, but I still haven't gotten my refund...",
    timestamp: "2 days ago",
    status: 'Replied',
    unread: false,
    assignedTo: 'Me',
    topic: 'Refunds',
    messages: [
      { id: "m1", sender: "Hannah Becker", type: "customer", content: "It has been five days since you received my return, but I still haven't gotten my refund. When should I expect it?", timestamp: "Hannah Becker · 2 days ago" }
    ]
  },
  {
    id: '7',
    customer: { name: 'Daniel Kim', email: 'daniel.kim@email.com', avatar: 'DK', since: 'Dec 2025', recentOrder: '#SB-10488', orderStatus: 'Processing' },
    subject: 'Discount code not working',
    preview: 'I am trying to use the code WELCOME10 but it says it is invalid...',
    timestamp: '3 days ago',
    status: 'Resolved',
    unread: false,
    assignedTo: 'Me',
    topic: 'Discounts',
    messages: [
      { id: 'm1', sender: 'Daniel Kim', type: 'customer', content: 'I am trying to use the code WELCOME10 but it says it is invalid. Help?', timestamp: 'Daniel Kim · 3 days ago' },
      { id: 'm2', sender: 'Admin', type: 'admin', content: 'Hi Daniel, the WELCOME10 code is only valid for first-time customers. Since you have ordered from us before, that code will not apply.', timestamp: 'Admin · 3 days ago' }
    ]
  }
];

export default function AdminCustomerSupportPage({ go }) {
  const [conversations, setConversations] = useState(MOCK_CONVERSATIONS);
  const [search, setSearch] = useState('');
  const [topicFilter, setTopicFilter] = useState('All Topics');
  const [assignedFilter, setAssignedFilter] = useState('All Assignees');
  const [dateFilter, setDateFilter] = useState('All Dates');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  
  const [selectedId, setSelectedId] = useState(MOCK_CONVERSATIONS[0].id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  
  const [composerTab, setComposerTab] = useState('Reply');
  const [composerText, setComposerText] = useState('');
  
  const [toast, setToast] = useState(null); // { message, type, conversationId }
  
  const messagesEndRef = useRef(null);
  
  // Filtering logic
  const filteredConversations = useMemo(() => {
    return conversations.filter(conv => {
      // Search
      const query = search.toLowerCase();
      const matchesSearch = !query || 
        conv.customer.name.toLowerCase().includes(query) || 
        conv.subject.toLowerCase().includes(query) ||
        conv.customer.recentOrder.toLowerCase().includes(query);
        
      // Filters
      const matchesTopic = topicFilter === 'All Topics' || conv.topic === topicFilter;
      const matchesAssigned = assignedFilter === 'All Assignees' || conv.assignedTo === assignedFilter;
      // Date filter is simplified for mock
      const matchesDate = dateFilter === 'All Dates' || true;
      const matchesUnread = !unreadOnly || conv.unread;
      
      // Status
      const matchesStatus = statusFilter === 'All' || conv.status === statusFilter;
      
      return matchesSearch && matchesTopic && matchesAssigned && matchesDate && matchesUnread && matchesStatus;
    });
  }, [conversations, search, topicFilter, assignedFilter, dateFilter, unreadOnly, statusFilter]);

  const selectedConversation = conversations.find(c => c.id === selectedId) || null;

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

  // Auto-scroll messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedConversation?.messages]);

  const exportData = () => {
    alert('Exporting customer support data...');
  };

  const handleStatusChange = (status) => {
    setStatusFilter(status);
  };

  const markAsResolved = () => {
    if (!selectedConversation) return;
    
    setConversations(prev => prev.map(c => 
      c.id === selectedConversation.id ? { ...c, status: 'Resolved', unread: false } : c
    ));
    
    setToast({
      message: 'Conversation resolved',
      conversationId: selectedConversation.id
    });
    
    setMenuOpen(false);
    
    // Auto-hide toast
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const undoResolve = () => {
    if (!toast) return;
    
    setConversations(prev => prev.map(c => 
      c.id === toast.conversationId ? { ...c, status: 'Open' } : c
    ));
    
    setToast(null);
  };

  const assignToMe = () => {
    if (!selectedConversation) return;
    setConversations(prev => prev.map(c => 
      c.id === selectedConversation.id ? { ...c, assignedTo: 'Me' } : c
    ));
    setMenuOpen(false);
  };

  const markAsUnread = () => {
    if (!selectedConversation) return;
    setConversations(prev => prev.map(c => 
      c.id === selectedConversation.id ? { ...c, unread: true } : c
    ));
    setMenuOpen(false);
  };

  const sendMessage = () => {
    if (!selectedConversation || !composerText.trim()) return;
    
    const newMessage = {
      id: `m\${Date.now()}`,
      sender: 'Admin',
      type: 'admin',
      content: composerText,
      timestamp: 'Admin · Just now'
    };
    
    setConversations(prev => prev.map(c => 
      c.id === selectedConversation.id ? {
        ...c,
        status: composerTab === 'Reply' ? 'Replied' : c.status,
        messages: [...c.messages, newMessage]
      } : c
    ));
    
    setComposerText('');
  };

  // Counts for tabs
  const allCount = conversations.length;
  const openCount = conversations.filter(c => c.status === 'Open').length;
  const repliedCount = conversations.filter(c => c.status === 'Replied').length;
  const resolvedCount = conversations.filter(c => c.status === 'Resolved').length;

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
            <div className="admin-stat-value">24</div>
            <div className="admin-stat-subtext"><span className="admin-trend-pill">+5 this week</span></div>
          </article>
          <article className="admin-stat-card">
            <div className="admin-stat-heading">
              <span className="admin-stat-label">Unread</span>
            </div>
            <div className="admin-stat-value">7</div>
            <div className="admin-stat-subtext"><span className="admin-trend-pill">+2 today</span></div>
          </article>
          <article className="admin-stat-card">
            <div className="admin-stat-heading">
              <span className="admin-stat-label">Avg. first response</span>
            </div>
            <div className="admin-stat-value">2.4 h</div>
            <div className="admin-stat-subtext"><span className="admin-trend-pill" style={{background: 'var(--admin-positive-soft)', color: 'var(--admin-positive)'}}>−0.6 h</span></div>
          </article>
          <article className="admin-stat-card">
            <div className="admin-stat-heading">
              <span className="admin-stat-label">Resolved this week</span>
            </div>
            <div className="admin-stat-value">86</div>
            <div className="admin-stat-subtext"><span className="admin-trend-pill">+12%</span></div>
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
          className={`support-status-tab \${statusFilter === 'All' ? 'is-active' : ''}`}
          onClick={() => handleStatusChange('All')}
        >
          All <span className="count">{allCount}</span>
        </button>
        <button 
          className={`support-status-tab \${statusFilter === 'Open' ? 'is-active' : ''}`}
          onClick={() => handleStatusChange('Open')}
        >
          <i className="status-dot open"></i> Open <span className="count">{openCount}</span>
        </button>
        <button 
          className={`support-status-tab \${statusFilter === 'Replied' ? 'is-active' : ''}`}
          onClick={() => handleStatusChange('Replied')}
        >
          <i className="status-dot replied"></i> Replied <span className="count">{repliedCount}</span>
        </button>
        <button 
          className={`support-status-tab \${statusFilter === 'Resolved' ? 'is-active' : ''}`}
          onClick={() => handleStatusChange('Resolved')}
        >
          <i className="status-dot resolved"></i> Resolved <span className="count">{resolvedCount}</span>
        </button>
      </div>

      <div className="support-workspace">
        <div className="support-list-col">
          <div className="support-list-scroll">
            {filteredConversations.length > 0 ? (
              filteredConversations.map(conv => (
                <div 
                  key={conv.id} 
                  className={`support-list-item \${conv.id === selectedId ? 'is-selected' : ''} \${conv.unread ? 'is-unread' : ''}`}
                  onClick={() => setSelectedId(conv.id)}
                >
                  <div className="support-item-avatar">{conv.customer.avatar}</div>
                  <div className="support-item-content">
                    <div className="support-item-header">
                      <span className="support-item-name">{conv.customer.name}</span>
                      <span className="support-item-time">{conv.timestamp}</span>
                    </div>
                    <div className="support-item-subject">{conv.subject}</div>
                    <div className="support-item-preview">{conv.preview}</div>
                  </div>
                  {conv.status === 'Open' && <i className="support-item-status-dot open" style={{background: 'var(--admin-amber)'}}></i>}
                  {conv.status === 'Replied' && <i className="support-item-status-dot replied" style={{background: 'var(--admin-blue)'}}></i>}
                  {conv.status === 'Resolved' && <i className="support-item-status-dot resolved" style={{background: 'var(--admin-positive)'}}></i>}
                </div>
              ))
            ) : (
              <div style={{padding: '40px 20px', textAlign: 'center', color: '#8A847C', fontSize: '13px'}}>
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
                  <div className="support-item-avatar">{selectedConversation.customer.avatar}</div>
                  <div className={`support-detail-status-badge \${selectedConversation.status.toLowerCase()}`}>
                    <i className={`status-dot \${selectedConversation.status.toLowerCase()}`}></i> {selectedConversation.status}
                  </div>
                </div>
                <div className="support-detail-actions">
                  <button 
                    className={`support-resolve-btn \${selectedConversation.status === 'Resolved' ? 'is-resolved' : ''}`}
                    onClick={markAsResolved}
                  >
                    <AdminIcon name="check" size={14} /> 
                    {selectedConversation.status === 'Resolved' ? 'RESOLVED' : 'MARK AS RESOLVED'}
                  </button>
                  <div className="support-more-menu-wrap">
                    <button className="support-more-btn" onClick={() => setMenuOpen(!menuOpen)}>
                      <AdminIcon name="more" size={16} />
                    </button>
                    {menuOpen && (
                      <div className="support-dropdown">
                        <button onClick={assignToMe}>
                          <AdminIcon name="customers" size={14} /> Assign to me
                        </button>
                        <button onClick={markAsUnread}>
                          <AdminIcon name="mail" size={14} /> Mark as unread
                        </button>
                        <button onClick={() => go(`/admin/customers/\${selectedConversation.id}`)}>
                          <AdminIcon name="eye" size={14} /> View customer
                        </button>
                        <button onClick={() => go(`/admin/orders/\${selectedConversation.customer.recentOrder.replace('#', '')}`)}>
                          <AdminIcon name="package" size={14} /> View order
                        </button>
                        <button onClick={markAsResolved}>
                          <AdminIcon name="check" size={14} style={{color: 'var(--admin-positive)'}} /> Mark as resolved
                        </button>
                      </div>
                    )}
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
                      <span style={{color: 'var(--admin-primary)', fontWeight: '600', cursor: 'pointer'}} onClick={() => go(`/admin/orders/\${selectedConversation.customer.recentOrder.replace('#', '')}`)}>
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
                {selectedConversation.messages.map(msg => (
                  <div key={msg.id} className={`support-message \${msg.type}`}>
                    <div className="support-message-bubble">{msg.content}</div>
                    <div className="support-message-meta">{msg.timestamp}</div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className={`support-composer \${composerTab === 'Internal note' ? 'is-internal' : ''}`}>
                <div className="support-composer-tabs">
                  <button 
                    className={`support-composer-tab \${composerTab === 'Reply' ? 'is-active' : ''}`}
                    onClick={() => setComposerTab('Reply')}
                  >
                    Reply
                  </button>
                  <button 
                    className={`support-composer-tab \${composerTab === 'Internal note' ? 'is-active' : ''}`}
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
                    placeholder={composerTab === 'Reply' ? `Write a reply to \${selectedConversation.customer.name}...` : 'Write an internal note (only visible to staff)...'}
                    value={composerText}
                    onChange={e => setComposerText(e.target.value)}
                  />
                  <div className="support-composer-toolbar">
                    <div className="support-composer-tools">
                      <button className="support-composer-tool" title="Attach file"><AdminIcon name="document" size={16} /></button>
                    </div>
                    <button className="support-composer-send" onClick={sendMessage}>
                      {composerTab === 'Reply' ? 'Send reply' : 'Save note'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A847C'}}>
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
