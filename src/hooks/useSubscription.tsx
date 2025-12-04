import { useEffect, useState, useCallback, useRef } from 'react';
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
  const retryCount = useRef(0);
  const maxRetries = 3;

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setStatus({ subscribed: false, loading: false });
      retryCount.current = 0;
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('Error checking subscription:', error);
        // Retry logic with exponential backoff
        if (retryCount.current < maxRetries) {
          retryCount.current++;
          const delay = Math.pow(2, retryCount.current) * 500;
          console.log(`Retrying subscription check in ${delay}ms (attempt ${retryCount.current}/${maxRetries})`);
          setTimeout(() => checkSubscription(), delay);
          return;
        }
        // After max retries, assume not subscribed
        setStatus({ subscribed: false, loading: false });
        return;
      }

      retryCount.current = 0;
      setStatus({
        subscribed: data.subscribed ?? false,
        product_id: data.product_id,
        subscription_end: data.subscription_end,
        loading: false,
      });
    } catch (error) {
      console.error('Error checking subscription:', error);
      // Retry on catch as well
      if (retryCount.current < maxRetries) {
        retryCount.current++;
        const delay = Math.pow(2, retryCount.current) * 500;
        setTimeout(() => checkSubscription(), delay);
        return;
      }
      setStatus({ subscribed: false, loading: false });
    }
  }, [user]);

  useEffect(() => {
    retryCount.current = 0;
    checkSubscription();
  }, [user, checkSubscription]);

  return {
    ...status,
    refresh: checkSubscription,
  };
};
