import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';
const apiKey = Deno.env.get('ALPHA_VANTAGE_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!apiKey) {
      console.error('ALPHA_VANTAGE_API_KEY is not configured');
      throw new Error('API key not configured. Please contact support.');
    }

    const { symbol } = await req.json();
    const cleanSymbol = String(symbol ?? '').trim().toUpperCase();
    
    if (!cleanSymbol) {
      throw new Error('Stock symbol is required');
    }

    console.log(`Fetching stock data for symbol: ${cleanSymbol}`);
    console.log(`Using API key: ${apiKey ? 'Set (length: ' + apiKey.length + ')' : 'NOT SET'}`);

    // Fetch quote data
    const quoteUrl = `${ALPHA_VANTAGE_BASE_URL}?function=GLOBAL_QUOTE&symbol=${cleanSymbol}&apikey=${apiKey}`;
    console.log('Calling Alpha Vantage API...');
    
    const quoteResponse = await fetch(quoteUrl);
    
    if (!quoteResponse.ok) {
      console.error('API request failed:', quoteResponse.status, quoteResponse.statusText);
      throw new Error(`Alpha Vantage API request failed: ${quoteResponse.status}`);
    }
    
    const quoteData = await quoteResponse.json();

    console.log('API Response received');
    console.log('Response keys:', Object.keys(quoteData));
    
    if (quoteData['Error Message']) {
      console.error('Invalid stock symbol:', cleanSymbol);
      throw new Error(`Invalid stock symbol: ${cleanSymbol}. Please verify the ticker symbol.`);
    }

    if (quoteData['Note']) {
      console.error('API rate limit exceeded');
      throw new Error('Alpha Vantage API rate limit exceeded (5 requests/minute on free tier). Please wait a minute and try again.');
    }

    let currentPrice: number | null = null;
    const quote = quoteData['Global Quote'];
    if (quote && Object.keys(quote).length > 0 && quote['05. price']) {
      currentPrice = parseFloat(quote['05. price']);
      console.log(`Current price from GLOBAL_QUOTE for ${cleanSymbol}: ${currentPrice}`);
    } else {
      console.warn('GLOBAL_QUOTE missing or empty. Falling back to TIME_SERIES_DAILY...');
      const dailyUrl = `${ALPHA_VANTAGE_BASE_URL}?function=TIME_SERIES_DAILY&symbol=${cleanSymbol}&outputsize=compact&apikey=${apiKey}`;
      const dailyResp = await fetch(dailyUrl);
      if (!dailyResp.ok) {
        console.error('TIME_SERIES_DAILY request failed:', dailyResp.status, dailyResp.statusText);
      } else {
        const dailyData = await dailyResp.json();
        if (dailyData['Note']) {
          console.error('API rate limit exceeded on fallback');
          throw new Error('Alpha Vantage API rate limit exceeded (5 requests/min). Please wait and try again.');
        }
        const series = dailyData['Time Series (Daily)'];
        if (series && typeof series === 'object') {
          const dates = Object.keys(series).sort().reverse();
          const latest = dates[0];
          const close = series[latest]?.['4. close'];
          if (close) {
            currentPrice = parseFloat(close);
            console.log(`Current price from TIME_SERIES_DAILY for ${cleanSymbol} at ${latest}: ${currentPrice}`);
          }
        }
      }
    }

    if (currentPrice === null || Number.isNaN(currentPrice)) {
      throw new Error(`No stock data available for symbol: ${cleanSymbol}. The symbol may be invalid or not supported by the API.`);
    }

    // Fetch company overview for dividend
    let dividend = 0;
    let name = cleanSymbol;
    try {
      const overviewResponse = await fetch(
        `${ALPHA_VANTAGE_BASE_URL}?function=OVERVIEW&symbol=${cleanSymbol}&apikey=${apiKey}`
      );
      if (overviewResponse.ok) {
        const overviewData = await overviewResponse.json();
        if (!overviewData['Note']) {
          if (overviewData['DividendPerShare']) {
            const dps = parseFloat(overviewData['DividendPerShare']);
            if (!Number.isNaN(dps)) dividend = dps;
          }
          if (overviewData['Name']) {
            name = overviewData['Name'];
          }
        }
      }
    } catch (e) {
      console.warn('Overview fetch failed, defaulting dividend to 0 and name to symbol');
    }

    console.log(`Dividend for ${cleanSymbol}: ${dividend}`);

    const stockData = {
      symbol: cleanSymbol,
      currentPrice,
      dividend,
      name,
    };

    return new Response(JSON.stringify(stockData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fetch-stock-data function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to fetch stock data' }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
