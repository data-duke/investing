import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FMP_API_KEY = Deno.env.get('FMP_API_KEY')?.trim();
const ALPHA_VANTAGE_API_KEY = Deno.env.get('ALPHA_VANTAGE_API_KEY')?.trim();
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const FMP_BASES = [
  'https://financialmodelingprep.com/stable',
  'https://financialmodelingprep.com/api/v3'
];

// Cache TTL in minutes
const CACHE_TTL_MINUTES = 15;
const CAGR_CACHE_HOURS = 24;

// In-memory dividend cache with 24h TTL (for edge function runtime)
const dividendCache = new Map<string, { dividendUSD: number; cachedAt: number }>();
const DIVIDEND_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Create Supabase client for cache operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkPriceCache(symbol: string): Promise<{
  currentPrice: number;
  currentPriceUSD: number;
  dividend: number;
  name: string;
  exchangeRate: number;
  source: string;
  cagr5y?: number;
} | null> {
  try {
    const { data, error } = await supabase
      .from('price_cache')
      .select('*')
      .eq('symbol', symbol)
      .single();

    if (error || !data) return null;

    // Check if cache is still valid (15 minutes)
    const cachedAt = new Date(data.cached_at).getTime();
    const now = Date.now();
    const ageMinutes = (now - cachedAt) / (1000 * 60);

    if (ageMinutes > CACHE_TTL_MINUTES) {
      console.log(`Cache expired for ${symbol} (${ageMinutes.toFixed(1)} min old)`);
      return null;
    }

    console.log(`✓ Cache hit for ${symbol} (${ageMinutes.toFixed(1)} min old)`);
    return {
      currentPrice: Number(data.current_price_eur),
      currentPriceUSD: Number(data.current_price_usd),
      dividend: Number(data.dividend_usd) * Number(data.exchange_rate),
      name: data.name || symbol,
      exchangeRate: Number(data.exchange_rate),
      source: `${data.source} (cached)`,
      cagr5y: data.cagr_5y ? Number(data.cagr_5y) : undefined,
    };
  } catch (e) {
    console.warn('Cache check failed:', e);
    return null;
  }
}

async function updatePriceCache(
  symbol: string,
  currentPriceEur: number,
  currentPriceUsd: number,
  dividendUsd: number,
  name: string,
  exchangeRate: number,
  source: string,
  sourceCurrency: string = 'USD',
  cagr5y?: number,
  dividendGrowth?: { growth1y?: number; growth3y?: number; growth5y?: number }
): Promise<void> {
  try {
    const updateData: any = {
      symbol,
      current_price_eur: currentPriceEur,
      current_price_usd: currentPriceUsd,
      dividend_usd: dividendUsd,
      name,
      exchange_rate: exchangeRate,
      source,
      source_currency: sourceCurrency,
      cached_at: new Date().toISOString(),
    };
    
    if (cagr5y !== undefined) {
      updateData.cagr_5y = cagr5y;
      updateData.cagr_calculated_at = new Date().toISOString();
    }
    
    if (dividendGrowth) {
      if (dividendGrowth.growth1y !== undefined) updateData.dividend_growth_1y = dividendGrowth.growth1y;
      if (dividendGrowth.growth3y !== undefined) updateData.dividend_growth_3y = dividendGrowth.growth3y;
      if (dividendGrowth.growth5y !== undefined) updateData.dividend_growth_5y = dividendGrowth.growth5y;
    }
    
    await supabase.from('price_cache').upsert(updateData, { onConflict: 'symbol' });
    console.log(`✓ Cache updated for ${symbol} (${sourceCurrency})`);
  } catch (e) {
    console.warn('Cache update failed:', e);
  }
}

async function fetchJSON(url: string, logError = true) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LovableBot/1.0; +https://lovable.dev)'
    },
  });
  if (!res.ok) {
    if (logError) {
      console.error(`HTTP ${res.status} for external API request`);
    }
    throw new Error(`External API request failed with status ${res.status}`);
  }
  return res.json();
}

// Supported currencies and their conversion rates to EUR
type CurrencyCode = 'USD' | 'HKD' | 'GBP' | 'CAD' | 'CHF' | 'EUR';

interface ExchangeRates {
  USD: number;
  HKD: number;
  GBP: number;
  CAD: number;
  CHF: number;
  EUR: number;
}

