import { supabase } from "@/integrations/supabase/client";

export interface StockData {
  symbol: string;
  currentPrice: number;
  dividend: number;
  name: string;
  exchangeRate?: number;
  currentPriceUSD?: number;
  source?: string;
}

export const fetchStockData = async (symbol: string): Promise<StockData> => {
  try {
    const { data, error } = await supabase.functions.invoke('fetch-stock-data', {
      body: { symbol }
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data.error) {
      throw new Error(data.error);
    }

    return data as StockData;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch stock data');
  }
};
