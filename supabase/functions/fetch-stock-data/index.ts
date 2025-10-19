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
    
    if (!symbol) {
      throw new Error('Stock symbol is required');
    }

    console.log(`Fetching stock data for symbol: ${symbol}`);
    console.log(`Using API key: ${apiKey ? 'Set (length: ' + apiKey.length + ')' : 'NOT SET'}`);

    // Fetch quote data
    const quoteUrl = `${ALPHA_VANTAGE_BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
    console.log('Calling Alpha Vantage API...');
    
    const quoteResponse = await fetch(quoteUrl);
    
    if (!quoteResponse.ok) {
      console.error('API request failed:', quoteResponse.status, quoteResponse.statusText);
      throw new Error(`Alpha Vantage API request failed: ${quoteResponse.status}`);
    }
    
    const quoteData = await quoteResponse.json();

    console.log('API Response received');
    console.log('Response keys:', Object.keys(quoteData));
    console.log('Full response:', JSON.stringify(quoteData, null, 2));

    if (quoteData['Error Message']) {
      console.error('Invalid stock symbol:', symbol);
      throw new Error(`Invalid stock symbol: ${symbol}. Please verify the ticker symbol.`);
    }

    if (quoteData['Note']) {
      console.error('API rate limit exceeded');
      throw new Error('Alpha Vantage API rate limit exceeded (5 requests/minute on free tier). Please wait a minute and try again.');
    }

    const quote = quoteData['Global Quote'];
    if (!quote || Object.keys(quote).length === 0) {
      console.error('Empty response from API for symbol:', symbol);
      console.error('Full response:', JSON.stringify(quoteData));
      throw new Error(`No stock data available for symbol: ${symbol}. The symbol may be invalid or not supported by the API.`);
    }

    if (!quote['05. price']) {
      console.error('Price data missing for symbol:', symbol);
      console.error('Available fields:', Object.keys(quote));
      throw new Error(`Price data not available for symbol: ${symbol}`);
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
