/**
 * Shared formatting utilities for numbers, currencies, percentages, and dates.
 */

/**
 * Format currency with explicit currency symbol / code.
 * Handles USD and ETB.
 */
export function formatCurrency(amount, currency = 'USD') {
  const num = Number(amount || 0);
  if (!Number.isFinite(num)) return currency === 'ETB' ? 'ETB 0.00' : '$0.00';

  if (currency === 'ETB') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ETB',
      currencyDisplay: 'code',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format integer or decimal numbers with thousand separators.
 */
export function formatNumber(amount, fractionDigits = 0) {
  const num = Number(amount || 0);
  if (!Number.isFinite(num)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(num);
}

/**
 * Format compact numbers (e.g. 184.9k, 1.2M)
 */
export function formatCompactNumber(amount) {
  const num = Number(amount || 0);
  if (!Number.isFinite(num)) return '0';
  if (Math.abs(num) >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(num) >= 1_000) {
    return `${(num / 1_000).toFixed(1)}k`;
  }
  return String(num);
}

/**
 * Format percentage change vs previous period.
 * Shows "-" instead of NaN or Infinity when previous period is zero or undefined.
 */
export function formatPercentageChange(percentage, withSign = true) {
  if (
    percentage === null ||
    percentage === undefined ||
    !Number.isFinite(Number(percentage))
  ) {
    return '-';
  }

  const num = Number(percentage);
  const formatted = `${Math.abs(num).toFixed(1)}%`;

  if (!withSign) return formatted;
  if (num > 0) return `↑ ${formatted}`;
  if (num < 0) return `↓ ${formatted}`;
  return `0.0%`;
}

/**
 * Format date to standard readable strings
 */
export function formatDate(dateInput, formatStyle = 'medium') {
  if (!dateInput) return 'N/A';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'N/A';

  if (formatStyle === 'short') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  }

  if (formatStyle === 'fullDate') {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).format(date).toUpperCase();
  }

  if (formatStyle === 'dateTime') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  if (formatStyle === 'rangeLabel') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function getDefaultMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  return {
    key: 'thisMonth',
    label: `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start)} – ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(end)}`,
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

/**
 * Relative time formatting (e.g. "5 minutes ago", "2 hours ago", "yesterday")
 */
export function formatRelativeTime(dateInput) {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return 'yesterday';
  return formatDate(date, 'short');
}
