export const formatCurrency = (
  value: number,
  currency = 'EUR',
  locale?: string
): string => {
  // Auto-detect locale based on navigator.language or default to German locale
  const detectedLocale = locale || 
    (typeof navigator !== 'undefined' ? navigator.language : 'de-DE');
  
  // Use US locale if detected language is English
  const formatLocale = detectedLocale.startsWith('en') ? 'en-US' : 'de-DE';
  
  return new Intl.NumberFormat(formatLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatPercentage = (
  value: number,
  locale?: string,
  includeSign = false
): string => {
  const detectedLocale = locale || 
    (typeof navigator !== 'undefined' ? navigator.language : 'de-DE');
  
  const formatLocale = detectedLocale.startsWith('en') ? 'en-US' : 'de-DE';
  
  const formatted = new Intl.NumberFormat(formatLocale, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: includeSign ? 'exceptZero' : 'auto',
  }).format(value / 100);
  
  return formatted;
};

export const formatNumber = (
  value: number,
  locale?: string,
  options?: Intl.NumberFormatOptions
): string => {
  const detectedLocale = locale || 
    (typeof navigator !== 'undefined' ? navigator.language : 'de-DE');
  
  const formatLocale = detectedLocale.startsWith('en') ? 'en-US' : 'de-DE';
  
  return new Intl.NumberFormat(formatLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
};