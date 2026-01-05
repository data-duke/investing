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
  source: string
): Promise<void> {
  try {
    await supabase.from('price_cache').upsert({
      symbol,
      current_price_eur: currentPriceEur,
      current_price_usd: currentPriceUsd,
      dividend_usd: dividendUsd,
      name,
      exchange_rate: exchangeRate,
      source,
      cached_at: new Date().toISOString(),
    }, { onConflict: 'symbol' });
    console.log(`✓ Cache updated for ${symbol}`);
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

async function fetchExchangeRate(): Promise<number> {
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    if (!res.ok) throw new Error('Exchange rate fetch failed');
    const data = await res.json();
    const rate = Number(data?.rates?.EUR);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('Invalid EUR rate');
    return rate;
  } catch (e) {
    console.warn('Failed to fetch live exchange rate, using fallback:', e);
    return 0.92;
  }
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
    if (trimmedSymbol.length === 0 || trimmedSymbol.length > 10) {
      throw new Error('Invalid stock symbol length');
    }

    if (!/^[A-Z0-9.:-]+$/i.test(trimmedSymbol)) {
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

    let currentPriceUSD = 0;
    let name = cleanSymbol;
    let dividendUSD = 0;
    let source = 'Unknown';

    // Prefer FMP if key is available
    if (FMP_API_KEY) {
      try {
        const fmp = await fetchFromFMP(cleanSymbol);
        currentPriceUSD = fmp.currentPrice;
        name = fmp.name || cleanSymbol;
        dividendUSD = fmp.dividend || 0;
        source = fmp.source;
      } catch (e) {
        console.warn('FMP fetch failed, falling back to Stooq:', e);
      }
    }

    // Fallback to Stooq if price is not yet set
    if (!Number.isFinite(currentPriceUSD) || currentPriceUSD <= 0) {
      const stooq = await fetchFromStooq(cleanSymbol);
      currentPriceUSD = stooq.currentPrice;
      name = stooq.name;
      dividendUSD = dividendUSD || 0;
      source = stooq.source;
    }

    if (!Number.isFinite(currentPriceUSD) || currentPriceUSD <= 0) {
      throw new Error(`No price available for symbol: ${cleanSymbol}`);
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

    // Fetch USD to EUR exchange rate
    const usdToEur = await fetchExchangeRate();
    
    // Convert prices to EUR
    const currentPrice = currentPriceUSD * usdToEur;
    const dividend = dividendUSD * usdToEur;

    console.log(`✓ Final: ${name} @ $${currentPriceUSD.toFixed(2)} (€${currentPrice.toFixed(2)}), Div: $${dividendUSD.toFixed(2)} (€${dividend.toFixed(2)}), Source: ${source}`);

    // Update cache
    await updatePriceCache(cleanSymbol, currentPrice, currentPriceUSD, dividendUSD, name, usdToEur, source);

    const stockData = { 
      symbol: cleanSymbol, 
      currentPrice, 
      dividend, 
      name,
      exchangeRate: usdToEur,
      currentPriceUSD,
      source
    };

    return new Response(JSON.stringify(stockData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Stock data fetch failed');
    return new Response(
      JSON.stringify({ error: 'Failed to fetch stock data. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