// Detect currency from stock symbol suffix (for sources like Stooq that don't provide currency)
function detectCurrencyFromSymbol(symbol: string): CurrencyCode {
  const upper = symbol.toUpperCase();
  if (upper.endsWith('.HK')) return 'HKD';
  if (upper.endsWith('.L')) return 'GBP';
  if (upper.endsWith('.TO') || upper.endsWith('.V')) return 'CAD';
  if (upper.endsWith('.SW') || upper.endsWith('.VX')) return 'CHF';
  if (upper.endsWith('.DE') || upper.endsWith('.F') || upper.endsWith('.MU')) return 'EUR';
  if (upper.endsWith('.PA') || upper.endsWith('.AS') || upper.endsWith('.MI')) return 'EUR';
  return 'USD'; // Default for US stocks
}

async function fetchExchangeRates(): Promise<ExchangeRates> {
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
    if (!res.ok) throw new Error('Exchange rate fetch failed');
    const data = await res.json();
    
    // API returns rates FROM EUR, we need rates TO EUR (1/rate)
    return {
      USD: 1 / Number(data?.rates?.USD || 1.09),
      HKD: 1 / Number(data?.rates?.HKD || 8.5),
      GBP: 1 / Number(data?.rates?.GBP || 0.86),
      CAD: 1 / Number(data?.rates?.CAD || 1.48),
      CHF: 1 / Number(data?.rates?.CHF || 0.95),
      EUR: 1, // Already EUR
    };
  } catch (e) {
    console.warn('Failed to fetch live exchange rates, using fallbacks:', e);
    return {
      USD: 0.92,
      HKD: 0.118,
      GBP: 1.16,
      CAD: 0.68,
      CHF: 1.05,
      EUR: 1,
    };
  }
}

async function fetchExchangeRate(): Promise<number> {
  const rates = await fetchExchangeRates();
  return rates.USD;
}

async function fetchAlphaJSON(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('External API request failed');
  const data = await res.json();
  
  if (data['Note'] || data['Information'] || data['Error Message']) {
    throw new Error('External API rate limit or error');
  }
  
  return data;
}

async function fetchDividendFromAV(symbol: string): Promise<{ dividend: number; name?: string }> {
  if (!ALPHA_VANTAGE_API_KEY) return { dividend: 0 };
  
  try {
    const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${ALPHA_VANTAGE_API_KEY}`;
    const data = await fetchAlphaJSON(url);
    
    const dps = Number(data.DividendPerShare);
    const name = data.Name || undefined;
    
    if (Number.isFinite(dps) && dps > 0) {
      console.log(`✓ Dividend from Alpha Vantage OVERVIEW: $${dps.toFixed(2)}`);
      return { dividend: dps, name };
    }
  } catch (e) {
    console.log('Alpha Vantage OVERVIEW failed:', (e as Error).message);
  }
  
  try {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=${encodeURIComponent(symbol)}&apikey=${ALPHA_VANTAGE_API_KEY}`;
    const data = await fetchAlphaJSON(url);
    
    const timeSeries = data['Monthly Adjusted Time Series'];
    if (timeSeries && typeof timeSeries === 'object') {
      const dates = Object.keys(timeSeries).sort().reverse();
      let ttmDividend = 0;
      
      for (let i = 0; i < Math.min(12, dates.length); i++) {
        const monthData = timeSeries[dates[i]];
        const divAmount = Number(monthData['7. dividend amount']);
        if (Number.isFinite(divAmount)) {
          ttmDividend += divAmount;
        }
      }
      
      if (ttmDividend > 0) {
        console.log(`✓ Dividend from Alpha Vantage TIME_SERIES (TTM sum): $${ttmDividend.toFixed(2)}`);
        return { dividend: ttmDividend };
      }
    }
  } catch (e) {
    console.log('Alpha Vantage TIME_SERIES_MONTHLY_ADJUSTED failed:', (e as Error).message);
  }
  
  console.log('Alpha Vantage dividend fetch returned 0');
  return { dividend: 0 };
}

