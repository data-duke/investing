import { corsHeaders } from '../_shared/cors.ts';

interface ScrapedStockData {
  symbol: string;
  currentPrice: number;
  dividend: number;
  name: string;
  source: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();
    
    if (!symbol) {
      throw new Error('Symbol is required');
    }

    console.log(`Attempting to scrape data for ${symbol}`);
    
    // Try Yahoo Finance first
    const yahooData = await scrapeYahooFinance(symbol);
    
    return new Response(
      JSON.stringify(yahooData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Scraping error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function scrapeYahooFinance(symbol: string): Promise<ScrapedStockData> {
  try {
    // Yahoo Finance uses different symbols for European exchanges
    const yahooSymbol = formatYahooSymbol(symbol);
    const url = `https://finance.yahoo.com/quote/${yahooSymbol}`;
    
    console.log(`Fetching Yahoo Finance: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance returned ${response.status}`);
    }

    const html = await response.text();
    
    // Extract stock name
    const nameMatch = html.match(/<h1[^>]*class="[^"]*yf-[^"]*"[^>]*>([^<(]+)/i);
    const name = nameMatch ? nameMatch[1].trim() : symbol;
    
    // Extract current price - try multiple patterns
    let currentPrice = 0;
    
    // Pattern 1: data-field="regularMarketPrice"
    const priceMatch1 = html.match(/data-symbol="[^"]*"\s+data-field="regularMarketPrice"\s+data-trend="[^"]*"\s+data-pricehint="\d+"\s+value="([^"]+)"/i);
    if (priceMatch1) {
      currentPrice = parseFloat(priceMatch1[1]);
    }
    
    // Pattern 2: "regularMarketPrice":{"raw":
    if (!currentPrice) {
      const priceMatch2 = html.match(/"regularMarketPrice":\{"raw":([0-9.]+)/i);
      if (priceMatch2) {
        currentPrice = parseFloat(priceMatch2[1]);
      }
    }
    
    // Pattern 3: Look for price in fin-streamer with data-field
    if (!currentPrice) {
      const priceMatch3 = html.match(/data-field="regularMarketPrice"[^>]*value="([^"]+)"/i);
      if (priceMatch3) {
        currentPrice = parseFloat(priceMatch3[1]);
      }
    }

    if (!currentPrice) {
      throw new Error('Could not extract current price from Yahoo Finance');
    }

    // Extract dividend - try multiple patterns
    let dividend = 0;
    
    // Pattern 1: "trailingAnnualDividendRate":{"raw":
    const divMatch1 = html.match(/"trailingAnnualDividendRate":\{"raw":([0-9.]+)/i);
    if (divMatch1) {
      dividend = parseFloat(divMatch1[1]);
    }
    
    // Pattern 2: data-test="DIVIDEND_AND_YIELD-value"
    if (!dividend) {
      const divMatch2 = html.match(/data-test="DIVIDEND_AND_YIELD-value"[^>]*>([0-9.]+)/i);
      if (divMatch2) {
        dividend = parseFloat(divMatch2[1]);
      }
    }

    console.log(`Successfully scraped ${symbol}: Price=${currentPrice}, Dividend=${dividend}`);

    return {
      symbol,
      currentPrice,
      dividend,
      name,
      source: 'yahoo_scrape'
    };
  } catch (error) {
    console.error(`Yahoo Finance scraping failed for ${symbol}:`, error);
    throw error;
  }
}

function formatYahooSymbol(symbol: string): string {
  // Common European exchange suffixes
  const exchangeMap: Record<string, string> = {
    'XETRA': '.DE',
    'FRA': '.F',
    'EPA': '.PA',
    'LON': '.L',
    'AMS': '.AS',
    'SWX': '.SW',
    'BIT': '.MI'
  };
  
  // If symbol already has an exchange suffix, use as-is
  if (symbol.includes('.')) {
    return symbol;
  }
  
  // Check if it's a known exchange symbol format
  for (const [exchange, suffix] of Object.entries(exchangeMap)) {
    if (symbol.includes(exchange)) {
      return symbol.replace(exchange, suffix);
    }
  }
  
  // Default: assume US stock (no suffix needed)
  return symbol;
}
