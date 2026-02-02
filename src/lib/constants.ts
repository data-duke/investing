// Shared constants and types used across the application

export const SUPPORTED_COUNTRIES = [
  { code: "AT", name: "Austria" },
  { code: "DE", name: "Germany" },
  { code: "US", name: "United States" },
  { code: "UK", name: "United Kingdom" },
  { code: "CH", name: "Switzerland" },
  { code: "RS", name: "Serbia" },
  { code: "CA", name: "Canada" },
] as const;

export type CountryCode = typeof SUPPORTED_COUNTRIES[number]['code'];

// Simplified tax rates for the quick calculator
// The full portfolio tracker uses comprehensive cross-border tax calculations from taxCalculations.ts
export const COUNTRY_TAX_RATES = {
  AT: { name: "Austria", dividendTax: 0.275, capitalGainsTax: 0.275 },
  DE: { name: "Germany", dividendTax: 0.26375, capitalGainsTax: 0.26375 },
  US: { name: "United States", dividendTax: 0.15, capitalGainsTax: 0.20 },
  UK: { name: "United Kingdom", dividendTax: 0.125, capitalGainsTax: 0.20 },
  CH: { name: "Switzerland", dividendTax: 0.35, capitalGainsTax: 0 },
  RS: { name: "Serbia", dividendTax: 0.15, capitalGainsTax: 0.15 },
  CA: { name: "Canada", dividendTax: 0.39, capitalGainsTax: 0.25 },
} as const;

// Subscription limits
export const FREE_TIER_PORTFOLIO_LIMIT = 3;
export const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

// Cache TTL for prices
export const PRICE_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Max concurrent API requests
export const MAX_CONCURRENT_REQUESTS = 5;

// Maximum tags per stock
export const MAX_TAGS_PER_STOCK = 5;

// Share expiration options
export const SHARE_EXPIRATION_OPTIONS = [
  { label: '1 hour', value: 1 },
  { label: '24 hours', value: 24 },
  { label: '7 days', value: 24 * 7 },
  { label: '30 days', value: 24 * 30 },
] as const;

// Aggregated position interface - single source of truth
export interface AggregatedPosition {
  symbol: string;
  name: string;
  country: string;
  totalQuantity: number;
  totalOriginalInvestment: number;
  avgOriginalPrice: number;
  current_price_eur?: number;
  current_value_eur?: number;
  gain_loss_eur?: number;
  gain_loss_percent?: number;
  dividend_annual_eur?: number;
  lots: Array<{
    id: string;
    symbol: string;
    name: string;
    country: string;
    quantity: number;
    original_price_eur: number;
    original_investment_eur: number;
    purchase_date: string;
    current_price_eur?: number;
    current_value_eur?: number;
    gain_loss_eur?: number;
    gain_loss_percent?: number;
    dividend_annual_eur?: number;
    manual_dividend_eur?: number;
    dividend_last_fetched?: string;
    exchange_suffix?: string;
    tag?: string;
    tags?: string[];
    auto_tag_date?: string;
  }>;
}

// Popular stocks for quick suggestions
export const POPULAR_STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
] as const;