// Fetch historical dividends and calculate growth rates
async function fetchDividendGrowth(symbol: string): Promise<{
  growth1y?: number;
  growth3y?: number;
  growth5y?: number;
}> {
  try {
    // First check if we have cached growth data
    const { data: cached } = await supabase
      .from('price_cache')
      .select('dividend_growth_1y, dividend_growth_3y, dividend_growth_5y')
      .eq('symbol', symbol)
      .single();
    
    if (cached && (cached.dividend_growth_1y !== null || cached.dividend_growth_5y !== null)) {
      console.log(`✓ Using cached dividend growth for ${symbol}`);
      return {
        growth1y: cached.dividend_growth_1y ? Number(cached.dividend_growth_1y) : undefined,
        growth3y: cached.dividend_growth_3y ? Number(cached.dividend_growth_3y) : undefined,
        growth5y: cached.dividend_growth_5y ? Number(cached.dividend_growth_5y) : undefined,
      };
    }
    
    // Try to fetch historical dividend data from Yahoo Finance
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (6 * 365 * 24 * 60 * 60); // 6 years ago
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${startDate}&period2=${endDate}&interval=1mo&events=div`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LovableBot/1.0)' }
    });
    
    if (!res.ok) return {};
    
    const data = await res.json();
    const events = data.chart?.result?.[0]?.events?.dividends;
    
    if (!events || Object.keys(events).length < 2) {
      console.log(`No dividend history for ${symbol}`);
      return {};
    }
    
    // Group dividends by year
    const dividendsByYear: Record<number, number> = {};
    Object.values(events).forEach((div: any) => {
      const year = new Date(div.date * 1000).getFullYear();
      dividendsByYear[year] = (dividendsByYear[year] || 0) + (div.amount || 0);
    });
    
    const years = Object.keys(dividendsByYear).map(Number).sort();
    const currentYear = new Date().getFullYear();
    
    // Store historical data in dividend_history table
    for (const year of years) {
      const prevYear = year - 1;
      const growth = dividendsByYear[prevYear] && dividendsByYear[prevYear] > 0
        ? (dividendsByYear[year] - dividendsByYear[prevYear]) / dividendsByYear[prevYear]
        : null;
      
      await supabase.from('dividend_history').upsert({
        symbol,
        year,
        annual_dividend_usd: dividendsByYear[year],
        dividend_growth_yoy: growth,
      }, { onConflict: 'symbol,year' });
    }
    
    // Calculate growth rates
    let growth1y: number | undefined;
    let growth3y: number | undefined;
    let growth5y: number | undefined;
    
    const lastYear = currentYear - 1;
    const twoYearsAgo = currentYear - 2;
    const threeYearsAgo = currentYear - 3;
    const fiveYearsAgo = currentYear - 5;
    
    // 1-year growth
    if (dividendsByYear[lastYear] && dividendsByYear[twoYearsAgo] && dividendsByYear[twoYearsAgo] > 0) {
      growth1y = (dividendsByYear[lastYear] - dividendsByYear[twoYearsAgo]) / dividendsByYear[twoYearsAgo];
    }
    
    // 3-year CAGR
    if (dividendsByYear[lastYear] && dividendsByYear[threeYearsAgo] && dividendsByYear[threeYearsAgo] > 0) {
      growth3y = Math.pow(dividendsByYear[lastYear] / dividendsByYear[threeYearsAgo], 1/3) - 1;
    }
    
    // 5-year CAGR
    if (dividendsByYear[lastYear] && dividendsByYear[fiveYearsAgo] && dividendsByYear[fiveYearsAgo] > 0) {
      growth5y = Math.pow(dividendsByYear[lastYear] / dividendsByYear[fiveYearsAgo], 1/5) - 1;
    }
    
    console.log(`✓ Dividend growth for ${symbol}: 1Y=${growth1y ? (growth1y * 100).toFixed(1) : 'N/A'}%, 5Y=${growth5y ? (growth5y * 100).toFixed(1) : 'N/A'}%`);
    
    return { growth1y, growth3y, growth5y };
  } catch (e) {
    console.log('Dividend growth calculation failed:', (e as Error).message);
    return {};
  }
}

async function tryFMPEndpoint(endpoint: string): Promise<any> {
  if (!FMP_API_KEY) throw new Error('FMP key missing');
  
  let lastError: Error | null = null;
  for (const base of FMP_BASES) {
    try {
      const url = `${base}${endpoint}?apikey=${FMP_API_KEY}`;
      const data = await fetchJSON(url, false);
      console.log(`✓ FMP success: ${base}${endpoint.split('?')[0]}`);
      return data;
    } catch (e) {
      lastError = e as Error;
    }
  }
  throw lastError || new Error('All FMP bases failed');
}

async function fetchDividendFromFMP(symbol: string, currentPrice: number): Promise<number> {
  try {
    const metrics = await tryFMPEndpoint(`/key-metrics-ttm/${encodeURIComponent(symbol)}`);
    const dps = Number(metrics?.[0]?.dividendPerShareTTM);
    if (Number.isFinite(dps) && dps > 0) {
      console.log(`✓ Dividend from key-metrics-ttm: ${dps}`);
      return dps;
    }
  } catch (e) {
    console.log('Strategy 1 (key-metrics-ttm) failed:', (e as Error).message);
  }

  try {
    const divHistory = await tryFMPEndpoint(`/historical-price-full/stock_dividend/${encodeURIComponent(symbol)}`);
    if (divHistory?.historical && Array.isArray(divHistory.historical)) {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const recentDividends = divHistory.historical.filter((d: any) => {
        const divDate = new Date(d.date);
        return divDate >= oneYearAgo;
      });
      
      const totalDiv = recentDividends.reduce((sum: number, d: any) => {
        const amount = Number(d.dividend || d.cashAmount || 0);
        return sum + amount;
      }, 0);
      
      if (totalDiv > 0) {
        console.log(`✓ Dividend from stock_dividend history (365d sum): ${totalDiv}`);
        return totalDiv;
      }
    }
  } catch (e) {
    console.log('Strategy 2 (stock_dividend) failed:', (e as Error).message);
  }

  try {
    const ratios = await tryFMPEndpoint(`/ratios-ttm/${encodeURIComponent(symbol)}`);
    const yieldTTM = Number(ratios?.[0]?.dividendYieldTTM);
    if (Number.isFinite(yieldTTM) && yieldTTM > 0) {
      const estimatedDiv = yieldTTM * currentPrice;
      console.log(`✓ Dividend from ratios-ttm (yield ${yieldTTM} * price): ${estimatedDiv}`);
      return estimatedDiv;
    }
  } catch (e) {
    console.log('Strategy 3 (ratios-ttm) failed:', (e as Error).message);
  }

  console.log('All dividend strategies failed, returning 0');
  return 0;
}

// Calculate 5-year CAGR from Yahoo Finance historical prices
async function calculateCAGRFromYahoo(symbol: string): Promise<number | undefined> {
  try {
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (5 * 365 * 24 * 60 * 60); // 5 years ago
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${startDate}&period2=${endDate}&interval=1mo`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LovableBot/1.0)' }
    });
    
    if (!res.ok) return undefined;
    
    const data = await res.json();
    const prices = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    const timestamps = data.chart?.result?.[0]?.timestamp;
    
    if (!prices || prices.length < 2 || !timestamps || timestamps.length < 2) return undefined;
    
    // Find first valid price and last valid price
    let oldestPrice: number | null = null;
    let oldestTimestamp: number | null = null;
    let latestPrice: number | null = null;
    
    for (let i = 0; i < prices.length; i++) {
      if (prices[i] != null && prices[i] > 0) {
        if (oldestPrice === null) {
          oldestPrice = prices[i];
          oldestTimestamp = timestamps[i];
        }
        latestPrice = prices[i];
      }
    }
    
    if (!oldestPrice || !latestPrice || !oldestTimestamp) return undefined;
    
    const yearsDiff = (Date.now() / 1000 - oldestTimestamp) / (365.25 * 24 * 60 * 60);
    if (yearsDiff < 1) return undefined;
    
    const cagr = Math.pow(latestPrice / oldestPrice, 1 / yearsDiff) - 1;
    
    // Sanity check: CAGR should be between -50% and +100%
    if (cagr >= -0.5 && cagr <= 1.0) {
      console.log(`✓ CAGR from Yahoo: ${(cagr * 100).toFixed(2)}% over ${yearsDiff.toFixed(1)} years`);
      return cagr;
    }
  } catch (e) {
    console.log('Yahoo CAGR calculation failed:', (e as Error).message);
  }
  return undefined;
}

