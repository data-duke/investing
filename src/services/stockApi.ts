const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';

export interface StockData {
  symbol: string;
  currentPrice: number;
  dividend: number;
  name: string;
}

export const fetchStockData = async (symbol: string, apiKey: string): Promise<StockData> => {
  try {
    // Fetch quote data
    const quoteResponse = await fetch(
      `${ALPHA_VANTAGE_BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`
    );
    const quoteData = await quoteResponse.json();

    if (quoteData['Error Message']) {
      throw new Error('Invalid stock symbol');
    }

    if (quoteData['Note']) {
      throw new Error('API rate limit exceeded. Please wait a minute.');
    }

    const quote = quoteData['Global Quote'];
    if (!quote || !quote['05. price']) {
      throw new Error('Stock data not found');
    }

    const currentPrice = parseFloat(quote['05. price']);

    // Fetch company overview for dividend
    const overviewResponse = await fetch(
      `${ALPHA_VANTAGE_BASE_URL}?function=OVERVIEW&symbol=${symbol}&apikey=${apiKey}`
    );
    const overviewData = await overviewResponse.json();

    const dividend = overviewData['DividendPerShare'] 
      ? parseFloat(overviewData['DividendPerShare']) 
      : 0;

    return {
      symbol: symbol.toUpperCase(),
      currentPrice,
      dividend,
      name: overviewData['Name'] || symbol.toUpperCase(),
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch stock data');
  }
};
