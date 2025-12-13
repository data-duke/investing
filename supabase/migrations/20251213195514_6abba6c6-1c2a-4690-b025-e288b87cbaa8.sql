CREATE OR REPLACE FUNCTION public.check_portfolio_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_count INT;
  has_premium BOOLEAN;
BEGIN
  -- Check if user has premium override in subscription_overrides table
  SELECT is_premium INTO has_premium
  FROM public.subscription_overrides
  WHERE user_id = NEW.user_id;
  
  -- Skip limit check for premium users
  IF has_premium = true THEN
    RETURN NEW;
  END IF;
  
  -- Count existing portfolios for the user
  SELECT COUNT(*) INTO user_count
  FROM public.portfolios
  WHERE user_id = NEW.user_id;
  
  -- Enforce 3-portfolio limit for free tier
  IF user_count >= 3 THEN
    RAISE EXCEPTION 'Portfolio limit reached. Please upgrade your subscription to add more positions.';
  END IF;
  
  RETURN NEW;
END;
$function$;