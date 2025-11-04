import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePortfolio, Portfolio } from "@/hooks/usePortfolio";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortfolioOverview } from "@/components/PortfolioOverview";
import { PortfolioChart } from "@/components/PortfolioChart";
import { AllocationChart } from "@/components/AllocationChart";
import { SortableHoldingsTable } from "@/components/SortableHoldingsTable";
import { AddInvestmentDialog } from "@/components/AddInvestmentDialog";
import { TagFilterBar } from "@/components/TagFilterBar";
import { LogOut, Plus, RefreshCw, TrendingUp, Crown } from "lucide-react";
import { fetchStockData } from "@/services/stockApi";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";

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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { portfolios, loading, fetchPortfolios } = usePortfolio();
  const { subscribed, refresh: refreshSubscription } = useSubscription();
  const [enrichedPortfolios, setEnrichedPortfolios] = useState<Portfolio[]>([]);
  const [aggregatedPositions, setAggregatedPositions] = useState<AggregatedPosition[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingEnriched, setIsLoadingEnriched] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const { toast } = useToast();

  // Auto-refresh on load and every 10 minutes
  useEffect(() => {
    if (portfolios.length > 0) {
      refreshPrices();
      const interval = setInterval(() => {
        refreshPrices();
      }, 10 * 60 * 1000); // 10 minutes
      
      return () => clearInterval(interval);
    }
  }, [portfolios.length]);

  // Check for new investment to highlight and subscription upgrade
  useEffect(() => {
    const newId = searchParams.get('newId');
    const upgraded = searchParams.get('upgraded');
    
    if (upgraded === 'true') {
      refreshSubscription();
      toast({
        title: "Welcome to Premium!",
        description: "You can now add unlimited stock positions.",
      });
    }
    
    if (newId) {
      setHighlightedId(newId);
      // Remove the parameters from URL
      const params = new URLSearchParams(searchParams);
      params.delete('newId');
      params.delete('upgraded');
      setSearchParams(params);
      // Clear highlight after animation
      setTimeout(() => setHighlightedId(null), 4000);
      
      // Scroll to the new investment (on mobile)
      setTimeout(() => {
        const element = document.getElementById(`investment-${newId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [searchParams, setSearchParams, refreshSubscription]);

  // Load initial data from latest snapshots
  useEffect(() => {
    const loadInitialData = async () => {
      if (portfolios.length === 0) {
        setIsLoadingEnriched(false);
        return;
      }

      setIsLoadingEnriched(true);

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
            const dividend = portfolio.manual_dividend_eur ?? Number(snap.dividend_annual_eur);
            return {
              ...portfolio,
              current_price_eur: Number(snap.current_price_eur),
              current_value_eur: Number(snap.current_value_eur),
              gain_loss_eur: Number(snap.current_value_eur) - Number(portfolio.original_investment_eur),
              gain_loss_percent: ((Number(snap.current_value_eur) - Number(portfolio.original_investment_eur)) / Number(portfolio.original_investment_eur)) * 100,
              dividend_annual_eur: dividend,
            };
          }
          return portfolio;
        })
      );

      setEnrichedPortfolios(enriched);
      aggregatePositions(enriched);
      setIsLoadingEnriched(false);
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
        const dividend = p.manual_dividend_eur ?? p.dividend_annual_eur ?? 0;
        if (dividend) {
          existing.dividend_annual_eur = (existing.dividend_annual_eur || 0) + dividend;
        }
      } else {
        const dividend = p.manual_dividend_eur ?? p.dividend_annual_eur ?? 0;
        grouped.set(p.symbol, {
          symbol: p.symbol,
          name: p.name,
          country: p.country,
          totalQuantity: Number(p.quantity),
          totalOriginalInvestment: Number(p.original_investment_eur),
          avgOriginalPrice: 0, // Will calculate below
          current_price_eur: p.current_price_eur,
          current_value_eur: p.current_value_eur,
          dividend_annual_eur: dividend,
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
      RS: { dividendTax: 0.15 },
    };

    let successCount = 0;
    let failCount = 0;

    for (const portfolio of portfolios) {
      try {
        let stockData;
        let dataSource = 'api';
        
        // Try API first
        try {
          stockData = await fetchStockData(portfolio.symbol);
        } catch (apiError) {
          console.log(`API failed for ${portfolio.symbol}, trying scraping...`);
          
          // Fallback to web scraping
          const { data: scrapedData, error: scrapeError } = await supabase.functions.invoke('scrape-stock-price', {
            body: { symbol: portfolio.symbol }
          });
          
          if (scrapeError || !scrapedData) {
            throw new Error(`Both API and scraping failed: ${scrapeError?.message || 'Unknown error'}`);
          }
          
          stockData = scrapedData;
          dataSource = 'scrape';
        }

        const currentPrice = stockData.currentPrice;
        const currentValue = currentPrice * Number(portfolio.quantity);
        const gainLoss = currentValue - Number(portfolio.original_investment_eur);
        const gainLossPercent = (gainLoss / Number(portfolio.original_investment_eur)) * 100;

        // Use manual dividend if set, otherwise fetch from API
        let netDividend = portfolio.manual_dividend_eur ?? 0;
        
        if (!portfolio.manual_dividend_eur) {
          const country = countries[portfolio.country as keyof typeof countries];
          const grossDividend = stockData.dividend * Number(portfolio.quantity);
          netDividend = country ? grossDividend * (1 - country.dividendTax) : grossDividend;
        }

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
        
        successCount++;
        console.log(`✓ ${portfolio.symbol} updated via ${dataSource}`);
      } catch (error) {
        console.error(`✗ Error refreshing ${portfolio.symbol}:`, error);
        failCount++;
        updated.push(portfolio);
      }
    }

    setEnrichedPortfolios(updated);
    aggregatePositions(updated);
    setLastUpdated(new Date());
    setIsRefreshing(false);
    
    toast({
      title: "Prices updated",
      description: `${successCount} stocks updated successfully${failCount > 0 ? `, ${failCount} failed` : ''}.`,
      variant: failCount > 0 ? "destructive" : "default",
    });
  };

  // Extract unique tags
  const allTags = Array.from(
    new Set(
      enrichedPortfolios
        .map((p) => p.tag || p.auto_tag_date)
        .filter(Boolean) as string[]
    )
  ).sort();

  // Filter portfolios by selected tags
  const filteredPortfolios = selectedTags.length > 0
    ? enrichedPortfolios.filter((p) => {
        const itemTag = p.tag || p.auto_tag_date;
        return itemTag && selectedTags.includes(itemTag);
      })
    : enrichedPortfolios;

  // Recalculate aggregated positions for filtered data
  const displayAggregatedPositions = selectedTags.length > 0
    ? (() => {
        const grouped = new Map<string, AggregatedPosition>();
        filteredPortfolios.forEach((p) => {
          const existing = grouped.get(p.symbol);
          if (existing) {
            existing.totalQuantity += Number(p.quantity);
            existing.totalOriginalInvestment += Number(p.original_investment_eur);
            existing.lots.push(p);
            if (p.current_value_eur) {
              existing.current_value_eur = (existing.current_value_eur || 0) + p.current_value_eur;
            }
            const dividend = p.manual_dividend_eur ?? p.dividend_annual_eur ?? 0;
            if (dividend) {
              existing.dividend_annual_eur = (existing.dividend_annual_eur || 0) + dividend;
            }
          } else {
            const dividend = p.manual_dividend_eur ?? p.dividend_annual_eur ?? 0;
            grouped.set(p.symbol, {
              symbol: p.symbol,
              name: p.name,
              country: p.country,
              totalQuantity: Number(p.quantity),
              totalOriginalInvestment: Number(p.original_investment_eur),
              avgOriginalPrice: Number(p.original_price_eur),
              current_price_eur: p.current_price_eur,
              current_value_eur: p.current_value_eur,
              dividend_annual_eur: dividend,
              lots: [p],
            });
          }
        });
        return Array.from(grouped.values()).map((pos) => {
          pos.avgOriginalPrice = pos.totalOriginalInvestment / pos.totalQuantity;
          if (pos.current_value_eur) {
            pos.gain_loss_eur = pos.current_value_eur - pos.totalOriginalInvestment;
            pos.gain_loss_percent = (pos.gain_loss_eur / pos.totalOriginalInvestment) * 100;
          }
          return pos;
        });
      })()
    : aggregatedPositions;

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
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
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Investing Lovable</h1>
            {subscribed && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary ring-1 ring-primary/20 px-3 py-1 shadow-sm">
                <Crown className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold tracking-wide">Premium</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!subscribed && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const { data } = await supabase.functions.invoke('customer-portal');
                  if (data?.url) window.open(data.url, '_blank');
                }}
                className="hidden sm:flex"
              >
                <Crown className="h-4 w-4 mr-2" />
                Upgrade
              </Button>
            )}
            {subscribed && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const { data } = await supabase.functions.invoke('customer-portal');
                  if (data?.url) window.open(data.url, '_blank');
                }}
                className="hidden sm:flex"
              >
                Manage Subscription
              </Button>
            )}
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

            <PortfolioOverview portfolios={filteredPortfolios} isLoading={isLoadingEnriched} />

            <TagFilterBar
              allTags={allTags}
              selectedTags={selectedTags}
              onTagToggle={handleTagToggle}
              onClearAll={() => setSelectedTags([])}
              filteredCount={filteredPortfolios.length}
              totalCount={enrichedPortfolios.length}
            />

            <div className="grid md:grid-cols-2 gap-6">
              <PortfolioChart portfolios={filteredPortfolios} />
              <AllocationChart aggregatedPositions={displayAggregatedPositions} />
            </div>

            <SortableHoldingsTable 
              portfolios={filteredPortfolios} 
              aggregatedPositions={displayAggregatedPositions}
              onRefresh={fetchPortfolios}
              highlightedId={highlightedId}
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
