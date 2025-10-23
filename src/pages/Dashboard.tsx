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

interface AggregatedPosition {
  symbol: string;
  name: string;
  country: string;
  totalQuantity: number;
  totalOriginalInvestment: number;
  avgOriginalPrice: number;
  current_price_eur?: number;
  current_value_eur?: number;
  gain_loss_eur?: number;
  gain_loss_percent?: number;
  dividend_annual_eur?: number;
  lots: Portfolio[];
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { portfolios, loading, fetchPortfolios } = usePortfolio();
  const [enrichedPortfolios, setEnrichedPortfolios] = useState<Portfolio[]>([]);
  const [aggregatedPositions, setAggregatedPositions] = useState<AggregatedPosition[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { toast } = useToast();

  // Load initial data from latest snapshots
  useEffect(() => {
    const loadInitialData = async () => {
      if (portfolios.length === 0) return;

      // Fetch latest snapshot for each portfolio
      const enriched = await Promise.all(
        portfolios.map(async (portfolio) => {
          const { data: snapshots } = await supabase
            .from('portfolio_snapshots')
            .select('*')
            .eq('portfolio_id', portfolio.id)
            .order('snapshot_date', { ascending: false })
            .limit(1);

          if (snapshots && snapshots.length > 0) {
            const snap = snapshots[0];
            return {
              ...portfolio,
              current_price_eur: Number(snap.current_price_eur),
              current_value_eur: Number(snap.current_value_eur),
              gain_loss_eur: Number(snap.current_value_eur) - Number(portfolio.original_investment_eur),
              gain_loss_percent: ((Number(snap.current_value_eur) - Number(portfolio.original_investment_eur)) / Number(portfolio.original_investment_eur)) * 100,
              dividend_annual_eur: Number(snap.dividend_annual_eur),
            };
          }
          return portfolio;
        })
      );

      setEnrichedPortfolios(enriched);
      aggregatePositions(enriched);
    };

    if (!loading) {
      loadInitialData();
    }
  }, [portfolios, loading]);

  const aggregatePositions = (portfolios: Portfolio[]) => {
    const grouped = new Map<string, AggregatedPosition>();

    portfolios.forEach((p) => {
      const existing = grouped.get(p.symbol);
      if (existing) {
        existing.totalQuantity += Number(p.quantity);
        existing.totalOriginalInvestment += Number(p.original_investment_eur);
        existing.lots.push(p);
        
        if (p.current_value_eur) {
          existing.current_value_eur = (existing.current_value_eur || 0) + p.current_value_eur;
        }
        if (p.dividend_annual_eur) {
          existing.dividend_annual_eur = (existing.dividend_annual_eur || 0) + p.dividend_annual_eur;
        }
      } else {
        grouped.set(p.symbol, {
          symbol: p.symbol,
          name: p.name,
          country: p.country,
          totalQuantity: Number(p.quantity),
          totalOriginalInvestment: Number(p.original_investment_eur),
          avgOriginalPrice: 0, // Will calculate below
          current_price_eur: p.current_price_eur,
          current_value_eur: p.current_value_eur,
          dividend_annual_eur: p.dividend_annual_eur,
          lots: [p],
        });
      }
    });

    // Calculate weighted averages and gains
    const aggregated = Array.from(grouped.values()).map((pos) => {
      pos.avgOriginalPrice = pos.totalOriginalInvestment / pos.totalQuantity;
      if (pos.current_value_eur) {
        pos.gain_loss_eur = pos.current_value_eur - pos.totalOriginalInvestment;
        pos.gain_loss_percent = (pos.gain_loss_eur / pos.totalOriginalInvestment) * 100;
      }
      return pos;
    });

    setAggregatedPositions(aggregated);
  };

  const refreshPrices = async () => {
    if (portfolios.length === 0) return;

    setIsRefreshing(true);
    const updated: Portfolio[] = [];

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

        const country = countries[portfolio.country as keyof typeof countries];
        const grossDividend = stockData.dividend * Number(portfolio.quantity);
        const netDividend = country ? grossDividend * (1 - country.dividendTax) : grossDividend;

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
        updated.push(portfolio);
      }
    }

    setEnrichedPortfolios(updated);
    aggregatePositions(updated);
    setLastUpdated(new Date());
    setIsRefreshing(false);
    
    toast({
      title: "Prices updated",
      description: "Portfolio data has been refreshed.",
    });
  };

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
        {portfolios.length === 0 ? (
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
            {isRefreshing && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center gap-3">
                <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium">Refreshing prices...</span>
              </div>
            )}
            
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">Portfolio Overview</h2>
                {lastUpdated && (
                  <p className="text-xs text-muted-foreground">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </p>
                )}
              </div>
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
              <AllocationChart portfolios={aggregatedPositions.map(p => ({
                id: p.symbol,
                symbol: p.symbol,
                name: p.name,
                country: p.country,
                quantity: p.totalQuantity,
                original_price_eur: p.avgOriginalPrice,
                original_investment_eur: p.totalOriginalInvestment,
                purchase_date: '',
                current_price_eur: p.current_price_eur,
                current_value_eur: p.current_value_eur,
                gain_loss_eur: p.gain_loss_eur,
                gain_loss_percent: p.gain_loss_percent,
                dividend_annual_eur: p.dividend_annual_eur,
              } as Portfolio))} />
            </div>

            <HoldingsTable 
              portfolios={enrichedPortfolios} 
              aggregatedPositions={aggregatedPositions}
              onRefresh={fetchPortfolios} 
            />

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