// Calculate 5-year CAGR from historical prices
async function calculateCAGR(symbol: string, currentPrice: number): Promise<number | undefined> {
  // Try FMP first
  try {
    if (FMP_API_KEY) {
      const historical = await tryFMPEndpoint(`/historical-price-full/${encodeURIComponent(symbol)}`);
      if (historical?.historical && Array.isArray(historical.historical) && historical.historical.length > 0) {
        // Get price from ~5 years ago
        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
        
        // Historical data is sorted descending (newest first)
        const sorted = historical.historical.sort((a: any, b: any) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        
        // Find the closest price to 5 years ago
        let oldPrice: number | null = null;
        let oldDate: Date | null = null;
        
        for (const entry of sorted) {
          const entryDate = new Date(entry.date);
          if (entryDate <= fiveYearsAgo && entry.close) {
            oldPrice = Number(entry.close);
            oldDate = entryDate;
            break;
          }
        }
        
        // If no data from 5 years ago, use the oldest available
        if (!oldPrice && sorted.length > 0) {
          const oldest = sorted[0];
          if (oldest.close) {
            oldPrice = Number(oldest.close);
            oldDate = new Date(oldest.date);
          }
        }
        
        if (oldPrice && oldDate && oldPrice > 0) {
          const yearsDiff = (Date.now() - oldDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
          if (yearsDiff >= 1) {
            const cagr = Math.pow(currentPrice / oldPrice, 1 / yearsDiff) - 1;
            // Sanity check: CAGR should be between -50% and +100%
            if (cagr >= -0.5 && cagr <= 1.0) {
              console.log(`✓ CAGR from FMP: ${(cagr * 100).toFixed(2)}% over ${yearsDiff.toFixed(1)} years`);
              return cagr;
            }
          }
        }
      }
    }
  } catch (e) {
    console.log('FMP CAGR calculation failed:', (e as Error).message);
  }
  
  // Fallback to Yahoo Finance
  const yahooCagr = await calculateCAGRFromYahoo(symbol);
  if (yahooCagr !== undefined) {
    return yahooCagr;
  }
  
  return undefined;
}

async function fetchFromFMP(symbol: string) {
  if (!FMP_API_KEY) throw new Error('FMP key missing');

  const quote = await tryFMPEndpoint(`/quote/${encodeURIComponent(symbol)}`);
  if (!Array.isArray(quote) || quote.length === 0) throw new Error('FMP quote empty');
  
  const q = quote[0];
  const currentPrice = Number(q?.price ?? q?.previousClose ?? q?.open);
  if (!Number.isFinite(currentPrice)) throw new Error('FMP price invalid');

  let name: string = q?.name || symbol;
  if (!name || name === symbol) {
    try {
      const profile = await tryFMPEndpoint(`/profile/${encodeURIComponent(symbol)}`);
      if (Array.isArray(profile) && profile[0]?.companyName) {
        name = profile[0].companyName;
      }
    } catch (_) {
      console.log('Profile fetch failed, using symbol as name');
    }
  }

  const dividend = await fetchDividendFromFMP(symbol, currentPrice);

  return { currentPrice, name, dividend, source: 'FMP' };
}

async function fetchFromStooq(symbol: string) {
  const tryOnce = async (sym: string) => {
    const url = `https://stooq.com/q/l/?s=${encodeURIComponent(sym)}&f=sd2t2ohlcv&h&e=csv`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Stooq request failed: ${res.status}`);
    const csv = await res.text();
    const lines = csv.trim().split(/\r?\n/);
    if (lines.length < 2) throw new Error('Stooq CSV empty');
    const headers = lines[0].split(',').map(s => s.trim().toLowerCase());
    const values = lines[1].split(',').map(s => s.trim());
    const idx = headers.indexOf('close');
    if (idx === -1) throw new Error('Stooq CSV missing close');
    const closeStr = values[idx];
    if (!closeStr || closeStr === 'N/D') throw new Error('Stooq close N/D');
    const price = Number(closeStr);
    if (!Number.isFinite(price)) throw new Error('Stooq price invalid');
    return price;
  };

  const symbolVariants = [
    symbol.toLowerCase(),
    `${symbol.toLowerCase()}.us`,
    symbol.replace('-', '.').toLowerCase(),
    `${symbol.replace('-', '.').toLowerCase()}.us`,
    symbol.replace('.', '-').toLowerCase(),
    `${symbol.replace('.', '-').toLowerCase()}.us`,
  ];
  
  const uniqueVariants = [...new Set(symbolVariants)];

  for (const variant of uniqueVariants) {
    try {
      const price = await tryOnce(variant);
      console.log(`✓ Stooq success with variant: ${variant}`);
      return { currentPrice: price, name: symbol, dividend: 0, source: 'Stooq' };
    } catch (_) {
      continue;
    }
  }
  
  throw new Error(`Stooq: No valid price found for ${symbol} (tried: ${uniqueVariants.join(', ')})`);
}

// Yahoo Finance fallback for OTC and international stocks
async function fetchFromYahoo(symbol: string) {
  const trySymbol = async (sym: string) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LovableBot/1.0)'
      }
    });
    if (!res.ok) throw new Error(`Yahoo request failed: ${res.status}`);
    const data = await res.json();
    
    const result = data?.chart?.result?.[0];
    if (!result) throw new Error('Yahoo: No result');
    
    const meta = result.meta;
    const price = meta?.regularMarketPrice || meta?.previousClose;
    if (!Number.isFinite(price) || price <= 0) throw new Error('Yahoo: Invalid price');
    
    return {
      currentPrice: price,
      name: meta?.shortName || meta?.longName || sym,
      dividend: 0, // Yahoo doesn't provide dividend in chart API
      source: 'Yahoo',
      currency: meta?.currency || 'USD'
    };
  };

  // Try different symbol formats for OTC stocks
  const symbolVariants = [
    symbol,
    `${symbol}.PK`, // Pink sheets
    `${symbol}.OB`, // OTC Bulletin Board  
    `${symbol}.F`,  // Frankfurt
    `${symbol}.L`,  // London
    `${symbol}.TO`, // Toronto
    `${symbol}.HK`, // Hong Kong
  ];

  for (const variant of symbolVariants) {
    try {
      const result = await trySymbol(variant);
      console.log(`✓ Yahoo success with variant: ${variant}`);
      return result;
    } catch (_) {
      continue;
    }
  }
  
  throw new Error(`Yahoo: No valid price found for ${symbol}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, force_refresh } = await req.json();

    if (!symbol || typeof symbol !== 'string') {
      throw new Error('Stock symbol is required');
    }

    const trimmedSymbol = symbol.trim();
    if (trimmedSymbol.length === 0 || trimmedSymbol.length > 15) {
      throw new Error('Invalid stock symbol length');
    }

    // Allow letters, numbers, dots, dashes, colons for international symbols
    if (!/^[A-Z0-9.:\-]+$/i.test(trimmedSymbol)) {
      throw new Error('Invalid stock symbol format');
    }

    const cleanSymbol = trimmedSymbol.toUpperCase();

    console.log(`Fetching stock data for ${cleanSymbol}${force_refresh ? ' (force refresh)' : ''}`);

    // Check cache first (unless force refresh)
    if (!force_refresh) {
      const cached = await checkPriceCache(cleanSymbol);
      if (cached) {
        return new Response(JSON.stringify({
          symbol: cleanSymbol,
          ...cached,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    let currentPriceLocal = 0;  // Price in source currency
    let sourceCurrency: CurrencyCode = 'USD';
    let name = cleanSymbol;
    let dividendUSD = 0;
    let source = 'Unknown';
    const triedSources: string[] = [];

    // Prefer FMP if key is available (returns USD)
    if (FMP_API_KEY) {
      try {
        triedSources.push('FMP');
        const fmp = await fetchFromFMP(cleanSymbol);
        currentPriceLocal = fmp.currentPrice;
        name = fmp.name || cleanSymbol;
        dividendUSD = fmp.dividend || 0;
        source = fmp.source;
        sourceCurrency = 'USD';
      } catch (e) {
        console.warn('FMP fetch failed:', (e as Error).message);
      }
    }

    // Fallback to Stooq if price is not yet set (returns local currency prices)
    if (!Number.isFinite(currentPriceLocal) || currentPriceLocal <= 0) {
      try {
        triedSources.push('Stooq');
        const stooq = await fetchFromStooq(cleanSymbol);
        currentPriceLocal = stooq.currentPrice;
        name = stooq.name;
        dividendUSD = dividendUSD || 0;
        source = stooq.source;
        // Stooq doesn't provide currency metadata - detect from symbol suffix
        sourceCurrency = detectCurrencyFromSymbol(cleanSymbol);
        console.log(`Stooq: Detected currency ${sourceCurrency} for ${cleanSymbol}`);
      } catch (e) {
        console.warn('Stooq fetch failed:', (e as Error).message);
      }
    }

    // Fallback to Yahoo Finance for OTC/international stocks (can return various currencies)
    if (!Number.isFinite(currentPriceLocal) || currentPriceLocal <= 0) {
      try {
        triedSources.push('Yahoo');
        const yahoo = await fetchFromYahoo(cleanSymbol);
        currentPriceLocal = yahoo.currentPrice;
        name = yahoo.name;
        dividendUSD = dividendUSD || 0;
        source = yahoo.source;
        // Map Yahoo currency to our supported currencies
        const yahooCurrency = yahoo.currency?.toUpperCase() || 'USD';
        sourceCurrency = ['USD', 'HKD', 'GBP', 'CAD', 'CHF', 'EUR'].includes(yahooCurrency) 
          ? yahooCurrency as CurrencyCode 
          : 'USD';
      } catch (e) {
        console.warn('Yahoo fetch failed:', (e as Error).message);
      }
    }

    if (!Number.isFinite(currentPriceLocal) || currentPriceLocal <= 0) {
      throw new Error(`No price available for symbol: ${cleanSymbol}. Tried: ${triedSources.join(', ')}`);
    }

    // Try Alpha Vantage for dividends if we don't have them yet
    if ((!dividendUSD || dividendUSD <= 0) && ALPHA_VANTAGE_API_KEY) {
      const cached = dividendCache.get(cleanSymbol);
      const now = Date.now();
      
      if (cached && (now - cached.cachedAt) < DIVIDEND_CACHE_TTL_MS) {
        console.log(`✓ Using in-memory cached dividend for ${cleanSymbol}: $${cached.dividendUSD.toFixed(2)}`);
        dividendUSD = cached.dividendUSD;
      } else {
        console.log('Attempting Alpha Vantage dividend fetch...');
        const avResult = await fetchDividendFromAV(cleanSymbol);
        if (avResult.dividend > 0) {
          dividendUSD = avResult.dividend;
          dividendCache.set(cleanSymbol, { dividendUSD, cachedAt: now });
          if (avResult.name && (name === cleanSymbol || name === symbol)) {
            name = avResult.name;
          }
        }
      }
    }

    // Calculate CAGR and dividend growth in parallel
    // Note: For non-USD stocks, CAGR calculation may need adjustment
    const currentPriceForCagr = sourceCurrency === 'USD' ? currentPriceLocal : currentPriceLocal;
    const [cagr5y, dividendGrowth] = await Promise.all([
      calculateCAGR(cleanSymbol, currentPriceForCagr),
      fetchDividendGrowth(cleanSymbol)
    ]);

    // Fetch all exchange rates
    const exchangeRates = await fetchExchangeRates();
    const rateToEur = exchangeRates[sourceCurrency] || exchangeRates.USD;
    
    // Convert prices to EUR using the correct currency rate
    const currentPrice = currentPriceLocal * rateToEur;
    // Store the original currency price for reference, but label it as source currency
    const currentPriceUSD = sourceCurrency === 'USD' ? currentPriceLocal : currentPriceLocal * (exchangeRates.USD / rateToEur);
    const dividend = dividendUSD * exchangeRates.USD; // Dividends are typically in USD

    console.log(`✓ Final: ${name} @ ${currentPriceLocal.toFixed(2)} ${sourceCurrency} (€${currentPrice.toFixed(2)}), Div: $${dividendUSD.toFixed(2)} (€${dividend.toFixed(2)}), CAGR: ${cagr5y ? (cagr5y * 100).toFixed(1) : 'N/A'}%, DivGrowth5Y: ${dividendGrowth.growth5y ? (dividendGrowth.growth5y * 100).toFixed(1) : 'N/A'}%, Source: ${source}`);

    // Update cache with source currency info
    await updatePriceCache(cleanSymbol, currentPrice, currentPriceUSD, dividendUSD, name, rateToEur, source, sourceCurrency, cagr5y, dividendGrowth);

    const stockData: any = { 
      symbol: cleanSymbol, 
      currentPrice, 
      dividend, 
      name,
      exchangeRate: rateToEur,
      currentPriceUSD,
      source,
      sourceCurrency,
    };
    
    if (cagr5y !== undefined) {
      stockData.cagr5y = cagr5y;
    }
    
    if (dividendGrowth.growth1y !== undefined) {
      stockData.dividendGrowth1y = dividendGrowth.growth1y;
    }
    if (dividendGrowth.growth5y !== undefined) {
      stockData.dividendGrowth5y = dividendGrowth.growth5y;
    }

    return new Response(JSON.stringify(stockData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Stock data fetch failed:', (error as Error).message);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch stock data. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});