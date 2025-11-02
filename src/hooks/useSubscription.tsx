import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface SubscriptionStatus {
  subscribed: boolean;
  product_id?: string;
  subscription_end?: string;
  loading: boolean;
}

export const useSubscription = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>({
    subscribed: false,
    loading: true,
  });

  const checkSubscription = async () => {
    if (!user) {
      setStatus({ subscribed: false, loading: false });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('Error checking subscription:', error);
        setStatus({ subscribed: false, loading: false });
        return;
      }

      setStatus({
        subscribed: data.subscribed,
        product_id: data.product_id,
        subscription_end: data.subscription_end,
        loading: false,
      });
    } catch (error) {
      console.error('Error checking subscription:', error);
      setStatus({ subscribed: false, loading: false });
    }
  };

  useEffect(() => {
    checkSubscription();
  }, [user]);

  return {
    ...status,
    refresh: checkSubscription,
  };
};
