import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    
    // Apply capital gains tax to get net gain
    const capitalGainsTaxResult = calculateCapitalGainsTax(grossGain, userCountry);
    const netGain = capitalGainsTaxResult.netGain;
    const totalGainPercent = totalInvested > 0 ? (netGain / totalInvested) * 100 : 0;
    
    // Calculate Net Liquidation Value (what you get if you sell everything today)
    // Only gains are taxed; if there's a loss, no tax is owed
    const capitalGainsTax = grossGain > 0 ? capitalGainsTaxResult.tax : 0;
    const netLiquidationValue = totalValue - capitalGainsTax;
    const taxRate = capitalGainsTaxResult.taxRate;
    
    // Calculate net dividends with proper tax treatment
    // All dividends are now stored as GROSS, so apply tax uniformly
    const totalDividends = portfolios.reduce((sum, p) => {
      const grossDividendPerShare = p.manual_dividend_eur || 0;
      const grossDividendTotal = p.dividend_annual_eur ?? 0;
      
      // If we have a manual dividend, calculate total from per-share * quantity
      // Otherwise use the stored dividend_annual_eur (which is now gross total)
      const grossToTax = grossDividendPerShare > 0 
        ? grossDividendPerShare * Number(p.quantity)
        : grossDividendTotal;
      
      if (grossToTax > 0) {
        const taxBreakdown = calculateDividendTax(
          grossToTax / Number(p.quantity), // per-share for tax calculation
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

    // Calculate per-position KPIs for profitable positions only
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

    const mainStats = [
      {
        title: t('portfolio.netLiquidationValue'),
        value: privacyMode ? "•••••" : formatCurrency(netLiquidationValue),
        icon: Wallet,
        description: privacyMode 
          ? t('portfolio.afterTaxDesc', { rate: formatPercentage(taxRate) })
          : grossGain > 0 
            ? t('portfolio.afterCapitalGainsTax', { tax: formatCurrency(capitalGainsTax), rate: formatPercentage(taxRate) })
            : t('portfolio.noTaxOnLoss'),
        className: "text-primary",
      },
      {
        title: t('portfolio.totalValue'),
        value: privacyMode ? "•••••" : formatCurrency(totalValue),
        icon: DollarSign,
        description: privacyMode 
          ? `${formatPercentage(totalGainPercent)} ${t('portfolio.totalGainLoss').toLowerCase()}`
          : t('portfolio.invested', { amount: formatCurrency(totalInvested) }),
      },
      {
        title: t('portfolio.totalGainLoss'),
        value: privacyMode ? formatPercentage(totalGainPercent) : formatCurrency(netGain),
        icon: TrendingUp,
        description: privacyMode ? "" : `${formatPercentage(totalGainPercent)} ${t('portfolio.afterTax')}`,
        className: netGain >= 0 ? "text-green-600" : "text-red-600",
      },
      {
        title: t('portfolio.annualDividends'),
        value: privacyMode ? `${formatPercentage(dividendYield)} yield` : formatCurrency(totalDividends),
        icon: PiggyBank,
        description: privacyMode ? "" : t('portfolio.monthlyAvg', { amount: formatCurrency(monthlyDividends) }),
      },
      {
        title: t('portfolio.topPerformer'),
        value: topPerformer?.symbol || t('portfolio.noData'),
        icon: Award,
        description: topPerformer 
          ? `+${formatPercentage(topPerformer.gain_loss_percent || 0)}` 
          : '',
        className: "text-amber-600",
      },
    ];

    const withdrawalStats = [
      {
        title: t('portfolio.safeWithdrawal'),
        value: privacyMode ? "•••••" : formatCurrency(safeWithdrawalTotal),
        icon: Percent,
        description: privacyMode ? "" : t('portfolio.safeWithdrawalDesc'),
        className: "text-emerald-600",
      },
      {
        title: t('portfolio.availableProfit'),
        value: privacyMode ? "•••••" : formatCurrency(availableProfitTotal),
        icon: ArrowUpFromLine,
        description: privacyMode ? "" : t('portfolio.availableProfitDesc'),
        className: availableProfitTotal > 0 ? "text-green-600" : "text-muted-foreground",
      },
    ];

    return { mainStats, withdrawalStats };
  }, [portfolios, privacyMode, userCountry, t]);

  const renderCard = (stat: { title: string; value: string; icon: any; description?: string; className?: string }) => {
    const Icon = stat.icon;
    return (
      <Card key={stat.title}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <>
              <Skeleton className="h-7 w-24 mb-1" />
              <Skeleton className="h-4 w-32" />
            </>
          ) : (
            <>
              <div className={`text-2xl font-bold ${stat.className || ''}`}>
                {stat.value}
              </div>
              {stat.description && (
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  };

};

