-- Add residence_country column to profiles table for tax calculations
ALTER TABLE public.profiles 
ADD COLUMN residence_country text DEFAULT 'AT';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.residence_country IS 'User tax residence country code (AT, DE, US, UK, CH, RS)';