import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Portfolio } from "@/hooks/usePortfolio";
import { TrendingUp, DollarSign, PiggyBank, Award } from "lucide-react";
import { useMemo } from "react";
import { formatCurrency, formatPercentage } from "@/lib/formatters";

interface PortfolioOverviewProps {
  portfolios: Portfolio[];
  isLoading?: boolean;
}

export const PortfolioOverview = ({ portfolios, isLoading = false }: PortfolioOverviewProps) => {
  const stats = useMemo(() => {
    const totalValue = portfolios.reduce((sum, p) => sum + (p.current_value_eur || 0), 0);
    const totalInvested = portfolios.reduce((sum, p) => sum + Number(p.original_investment_eur), 0);
    const totalGain = totalValue - totalInvested;
    const totalGainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
    const totalDividends = portfolios.reduce((sum, p) => {
      const dividend = p.manual_dividend_eur ?? p.dividend_annual_eur ?? 0;
      return sum + dividend;
    }, 0);

    const topPerformer = portfolios.reduce((best, current) => {
      const currentGain = current.gain_loss_percent || 0;
      const bestGain = best?.gain_loss_percent || 0;
      return currentGain > bestGain ? current : best;
    }, portfolios[0]);

    return [
      {
        title: "Total Portfolio Value",
        value: formatCurrency(totalValue),
        icon: DollarSign,
        description: `Invested: ${formatCurrency(totalInvested)}`,
      },
      {
        title: "Total Gain/Loss",
        value: formatCurrency(totalGain),
        icon: TrendingUp,
        description: `${totalGainPercent >= 0 ? '+' : ''}${formatPercentage(totalGainPercent, undefined, true)}`,
        className: totalGain >= 0 ? "text-green-600" : "text-red-600",
      },
      {
        title: "Annual Dividends",
        value: formatCurrency(totalDividends),
        icon: PiggyBank,
        description: "Expected annual income",
      },
      {
        title: "Top Performer",
        value: topPerformer?.symbol || "N/A",
        icon: Award,
        description: topPerformer ? `+${formatPercentage(topPerformer.gain_loss_percent || 0, undefined, true)}` : "N/A",
        className: "text-primary",
      },
    ];
  }, [portfolios]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
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
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
