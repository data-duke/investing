import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALPHA_VANTAGE_API_KEY = Deno.env.get('ALPHA_VANTAGE_API_KEY')?.trim();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();

    // Validate symbol
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

    if (!ALPHA_VANTAGE_API_KEY) {
      throw new Error('Alpha Vantage API key not configured');
    }

    console.log(`Fetching news for symbol: ${trimmedSymbol}`);

    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${encodeURIComponent(trimmedSymbol)}&apikey=${ALPHA_VANTAGE_API_KEY}&limit=5`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status}`);
    }

    const data = await response.json();

    // Check for API errors (rate limits, etc.)
    if (data['Note'] || data['Information']) {
      console.warn('Alpha Vantage API message:', data['Note'] || data['Information']);
      return new Response(JSON.stringify({ articles: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Transform news data
    const articles = (data.feed || []).slice(0, 5).map((item: any) => ({
      title: item.title,
      source: item.source,
      url: item.url,
      publishedAt: item.time_published,
      summary: item.summary,
      sentiment: item.overall_sentiment_label?.toLowerCase(),
    }));

    console.log(`Found ${articles.length} articles for ${trimmedSymbol}`);

    return new Response(JSON.stringify({ articles }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-stock-news:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        articles: []
      }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
