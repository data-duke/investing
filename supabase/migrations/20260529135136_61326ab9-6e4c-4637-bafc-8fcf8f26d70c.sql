
-- Attach the portfolio limit check as a BEFORE INSERT trigger (function already exists)
DROP TRIGGER IF EXISTS enforce_portfolio_limit ON public.portfolios;
CREATE TRIGGER enforce_portfolio_limit
BEFORE INSERT ON public.portfolios
FOR EACH ROW
EXECUTE FUNCTION public.check_portfolio_limit();

-- Revoke EXECUTE on SECURITY DEFINER functions from public roles.
-- These functions are only used by triggers, not callable by API consumers.
REVOKE ALL ON FUNCTION public.check_portfolio_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
