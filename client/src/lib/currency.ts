// Utility functions for formatting financial values
// All financial values are stored as direct dollar amounts (no multipliers)

export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) {
    return '$0';
  }
  
  // Convert to number (values are already in dollars)
  const numValue = typeof value === 'string' ? parseInt(value) : value;
  const dollarAmount = numValue;
  
  // Format with exactly 2 decimal places and thousands separators
  return `$${dollarAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCurrencyWithSuffix(value: number | string | null | undefined, suffix: string): string {
  const formatted = formatCurrency(value);
  return `${formatted}${suffix}`;
}

// Global currency formatter - displays values in whole dollars (if < $1,000) or K-scale (if >= $1,000)
// No decimals in either case. This is the primary formatter for all monetary values.
export function formatCurrencyK(value: number | string | null | undefined): string {
  if (value === null || value === undefined) {
    return '$0';
  }
  
  // Convert to number (values are already in dollars)
  const numValue = typeof value === 'string' ? parseInt(value) : value;
  const dollarAmount = numValue;
  
  // If less than $1,000, show as whole dollars
  if (dollarAmount < 1000) {
    return `$${Math.round(dollarAmount).toLocaleString()}`;
  }
  
  // Otherwise, convert to thousands and show K-scale
  const thousands = Math.round(dollarAmount / 1000);
  return `$${thousands.toLocaleString()} K`;
}

// Legacy: Keep formatCurrencyCompact as an alias to formatCurrencyK for backward compatibility
export const formatCurrencyCompact = formatCurrencyK;