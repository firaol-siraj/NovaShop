import { useState, useRef, useEffect, useId } from 'react';
import { AdminIcon } from './AdminLayout';

/**
 * Accessible custom select dropdown for admin tables & filters.
 * Features:
 * - Searchable if options count > 8
 * - Dark & light theme design tokens
 * - Keyboard navigation (Escape, ArrowUp, ArrowDown, Enter)
 * - Outside click listener
 */
export default function AdminCustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select option',
  ariaLabel = 'Select option',
  className = '',
  style = {},
  searchThreshold = 8,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);
  const id = useId();

  // Normalize options to { value, label }
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'string' || typeof opt === 'number') {
      return { value: String(opt), label: String(opt) };
    }
    return {
      value: String(opt.value ?? opt.id ?? opt.name),
      label: String(opt.label ?? opt.name ?? opt.value),
    };
  });

  const filteredOptions = normalizedOptions.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = normalizedOptions.find(
    (opt) => String(opt.value) === String(value)
  );

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && normalizedOptions.length > searchThreshold) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, normalizedOptions.length, searchThreshold]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
        setHighlightedIndex(-1);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        setSearch('');
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val) => {
    onChange?.(val);
    setIsOpen(false);
    setSearch('');
    setHighlightedIndex(-1);
  };

  const handleTriggerKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex(0);
    }
  };

  const handleListKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % filteredOptions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length);
    } else if (e.key === 'Enter' && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
      e.preventDefault();
      handleSelect(filteredOptions[highlightedIndex].value);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`admin-custom-select-container ${className}`}
      style={{ position: 'relative', width: '100%', minWidth: '150px', ...style }}
    >
      <button
        type="button"
        id={`select-trigger-${id}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleTriggerKeyDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          width: '100%',
          height: '40px',
          padding: '0 12px',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-default)',
          borderRadius: '8px',
          color: selectedOption ? 'var(--text-primary)' : 'var(--text-muted)',
          fontFamily: 'var(--font-sans)',
          fontSize: '13px',
          fontWeight: 500,
          textAlign: 'left',
          cursor: 'pointer',
          outline: 'none',
          transition: 'border-color 140ms ease, box-shadow 140ms ease',
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span
          style={{
            display: 'inline-flex',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 140ms ease',
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          <AdminIcon name="chevron" size={14} />
        </span>
      </button>

      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          onKeyDown={handleListKeyDown}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 9999,
            maxHeight: '260px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: '8px',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {normalizedOptions.length > searchThreshold && (
            <div style={{ padding: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 8px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                }}
              >
                <AdminIcon name="search" size={13} style={{ color: 'var(--text-muted)' }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  placeholder="Filter options…"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    width: '100%',
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>
          )}

          <div
            ref={listRef}
            style={{
              overflowY: 'auto',
              maxHeight: '200px',
              padding: '4px',
            }}
          >
            {filteredOptions.length === 0 ? (
              <div
                style={{
                  padding: '10px 12px',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                }}
              >
                No options match
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = idx === highlightedIndex;

                return (
                  <button
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: isHighlighted
                        ? 'var(--bg-surface-raised)'
                        : isSelected
                        ? 'var(--bg-surface-sunken)'
                        : 'transparent',
                      color: isSelected ? 'var(--color-accent, #D4A662)' : 'var(--text-primary)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13px',
                      fontWeight: isSelected ? 600 : 400,
                      textAlign: 'left',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <AdminIcon name="check" size={13} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
