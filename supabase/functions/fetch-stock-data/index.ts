import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FMP_API_KEY = Deno.env.get('FMP_API_KEY')?.trim();
const ALPHA_VANTAGE_API_KEY = Deno.env.get('ALPHA_VANTAGE_API_KEY')?.trim();
const FMP_BASES = [
  'https://financialmodelingprep.com/stable',
  'https://financialmodelingprep.com/api/v3'
];

async function fetchJSON(url: string, logError = true) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LovableBot/1.0; +https://lovable.dev)'
    },
  });
  if (!res.ok) {
    if (logError) {
      const body = await res.text().catch(() => 'Unable to read body');
      console.error(`HTTP ${res.status} for ${url.split('?')[0]}: ${body.substring(0, 200)}`);
    }
    throw new Error(`${url.split('?')[0]} -> ${res.status}`);
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
  if (!res.ok) throw new Error(`Alpha Vantage HTTP ${res.status}`);
  const data = await res.json();
  
  // Check for API errors or rate limits
  if (data['Note']) throw new Error(`Alpha Vantage rate limit: ${data['Note']}`);
  if (data['Information']) throw new Error(`Alpha Vantage info: ${data['Information']}`);
  if (data['Error Message']) throw new Error(`Alpha Vantage error: ${data['Error Message']}`);
  
  return data;
}

async function fetchDividendFromAV(symbol: string): Promise<{ dividend: number; name?: string }> {
  if (!ALPHA_VANTAGE_API_KEY) return { dividend: 0 };
  
  // Strategy 1: Try OVERVIEW endpoint for DividendPerShare
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
  
  // Strategy 2: Try TIME_SERIES_MONTHLY_ADJUSTED for TTM sum
  try {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=${encodeURIComponent(symbol)}&apikey=${ALPHA_VANTAGE_API_KEY}`;
    const data = await fetchAlphaJSON(url);
    
    const timeSeries = data['Monthly Adjusted Time Series'];
    if (timeSeries && typeof timeSeries === 'object') {
      const dates = Object.keys(timeSeries).sort().reverse(); // Most recent first
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
  // Strategy 1: key-metrics-ttm
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

  // Strategy 2: historical-price-full/stock_dividend
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

  // Strategy 3: ratios-ttm (dividendYieldTTM * price)
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

  // Quote for price and possibly name
  const quote = await tryFMPEndpoint(`/quote/${encodeURIComponent(symbol)}`);
  if (!Array.isArray(quote) || quote.length === 0) throw new Error('FMP quote empty');
  
  const q = quote[0];
  const currentPrice = Number(q?.price ?? q?.previousClose ?? q?.open);
  if (!Number.isFinite(currentPrice)) throw new Error('FMP price invalid');

  // Company name (quote.name is usually present, otherwise profile)
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

  // Fetch dividend with multiple fallback strategies
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

  try {
    const price = await tryOnce(symbol.toLowerCase());
    return { currentPrice: price, name: symbol, dividend: 0, source: 'Stooq' };
  } catch (_) {
    const alt = `${symbol.toLowerCase()}.us`;
    const price = await tryOnce(alt);
    return { currentPrice: price, name: symbol, dividend: 0, source: 'Stooq' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();
    const cleanSymbol = String(symbol ?? '').trim().toUpperCase();
    if (!cleanSymbol) throw new Error('Stock symbol is required');

    console.log(`\n=== Fetching ${cleanSymbol} (FMP key: ${FMP_API_KEY ? 'present' : 'absent'}) ===`);

    let currentPriceUSD = 0;
    let name = cleanSymbol;
    let dividendUSD = 0;
    let source = 'Unknown';

    // Prefer FMP if key is available for reliability + dividends
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
      dividendUSD = dividendUSD || 0; // Stooq has no dividend data
      source = stooq.source;
    }

    if (!Number.isFinite(currentPriceUSD) || currentPriceUSD <= 0) {
      throw new Error(`No price available for symbol: ${cleanSymbol}`);
    }

    // Try Alpha Vantage for dividends if we don't have them yet
    if ((!dividendUSD || dividendUSD <= 0) && ALPHA_VANTAGE_API_KEY) {
      console.log('Attempting Alpha Vantage dividend fetch...');
      const avResult = await fetchDividendFromAV(cleanSymbol);
      if (avResult.dividend > 0) {
        dividendUSD = avResult.dividend;
        // Update name if we only have the ticker and AV provided a better name
        if (avResult.name && (name === cleanSymbol || name === symbol)) {
          name = avResult.name;
        }
      }
    }

    // Fetch USD to EUR exchange rate
    const usdToEur = await fetchExchangeRate();
    
    // Convert prices to EUR
    const currentPrice = currentPriceUSD * usdToEur;
    const dividend = dividendUSD * usdToEur;

    console.log(`✓ Final: ${name} @ $${currentPriceUSD.toFixed(2)} (€${currentPrice.toFixed(2)}), Div: $${dividendUSD.toFixed(2)} (€${dividend.toFixed(2)}), Source: ${source}`);

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
    console.error('Error in fetch-stock-data function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to fetch stock data' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
