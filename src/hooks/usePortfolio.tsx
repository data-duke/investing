import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface Portfolio {
  id: string;
  symbol: string;
  name: string;
  country: string;
  quantity: number;
  original_price_eur: number;
  original_investment_eur: number;
  purchase_date: string;
  current_price_eur?: number;
  current_value_eur?: number;
  gain_loss_eur?: number;
  gain_loss_percent?: number;
  dividend_annual_eur?: number;
}

export const usePortfolio = () => {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchPortfolios = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error fetching portfolio",
        description: error.message,
      });
    } else {
      setPortfolios(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPortfolios();
  }, [user]);

  const addInvestment = async (investment: Omit<Portfolio, 'id'>) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { data, error } = await supabase
      .from('portfolios')
      .insert([{ ...investment, user_id: user.id }])
      .select()
      .single();

    if (error) {
      toast({
        variant: "destructive",
        title: "Error adding investment",
        description: error.message,
      });
      return { error };
    }

    await fetchPortfolios();
    return { data };
  };

  const updateInvestment = async (id: string, updates: Partial<Portfolio>) => {
    const { error } = await supabase
      .from('portfolios')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error updating investment",
        description: error.message,
      });
      return { error };
    }

    await fetchPortfolios();
    return { error: null };
  };

  const deleteInvestment = async (id: string) => {
    const { error } = await supabase
      .from('portfolios')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error deleting investment",
        description: error.message,
      });
      return { error };
    }

    await fetchPortfolios();
    return { error: null };
  };

  return {
    portfolios,
    loading,
    fetchPortfolios,
    addInvestment,
    updateInvestment,
    deleteInvestment,
  };
};
