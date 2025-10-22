import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NewsArticle {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  summary: string;
  sentiment?: string;
}

export const useStockNews = () => {
  const [loading, setLoading] = useState(false);

  const fetchNews = async (symbol: string): Promise<NewsArticle[]> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-stock-news', {
        body: { symbol }
      });

      if (error) throw error;
      return data?.articles || [];
    } catch (error) {
      console.error('Error fetching news:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  return { fetchNews, loading };
};
