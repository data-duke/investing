import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();
    const cleanSymbol = String(symbol ?? '').trim().toUpperCase();

    if (!cleanSymbol) {
      throw new Error('Stock symbol is required');
    }

    console.log(`Fetching Yahoo Finance data for symbol: ${cleanSymbol}`);

    // Yahoo Finance public quote endpoint (no API key required)
    const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(cleanSymbol)}`;

    const response = await fetch(yahooUrl, {
      headers: {
        // Some environments require a UA header for Yahoo
        'User-Agent': 'Mozilla/5.0 (compatible; LovableBot/1.0; +https://lovable.dev)'
      }
    });

    if (!response.ok) {
      console.error('Yahoo quote request failed:', response.status, response.statusText);
      throw new Error(`Yahoo quote request failed: ${response.status}`);
    }

    const json = await response.json();
    const result = json?.quoteResponse?.result?.[0];

    if (!result) {
      throw new Error(`No data found for symbol: ${cleanSymbol}. Please verify the ticker symbol.`);
    }

    const priceCandidates = [
      result?.regularMarketPrice,
      result?.postMarketPrice,
      result?.preMarketPrice
    ].filter((v: number | undefined) => typeof v === 'number');

    const currentPrice = Number(priceCandidates[0]);

    if (!Number.isFinite(currentPrice)) {
      throw new Error(`No valid price available for symbol: ${cleanSymbol}`);
    }

    const name = result?.longName || result?.shortName || cleanSymbol;

    // Dividend per share: prefer trailingAnnualDividendRate
    let dividend = 0;
    const trailingRate = Number(result?.trailingAnnualDividendRate);
    const trailingYield = Number(result?.trailingAnnualDividendYield);

    if (Number.isFinite(trailingRate) && trailingRate > 0) {
      dividend = trailingRate;
    } else if (Number.isFinite(trailingYield) && trailingYield > 0) {
      // yield is decimal (e.g., 0.005 for 0.5%), convert to DPS
      dividend = trailingYield * currentPrice;
    }

    const stockData = {
      symbol: cleanSymbol,
      currentPrice,
      dividend,
      name,
    };

    console.log(`Returning data for ${cleanSymbol}: price=${currentPrice}, dividend=${dividend}, name=${name}`);

    return new Response(JSON.stringify(stockData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fetch-stock-data function (Yahoo):', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to fetch stock data' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
