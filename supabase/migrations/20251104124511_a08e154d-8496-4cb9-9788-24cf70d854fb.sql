-- Create function to enforce portfolio limit based on subscription
CREATE OR REPLACE FUNCTION public.check_portfolio_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_count INT;
BEGIN
  -- Count existing portfolios for the user
  SELECT COUNT(*) INTO user_count
  FROM public.portfolios
  WHERE user_id = NEW.user_id;
  
  -- Enforce 3-portfolio limit for free tier
  -- Note: This enforces a hard limit of 3. To properly check subscription status,
  -- you would need to integrate with a subscriptions table synced via Stripe webhooks.
  -- For now, this prevents unlimited insertions via direct API calls.
  IF user_count >= 3 THEN
    RAISE EXCEPTION 'Portfolio limit reached. Please upgrade your subscription to add more positions.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to enforce portfolio limit on insert
DROP TRIGGER IF EXISTS enforce_portfolio_limit ON public.portfolios;
CREATE TRIGGER enforce_portfolio_limit
  BEFORE INSERT ON public.portfolios
  FOR EACH ROW
  EXECUTE FUNCTION public.check_portfolio_limit();