-- Create dividend_dates table to cache dividend payment dates
CREATE TABLE public.dividend_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  ex_date DATE NOT NULL,
  payment_date DATE,
  record_date DATE,
  declaration_date DATE,
  dividend_amount NUMERIC,
  currency TEXT DEFAULT 'USD',
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, ex_date)
);

-- Enable RLS
ALTER TABLE public.dividend_dates ENABLE ROW LEVEL SECURITY;

-- Allow public read access (dividend dates are public info)
CREATE POLICY "Allow public read access" ON public.dividend_dates
FOR SELECT USING (true);

-- Create index for faster symbol lookups
CREATE INDEX idx_dividend_dates_symbol ON public.dividend_dates (symbol);
CREATE INDEX idx_dividend_dates_ex_date ON public.dividend_dates (ex_date DESC);