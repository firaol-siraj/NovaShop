import { useState, useRef, useEffect } from 'react';
import { AdminIcon } from './AdminLayout';

export default function AdminDateRangePicker({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const selectPreset = (key) => {
    const now = new Date();
    let start;
    let end;
    let label;

    switch (key) {
      case 'thisMonth': {
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        label = `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start)} – ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(end)}`;
        break;
      }
      case 'lastMonth': {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        label = `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start)} – ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(end)}`;
        break;
      }
      case '7D': {
        start = new Date(now.getTime() - 7 * 86400000);
        end = now;
        label = 'Last 7 Days';
        break;
      }
      case '30D': {
        start = new Date(now.getTime() - 30 * 86400000);
        end = now;
        label = 'Last 30 Days';
        break;
      }
      case '90D': {
        start = new Date(now.getTime() - 90 * 86400000);
        end = now;
        label = 'Last 90 Days';
        break;
      }
      case 'ytd': {
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        end = now;
        label = `Year to Date (${now.getFullYear()})`;
        break;
      }
      default:
        return;
    }

    onChange({
      key,
      label,
      from: start.toISOString(),
      to: end.toISOString(),
    });
    setIsOpen(false);
  };

  const handleApplyCustom = (e) => {
    e.preventDefault();
    if (!customFrom || !customTo) return;

    const start = new Date(`${customFrom}T00:00:00.000`);
    const end = new Date(`${customTo}T23:59:59.999`);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      alert('Please select a valid date range where start date is before end date.');
      return;
    }

    onChange({
      key: 'custom',
      label: `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start)} – ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(end)}`,
      from: start.toISOString(),
      to: end.toISOString(),
    });
    setIsOpen(false);
  };

  const currentLabel = value?.label || 'Select Date Range';

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        className="admin-action-button"
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <AdminIcon name="calendar" size={15} />
        <span>{currentLabel}</span>
        <AdminIcon name="chevron" size={13} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 z-50 mt-2 w-72 origin-top-right rounded-lg border border-[#DDD6CC] bg-white p-3 shadow-xl ring-1 ring-black/5 focus:outline-none"
          role="menu"
        >
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#8A847C]">
            Quick Presets
          </div>
          <div className="grid grid-cols-2 gap-1.5 border-b border-[#F0ECE6] pb-3 text-xs">
            <button
              type="button"
              className={`rounded px-2.5 py-1.5 text-left text-[11px] font-medium transition hover:bg-[#F7F4EF] ${
                value?.key === 'thisMonth' ? 'bg-[#F2EDE5] font-semibold text-[#181512]' : 'text-[#5F5952]'
              }`}
              onClick={() => selectPreset('thisMonth')}
            >
              This Month
            </button>
            <button
              type="button"
              className={`rounded px-2.5 py-1.5 text-left text-[11px] font-medium transition hover:bg-[#F7F4EF] ${
                value?.key === 'lastMonth' ? 'bg-[#F2EDE5] font-semibold text-[#181512]' : 'text-[#5F5952]'
              }`}
              onClick={() => selectPreset('lastMonth')}
            >
              Last Month
            </button>
            <button
              type="button"
              className={`rounded px-2.5 py-1.5 text-left text-[11px] font-medium transition hover:bg-[#F7F4EF] ${
                value?.key === '7D' ? 'bg-[#F2EDE5] font-semibold text-[#181512]' : 'text-[#5F5952]'
              }`}
              onClick={() => selectPreset('7D')}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              className={`rounded px-2.5 py-1.5 text-left text-[11px] font-medium transition hover:bg-[#F7F4EF] ${
                value?.key === '30D' ? 'bg-[#F2EDE5] font-semibold text-[#181512]' : 'text-[#5F5952]'
              }`}
              onClick={() => selectPreset('30D')}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              className={`rounded px-2.5 py-1.5 text-left text-[11px] font-medium transition hover:bg-[#F7F4EF] ${
                value?.key === '90D' ? 'bg-[#F2EDE5] font-semibold text-[#181512]' : 'text-[#5F5952]'
              }`}
              onClick={() => selectPreset('90D')}
            >
              Last 90 Days
            </button>
            <button
              type="button"
              className={`rounded px-2.5 py-1.5 text-left text-[11px] font-medium transition hover:bg-[#F7F4EF] ${
                value?.key === 'ytd' ? 'bg-[#F2EDE5] font-semibold text-[#181512]' : 'text-[#5F5952]'
              }`}
              onClick={() => selectPreset('ytd')}
            >
              Year to Date
            </button>
          </div>

          <form onSubmit={handleApplyCustom} className="mt-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#8A847C]">
              Custom Range
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] text-[#716A62]">Start</label>
                <input
                  type="date"
                  className="w-full rounded border border-[#E7E1D9] bg-[#FAF8F4] px-1.5 py-1 text-[11px] text-[#332E29]"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-[9px] text-[#716A62]">End</label>
                <input
                  type="date"
                  className="w-full rounded border border-[#E7E1D9] bg-[#FAF8F4] px-1.5 py-1 text-[11px] text-[#332E29]"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                className="rounded px-2.5 py-1 text-[10px] text-[#7D766D] hover:bg-[#F7F4EF]"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded bg-[#1B1816] px-3 py-1 text-[10px] font-semibold text-white hover:bg-[#332E29]"
              >
                Apply
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
