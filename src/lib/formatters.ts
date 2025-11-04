/**
 * Locale-aware number and currency formatting utilities
 * Automatically detects user locale (US vs EU/Germany format)
 */

export const getUserLocale = (): string => {
  // Check if user is in USA
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isUSA = timeZone.includes('America') || navigator.language.startsWith('en-US');
  
  return isUSA ? 'en-US' : 'de-DE';
};

export const formatCurrency = (value: number, currency: string = 'EUR'): string => {
  const locale = getUserLocale();
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatNumber = (value: number, decimals: number = 2): string => {
  const locale = getUserLocale();
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

export const formatPercentage = (value: number, decimals: number = 2): string => {
  const locale = getUserLocale();
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: 'exceptZero',
  }).format(value);
  return `${formatted}%`;
};
