import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FMP_API_KEY = Deno.env.get('FMP_API_KEY')?.trim();
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Cache TTL in hours
const CACHE_TTL_HOURS = 24;

interface DividendDate {
  symbol: string;
  ex_date: string;
  payment_date: string | null;
  record_date: string | null;
  declaration_date: string | null;
  dividend_amount: number;
  currency: string;
}

async function fetchDividendsFromFMP(symbol: string): Promise<DividendDate[]> {
  if (!FMP_API_KEY) {
    console.log('FMP API key not configured');
    return [];
  }

  try {
    const url = `https://financialmodelingprep.com/api/v3/historical-price-full/stock_dividend/${encodeURIComponent(symbol)}?apikey=${FMP_API_KEY}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LovableBot/1.0)' }
    });

    if (!res.ok) {
      console.log(`FMP dividend fetch failed for ${symbol}: ${res.status}`);
      return [];
    }

    const data = await res.json();
    
    if (!data?.historical || !Array.isArray(data.historical)) {
      return [];
    }

    // Get dividends from last 6 months and next 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const dividends: DividendDate[] = data.historical
      .filter((d: any) => {
        const exDate = new Date(d.date);
        return exDate >= sixMonthsAgo;
      })
      .slice(0, 12) // Limit to 12 most recent
      .map((d: any) => ({
        symbol,
        ex_date: d.date,
        payment_date: d.paymentDate || null,
        record_date: d.recordDate || null,
        declaration_date: d.declarationDate || null,
        dividend_amount: Number(d.dividend || d.adjDividend || 0),
        currency: 'USD'
      }));

    console.log(`✓ Found ${dividends.length} dividend dates for ${symbol}`);
    return dividends;
  } catch (e) {
    console.log(`Error fetching dividends for ${symbol}:`, (e as Error).message);
    return [];
  }
}

async function fetchDividendsFromYahoo(symbol: string): Promise<DividendDate[]> {
  const dividends: DividendDate[] = [];
  
  try {
    // First, try to get historical dividends from chart API (last 18 months for better pattern detection)
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (540 * 24 * 60 * 60); // 18 months ago
    
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${startDate}&period2=${endDate}&interval=1d&events=div`;
    const chartRes = await fetch(chartUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    });

    if (chartRes.ok) {
      const chartData = await chartRes.json();
      const divEvents = chartData?.chart?.result?.[0]?.events?.dividends;
      
      if (divEvents && typeof divEvents === 'object') {
        for (const key of Object.keys(divEvents)) {
          const d = divEvents[key];
          if (d && d.date && d.amount) {
            dividends.push({
              symbol,
              ex_date: new Date(d.date * 1000).toISOString().split('T')[0],
              payment_date: null,
              record_date: null,
              declaration_date: null,
              dividend_amount: Number(d.amount || 0),
              currency: 'USD'
            });
          }
        }
      }
    }
  } catch (e) {
    console.log(`Yahoo chart dividend fetch failed for ${symbol}:`, (e as Error).message);
  }
  
  // Also try to get upcoming dividend from quoteSummary
  try {
    const summaryUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=calendarEvents,summaryDetail`;
    const summaryRes = await fetch(summaryUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    });

    if (summaryRes.ok) {
      const summaryData = await summaryRes.json();
      const calendarEvents = summaryData?.quoteSummary?.result?.[0]?.calendarEvents;
      const summaryDetail = summaryData?.quoteSummary?.result?.[0]?.summaryDetail;
      
      if (calendarEvents?.exDividendDate?.fmt) {
        const exDateStr = calendarEvents.exDividendDate.fmt;
        const exDate = new Date(exDateStr);
        const now = new Date();
        
        // Only add if it's upcoming and not already in the list
        if (exDate > now && !dividends.some(d => d.ex_date === exDateStr)) {
          const dividendRate = summaryDetail?.dividendRate?.raw || 0;
          const frequency = summaryDetail?.dividendFrequency?.raw || 4;
          
          dividends.push({
            symbol,
            ex_date: exDateStr,
            payment_date: calendarEvents.dividendDate?.fmt || null,
            record_date: null,
            declaration_date: null,
            dividend_amount: dividendRate > 0 ? dividendRate / frequency : 0,
            currency: 'USD'
          });
        }
      }
    }
  } catch (e) {
    console.log(`Yahoo summary fetch failed for ${symbol}:`, (e as Error).message);
  }

  if (dividends.length > 0) {
    console.log(`✓ Found ${dividends.length} dividend(s) from Yahoo for ${symbol}`);
  }

  return dividends;
}

/**
 * Estimate upcoming dividends based on historical payment patterns
 */
function estimateUpcomingDividends(symbol: string, historicalDivs: DividendDate[]): DividendDate[] {
  if (historicalDivs.length < 2) return [];
  
  // Sort by date descending (most recent first)
  const sorted = [...historicalDivs].sort((a, b) => 
    new Date(b.ex_date).getTime() - new Date(a.ex_date).getTime()
  );
  
  const lastDiv = sorted[0];
  const secondLastDiv = sorted[1];
  
  // Calculate frequency in days
  const daysBetween = Math.round(
    (new Date(lastDiv.ex_date).getTime() - new Date(secondLastDiv.ex_date).getTime()) / (1000 * 60 * 60 * 24)
  );
  
  // Validate frequency (should be roughly quarterly=90, monthly=30, semi-annual=180, annual=365)
  if (daysBetween < 25 || daysBetween > 400) {
    console.log(`${symbol}: Unusual dividend frequency (${daysBetween} days), skipping estimation`);
    return [];
  }
  
  const now = new Date();
  const lastDate = new Date(lastDiv.ex_date);
  const upcomingDivs: DividendDate[] = [];
  
  // Project next 3 dividend dates
  for (let i = 1; i <= 3; i++) {
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + (daysBetween * i));
    
    // Only add if it's in the future and within 6 months
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
    
    if (nextDate > now && nextDate <= sixMonthsFromNow) {
      const exDateStr = nextDate.toISOString().split('T')[0];
      
      // Check if this date isn't already in historical data
      if (!historicalDivs.some(d => d.ex_date === exDateStr)) {
        // Estimate payment date (typically 2-4 weeks after ex-date)
        const paymentDate = new Date(nextDate);
        paymentDate.setDate(paymentDate.getDate() + 21); // ~3 weeks later
        
        upcomingDivs.push({
          symbol,
          ex_date: exDateStr,
          payment_date: paymentDate.toISOString().split('T')[0],
          record_date: null,
          declaration_date: null,
          dividend_amount: lastDiv.dividend_amount, // Use last known amount
          currency: lastDiv.currency
        });
      }
    }
  }
  
  if (upcomingDivs.length > 0) {
    console.log(`✓ Estimated ${upcomingDivs.length} upcoming dividend(s) for ${symbol}`);
  }
  
  return upcomingDivs;
}

async function getCachedDividends(symbols: string[]): Promise<Map<string, DividendDate[]>> {
  const result = new Map<string, DividendDate[]>();
  
  try {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - CACHE_TTL_HOURS);

    const { data, error } = await supabase
      .from('dividend_dates')
      .select('*')
      .in('symbol', symbols)
      .gte('fetched_at', cutoffTime.toISOString());

    if (error) {
      console.log('Cache fetch error:', error.message);
      return result;
    }

    if (data) {
      for (const row of data) {
        if (!result.has(row.symbol)) {
          result.set(row.symbol, []);
        }
        result.get(row.symbol)!.push({
          symbol: row.symbol,
          ex_date: row.ex_date,
          payment_date: row.payment_date,
          record_date: row.record_date,
          declaration_date: row.declaration_date,
          dividend_amount: Number(row.dividend_amount),
          currency: row.currency || 'USD'
        });
      }
    }

    return result;
  } catch (e) {
    console.log('Cache check failed:', (e as Error).message);
    return result;
  }
}

async function cacheDividends(dividends: DividendDate[]): Promise<void> {
  if (dividends.length === 0) return;

  try {
    const now = new Date().toISOString();
    const rows = dividends.map(d => ({
      symbol: d.symbol,
      ex_date: d.ex_date,
      payment_date: d.payment_date,
      record_date: d.record_date,
      declaration_date: d.declaration_date,
      dividend_amount: d.dividend_amount,
      currency: d.currency,
      fetched_at: now
    }));

    // Upsert to handle duplicates
    const { error } = await supabase
      .from('dividend_dates')
      .upsert(rows, { onConflict: 'symbol,ex_date' });

    if (error) {
      console.log('Cache update error:', error.message);
    } else {
      console.log(`✓ Cached ${dividends.length} dividend dates`);
    }
  } catch (e) {
    console.log('Cache update failed:', (e as Error).message);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbols } = await req.json();

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Symbols array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit to 50 symbols max
    const limitedSymbols = symbols.slice(0, 50).map((s: string) => s.toUpperCase());
    
    console.log(`Fetching dividend calendar for ${limitedSymbols.length} symbols`);

    // Check cache first
    const cachedDividends = await getCachedDividends(limitedSymbols);
    const cachedSymbols = new Set(cachedDividends.keys());
    const missingSymbols = limitedSymbols.filter((s: string) => !cachedSymbols.has(s));

    console.log(`Cache hits: ${cachedSymbols.size}, Missing: ${missingSymbols.length}`);

    // Fetch missing symbols
    const newDividends: DividendDate[] = [];
    
    for (const symbol of missingSymbols) {
      // Try FMP first, then Yahoo as fallback
      let divs = await fetchDividendsFromFMP(symbol);
      
      if (divs.length === 0) {
        divs = await fetchDividendsFromYahoo(symbol);
      }

      newDividends.push(...divs);
      
      // Small delay to avoid rate limiting
      if (missingSymbols.indexOf(symbol) < missingSymbols.length - 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    // Cache new dividends
    if (newDividends.length > 0) {
      await cacheDividends(newDividends);
    }

    // Combine cached and new dividends
    const allDividends: DividendDate[] = [];
    
    cachedDividends.forEach((divs) => {
      allDividends.push(...divs);
    });
    allDividends.push(...newDividends);

    // Estimate upcoming dividends from historical patterns for all symbols
    const estimatedDividends: DividendDate[] = [];
    const dividendsBySymbol = new Map<string, DividendDate[]>();
    
    // Group all dividends by symbol
    for (const div of allDividends) {
      if (!dividendsBySymbol.has(div.symbol)) {
        dividendsBySymbol.set(div.symbol, []);
      }
      dividendsBySymbol.get(div.symbol)!.push(div);
    }
    
    // Estimate upcoming for each symbol
    for (const [symbol, divs] of dividendsBySymbol) {
      const estimated = estimateUpcomingDividends(symbol, divs);
      estimatedDividends.push(...estimated);
    }
    
    // Add estimated dividends (they won't be cached, but will appear in calendar)
    allDividends.push(...estimatedDividends);

    // Sort by ex-date descending
    allDividends.sort((a, b) => 
      new Date(b.ex_date).getTime() - new Date(a.ex_date).getTime()
    );

    console.log(`✓ Returning ${allDividends.length} total dividend dates (including ${estimatedDividends.length} estimated)`);

    return new Response(
      JSON.stringify({ dividends: allDividends }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Dividend calendar fetch failed:', (error as Error).message);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch dividend calendar' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
