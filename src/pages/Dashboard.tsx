import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePortfolio, Portfolio } from "@/hooks/usePortfolio";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortfolioOverview } from "@/components/PortfolioOverview";
import { PortfolioChart } from "@/components/PortfolioChart";
import { AllocationChart } from "@/components/AllocationChart";
import { HoldingsTable } from "@/components/HoldingsTable";
import { AddInvestmentDialog } from "@/components/AddInvestmentDialog";
import { LogOut, Plus, RefreshCw } from "lucide-react";
import { fetchStockData } from "@/services/stockApi";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { portfolios, loading, fetchPortfolios } = usePortfolio();
  const [enrichedPortfolios, setEnrichedPortfolios] = useState<Portfolio[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const refreshPrices = async () => {
    if (portfolios.length === 0) return;

    setIsRefreshing(true);
    const updated: Portfolio[] = [];

    // Get tax rates based on country
    const countries: Record<string, { dividendTax: number }> = {
      AT: { dividendTax: 0.275 },
      DE: { dividendTax: 0.26375 },
      US: { dividendTax: 0.15 },
      UK: { dividendTax: 0.125 },
      CH: { dividendTax: 0.35 },
    };

    for (const portfolio of portfolios) {
      try {
        const stockData = await fetchStockData(portfolio.symbol);
        const currentPrice = stockData.currentPrice;
        const currentValue = currentPrice * Number(portfolio.quantity);
        const gainLoss = currentValue - Number(portfolio.original_investment_eur);
        const gainLossPercent = (gainLoss / Number(portfolio.original_investment_eur)) * 100;

        // Calculate net dividend after tax
        const country = countries[portfolio.country as keyof typeof countries];
        const grossDividend = stockData.dividend * Number(portfolio.quantity);
        const netDividend = country ? grossDividend * (1 - country.dividendTax) : grossDividend;

        // Create snapshot
        await supabase.from('portfolio_snapshots').insert({
          portfolio_id: portfolio.id,
          current_price_eur: currentPrice,
          current_value_eur: currentValue,
          dividend_annual_eur: netDividend,
          exchange_rate: stockData.exchangeRate,
          snapshot_date: new Date().toISOString(),
        });

        updated.push({
          ...portfolio,
          current_price_eur: currentPrice,
          current_value_eur: currentValue,
          gain_loss_eur: gainLoss,
          gain_loss_percent: gainLossPercent,
          dividend_annual_eur: netDividend,
        });
      } catch (error) {
        console.error(`Error refreshing ${portfolio.symbol}:`, error);
        // Keep existing data if refresh fails
        updated.push(portfolio);
      }
    }

    setEnrichedPortfolios(updated);
    setIsRefreshing(false);
    toast({
      title: "Prices updated",
      description: "Portfolio data has been refreshed.",
    });
  };

  useEffect(() => {
    if (!loading && portfolios.length > 0) {
      refreshPrices();
    } else {
      setEnrichedPortfolios([]);
    }
  }, [portfolios, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading portfolio...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Investment Portfolio</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="ghost" size="icon" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {enrichedPortfolios.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Welcome to Your Portfolio Tracker</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Start building your investment portfolio by adding your first stock.
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add First Investment
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Portfolio Overview</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshPrices}
                disabled={isRefreshing}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh Prices
              </Button>
            </div>

            <PortfolioOverview portfolios={enrichedPortfolios} />

            <div className="grid md:grid-cols-2 gap-6">
              <PortfolioChart portfolios={enrichedPortfolios} />
              <AllocationChart portfolios={enrichedPortfolios} />
            </div>

            <HoldingsTable portfolios={enrichedPortfolios} onRefresh={fetchPortfolios} />

            <Button onClick={() => setIsAddDialogOpen(true)} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Add Investment
            </Button>
          </>
        )}
      </main>

      <AddInvestmentDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={fetchPortfolios}
      />
    </div>
  );
};

export default Dashboard;
