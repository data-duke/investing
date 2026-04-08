import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Portfolio } from "@/hooks/usePortfolio";
import { TrendingUp, DollarSign, PiggyBank, Award, Wallet, Percent, ArrowUpFromLine } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatCurrency, formatPercentage } from "@/lib/formatters";
import { calculateDividendTax, calculateCapitalGainsTax } from "@/lib/taxCalculations";

interface PortfolioOverviewProps {
  portfolios: Portfolio[];
  isLoading?: boolean;
  privacyMode?: boolean;
  userCountry?: string;
}

export const PortfolioOverview = ({ 
  portfolios, 
  isLoading = false, 
  privacyMode = false,
  userCountry = 'AT'
}: PortfolioOverviewProps) => {
  const { t } = useTranslation();

  const stats = useMemo(() => {
    const totalValue = portfolios.reduce((sum, p) => sum + (p.current_value_eur || 0), 0);
    const totalInvested = portfolios.reduce((sum, p) => sum + Number(p.original_investment_eur), 0);
    const grossGain = totalValue - totalInvested;
    
    const capitalGainsTaxResult = calculateCapitalGainsTax(grossGain, userCountry);
    const netGain = capitalGainsTaxResult.netGain;
    const totalGainPercent = totalInvested > 0 ? (netGain / totalInvested) * 100 : 0;
    
    const capitalGainsTax = grossGain > 0 ? capitalGainsTaxResult.tax : 0;
    const netLiquidationValue = totalValue - capitalGainsTax;
    const taxRate = capitalGainsTaxResult.taxRate;
    
    const totalDividends = portfolios.reduce((sum, p) => {
      const grossDividendPerShare = p.manual_dividend_eur || 0;
      const grossDividendTotal = p.dividend_annual_eur ?? 0;
      
      const grossToTax = grossDividendPerShare > 0 
        ? grossDividendPerShare * Number(p.quantity)
        : grossDividendTotal;
      
      if (grossToTax > 0) {
        const taxBreakdown = calculateDividendTax(
          grossToTax / Number(p.quantity),
          Number(p.quantity),
          p.country,
          userCountry
        );
        return sum + taxBreakdown.netDividend;
      }
      return sum;
    }, 0);
    
    const monthlyDividends = totalDividends / 12;
    const dividendYield = totalValue > 0 ? (totalDividends / totalValue) * 100 : 0;

    const topPerformer = portfolios.reduce((best, current) => {
      const currentGain = current.gain_loss_percent || 0;
      const bestGain = best?.gain_loss_percent || 0;
      return currentGain > bestGain ? current : best;
    }, portfolios[0]);

    let safeWithdrawalTotal = 0;
    let availableProfitTotal = 0;

    portfolios.forEach(p => {
      const invested = Number(p.original_investment_eur);
      const marketValue = p.current_value_eur || 0;
      const grossGainPos = marketValue - invested;

      if (grossGainPos > 0) {
        const taxResult = calculateCapitalGainsTax(grossGainPos, userCountry);
        const netValuePos = marketValue - taxResult.tax;
        safeWithdrawalTotal += netValuePos * 0.04;
        availableProfitTotal += netValuePos - invested;
      }
    });

    return {
      netLiquidationValue, capitalGainsTax, taxRate, grossGain,
      totalValue, totalInvested, netGain, totalGainPercent,
      totalDividends, monthlyDividends, dividendYield,
      topPerformer,
      safeWithdrawalTotal, availableProfitTotal,
    };
  }, [portfolios, privacyMode, userCountry, t]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Card><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
        <Card><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Section 1: Primary Stats */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
            {/* Net Liquidation */}
            <div className="pb-3 md:pb-0 md:pr-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Wallet className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-medium text-muted-foreground">
                  {t('portfolio.netLiquidationValue')}
                </span>
              </div>
              <div className="text-base font-bold text-primary">
                {privacyMode ? "•••••" : formatCurrency(stats.netLiquidationValue)}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {privacyMode 
                  ? t('portfolio.afterTaxDesc', { rate: formatPercentage(stats.taxRate) })
                  : stats.grossGain > 0 
                    ? `${formatCurrency(stats.capitalGainsTax)} tax (${formatPercentage(stats.taxRate)})`
                    : t('portfolio.noTaxOnLoss')}
              </p>
            </div>

            {/* Gain/Loss */}
            <div className="py-3 md:py-0 md:px-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-medium text-muted-foreground">
                  {t('portfolio.totalGainLoss')}
                </span>
              </div>
              <div className={`text-base font-bold ${stats.netGain >= 0 ? "text-green-600" : "text-red-600"}`}>
                {privacyMode ? formatPercentage(stats.totalGainPercent) : formatCurrency(stats.netGain)}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {privacyMode ? "" : `${formatPercentage(stats.totalGainPercent)} · ${t('portfolio.invested', { amount: formatCurrency(stats.totalInvested) })}`}
              </p>
            </div>

            {/* Dividends */}
            <div className="pt-3 md:pt-0 md:pl-3">
              <div className="flex items-center gap-1.5 mb-1">
                <PiggyBank className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-medium text-muted-foreground">
                  {t('portfolio.annualDividends')}
                </span>
              </div>
              <div className="text-base font-bold">
                {privacyMode ? `${formatPercentage(stats.dividendYield)} yield` : formatCurrency(stats.totalDividends)}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {privacyMode ? "" : t('portfolio.monthlyAvg', { amount: formatCurrency(stats.monthlyDividends) })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Secondary Stats */}
      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
            {/* Top Performer */}
            <div className="pb-2 md:pb-0 md:pr-3 flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-muted-foreground">{t('portfolio.topPerformer')}</div>
                <div className="text-sm font-bold text-amber-600">
                  {stats.topPerformer?.symbol || t('portfolio.noData')}
                  {stats.topPerformer && (
                    <span className="text-[10px] font-normal text-muted-foreground ml-1">
                      +{formatPercentage(stats.topPerformer.gain_loss_percent || 0)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 4% Safe Withdrawal */}
            <div className="py-2 md:py-0 md:px-3 flex items-center gap-2">
              <Percent className="h-4 w-4 text-emerald-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-muted-foreground">{t('portfolio.safeWithdrawal')}</div>
                <div className="text-sm font-bold text-emerald-600">
                  {privacyMode ? "•••••" : `${formatCurrency(stats.safeWithdrawalTotal)}/yr`}
                </div>
              </div>
            </div>

            {/* Available Profit */}
            <div className="pt-2 md:pt-0 md:pl-3 flex items-center gap-2">
              <ArrowUpFromLine className="h-4 w-4 text-green-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-muted-foreground">{t('portfolio.availableProfit')}</div>
                <div className={`text-sm font-bold ${stats.availableProfitTotal > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                  {privacyMode ? "•••••" : formatCurrency(stats.availableProfitTotal)}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
