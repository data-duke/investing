import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FMP_API_KEY = Deno.env.get('FMP_API_KEY');
const FMP_BASE = 'https://financialmodelingprep.com/api/v3';

async function fetchJSON(url: string) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LovableBot/1.0; +https://lovable.dev)'
    },
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function fetchExchangeRate(): Promise<number> {
  try {
    // Use exchangerate-api.com free tier for USD to EUR conversion
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    if (!res.ok) throw new Error('Exchange rate fetch failed');
    const data = await res.json();
    const rate = Number(data?.rates?.EUR);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('Invalid EUR rate');
    return rate;
  } catch (e) {
    console.warn('Failed to fetch live exchange rate, using fallback:', e);
    // Fallback rate (approximate)
    return 0.92;
  }
}

async function fetchFromFMP(symbol: string) {
  if (!FMP_API_KEY) throw new Error('FMP key missing');

  // Quote for price and possibly name
  const quote = await fetchJSON(`${FMP_BASE}/quote/${encodeURIComponent(symbol)}?apikey=${FMP_API_KEY}`);
  if (!Array.isArray(quote) || quote.length === 0) throw new Error('FMP quote empty');
  const q = quote[0];
  const currentPrice = Number(q?.price ?? q?.previousClose ?? q?.open);
  if (!Number.isFinite(currentPrice)) throw new Error('FMP price invalid');

  // Company name (quote.name is usually present, otherwise profile)
  let name: string = q?.name || symbol;
  if (!name || name === symbol) {
    const profile = await fetchJSON(`${FMP_BASE}/profile/${encodeURIComponent(symbol)}?apikey=${FMP_API_KEY}`);
    if (Array.isArray(profile) && profile[0]?.companyName) name = profile[0].companyName;
  }

  // Dividend per share TTM
  let dividend = 0;
  try {
    const metrics = await fetchJSON(`${FMP_BASE}/key-metrics-ttm/${encodeURIComponent(symbol)}?apikey=${FMP_API_KEY}`);
    const m = Array.isArray(metrics) && metrics.length > 0 ? metrics[0] : null;
    const dps = Number(m?.dividendPerShareTTM);
    if (Number.isFinite(dps) && dps > 0) dividend = dps;
  } catch (_) {
    // Ignore DPS errors, keep dividend = 0
  }

  return { currentPrice, name, dividend };
}

async function fetchFromStooq(symbol: string) {
  // Stooq free CSV quote. May require ".us" suffix for US tickers.
  const tryOnce = async (sym: string) => {
    const url = `https://stooq.com/q/l/?s=${encodeURIComponent(sym)}&f=sd2t2ohlcv&h&e=csv`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Stooq request failed: ${res.status}`);
    const csv = await res.text();
    // Expect header + one data line
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
    return { currentPrice: price, name: symbol, dividend: 0 };
  } catch (_) {
    const alt = `${symbol.toLowerCase()}.us`;
    const price = await tryOnce(alt); // let error bubble if this fails too
    return { currentPrice: price, name: symbol, dividend: 0 };
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

    console.log(`Fetching data for symbol: ${cleanSymbol} (FMP ${FMP_API_KEY ? 'present' : 'absent'})`);

    let currentPriceUSD = 0;
    let name = cleanSymbol;
    let dividendUSD = 0;

    // Prefer FMP if key is available for reliability + dividends
    if (FMP_API_KEY) {
      try {
        const fmp = await fetchFromFMP(cleanSymbol);
        currentPriceUSD = fmp.currentPrice;
        name = fmp.name || cleanSymbol;
        dividendUSD = fmp.dividend || 0;
      } catch (e) {
        console.warn('FMP fetch failed, falling back to Stooq:', e);
      }
    }

    // Fallback to Stooq (no key) if price is not yet set
    if (!Number.isFinite(currentPriceUSD) || currentPriceUSD <= 0) {
      const stooq = await fetchFromStooq(cleanSymbol);
      currentPriceUSD = stooq.currentPrice;
      name = stooq.name;
      dividendUSD = dividendUSD || 0; // Stooq has no dividend data
    }

    if (!Number.isFinite(currentPriceUSD) || currentPriceUSD <= 0) {
      throw new Error(`No price available for symbol: ${cleanSymbol}`);
    }

    // Fetch USD to EUR exchange rate
    const usdToEur = await fetchExchangeRate();
    
    // Convert prices to EUR
    const currentPrice = currentPriceUSD * usdToEur;
    const dividend = dividendUSD * usdToEur;

    const stockData = { 
      symbol: cleanSymbol, 
      currentPrice, 
      dividend, 
      name,
      exchangeRate: usdToEur,
      currentPriceUSD 
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
