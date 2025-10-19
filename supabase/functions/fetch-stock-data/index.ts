import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';
const apiKey = Deno.env.get('ALPHA_VANTAGE_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();
    
    if (!symbol) {
      throw new Error('Stock symbol is required');
    }

    console.log(`Fetching stock data for symbol: ${symbol}`);

    // Fetch quote data
    const quoteResponse = await fetch(
      `${ALPHA_VANTAGE_BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`
    );
    const quoteData = await quoteResponse.json();

    if (quoteData['Error Message']) {
      console.error('Invalid stock symbol:', symbol);
      throw new Error('Invalid stock symbol');
    }

    if (quoteData['Note']) {
      console.error('API rate limit exceeded');
      throw new Error('API rate limit exceeded. Please wait a minute.');
    }

    const quote = quoteData['Global Quote'];
    if (!quote || !quote['05. price']) {
      console.error('Stock data not found for symbol:', symbol);
      throw new Error('Stock data not found');
    }

    const currentPrice = parseFloat(quote['05. price']);
    console.log(`Current price for ${symbol}: ${currentPrice}`);

    // Fetch company overview for dividend
    const overviewResponse = await fetch(
      `${ALPHA_VANTAGE_BASE_URL}?function=OVERVIEW&symbol=${symbol}&apikey=${apiKey}`
    );
    const overviewData = await overviewResponse.json();

    const dividend = overviewData['DividendPerShare'] 
      ? parseFloat(overviewData['DividendPerShare']) 
      : 0;

    console.log(`Dividend for ${symbol}: ${dividend}`);

    const stockData = {
      symbol: symbol.toUpperCase(),
      currentPrice,
      dividend,
      name: overviewData['Name'] || symbol.toUpperCase(),
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
