-- Create subscription_overrides table for manual premium access
CREATE TABLE public.subscription_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  override_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_overrides ENABLE ROW LEVEL SECURITY;

-- Only allow service role to manage this table (no public access)
CREATE POLICY "Service role only" ON public.subscription_overrides
  FOR ALL USING (false);

-- Insert override for test@test.com user
INSERT INTO public.subscription_overrides (user_id, is_premium, override_reason)
SELECT id, true, 'Manual testing override'
FROM public.profiles
WHERE email = 'test@test.com'
ON CONFLICT (user_id) DO UPDATE SET is_premium = true;