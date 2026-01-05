import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { usePortfolio, Portfolio } from "@/hooks/usePortfolio";
import { useSubscription } from "@/hooks/useSubscription";
import { usePrivacy } from "@/contexts/PrivacyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortfolioOverview } from "@/components/PortfolioOverview";
import { PortfolioChart } from "@/components/PortfolioChart";
import { AllocationChart } from "@/components/AllocationChart";
import { SortableHoldingsTable } from "@/components/SortableHoldingsTable";
import { AddInvestmentDialog } from "@/components/AddInvestmentDialog";
import { TagFilterBar } from "@/components/TagFilterBar";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { TaxSettingsDialog } from "@/components/TaxSettingsDialog";
import { ShareDialog } from "@/components/ShareDialog";
import { ManageSharesDialog } from "@/components/ManageSharesDialog";
import { LogOut, Plus, RefreshCw, TrendingUp, Crown, Eye, EyeOff, Share2, Link } from "lucide-react";
import { fetchStockData } from "@/services/stockApi";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { calculateDividendTax } from "@/lib/taxCalculations";
import { AggregatedPosition, MAX_CONCURRENT_REQUESTS, REFRESH_INTERVAL_MS } from "@/lib/constants";

const Dashboard = () => {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { portfolios, loading, fetchPortfolios } = usePortfolio();
  const { subscribed, isOverride, refresh: refreshSubscription } = useSubscription();
  const { privacyMode, togglePrivacyMode } = usePrivacy();
  const [enrichedPortfolios, setEnrichedPortfolios] = useState<Portfolio[]>([]);
  const [aggregatedPositions, setAggregatedPositions] = useState<AggregatedPosition[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isManageSharesOpen, setIsManageSharesOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingEnriched, setIsLoadingEnriched] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [userCountry, setUserCountry] = useState<string>('AT');
  const [refreshProgress, setRefreshProgress] = useState<{ current: number; total: number } | null>(null);
  const { toast } = useToast();

  // Fetch user's tax residence country
  useEffect(() => {
    const fetchUserCountry = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('residence_country')
        .eq('id', user.id)
        .single();
      if (data?.residence_country) {
        setUserCountry(data.residence_country);
      }
    };
    fetchUserCountry();
  }, [user?.id]);

  // Auto-refresh on load and every 10 minutes (Premium only)
  useEffect(() => {
    if (portfolios.length > 0 && !isRefreshing && subscribed) {
      refreshPrices();
      const interval = setInterval(() => {
        refreshPrices();
      }, REFRESH_INTERVAL_MS);
      
      return () => clearInterval(interval);
    }
  }, [portfolios.length, subscribed]);

  // Check for new investment to highlight and subscription upgrade
  useEffect(() => {
    const newId = searchParams.get('newId');
    const upgraded = searchParams.get('upgraded');
    
    if (upgraded === 'true') {
      refreshSubscription();
      toast({
        title: t('dashboard.welcomeToPremium'),
        description: t('dashboard.unlimitedPositions'),
      });
    }
    
    if (newId) {
      setHighlightedId(newId);
      const params = new URLSearchParams(searchParams);
      params.delete('newId');
      params.delete('upgraded');
      setSearchParams(params);
      setTimeout(() => setHighlightedId(null), 4000);
      
      setTimeout(() => {
        const element = document.getElementById(`investment-${newId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [searchParams, setSearchParams, refreshSubscription, t]);

  // Load initial data from latest snapshots
  useEffect(() => {
    const loadInitialData = async () => {
      if (portfolios.length === 0) {
        setEnrichedPortfolios([]);
        setAggregatedPositions([]);
        setIsLoadingEnriched(false);
        return;
      }

      setIsLoadingEnriched(true);

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
          return {
            ...portfolio,
            current_price_eur: Number(portfolio.original_price_eur),
            current_value_eur: Number(portfolio.original_investment_eur),
            gain_loss_eur: 0,
            gain_loss_percent: 0,
            dividend_annual_eur: portfolio.manual_dividend_eur ?? 0,
          };
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

  // Helper to get all tags from a portfolio (including legacy fields)
  const getPortfolioTags = (portfolio: Portfolio): string[] => {
    const tags: string[] = [];
    if (portfolio.tags && portfolio.tags.length > 0) {
      tags.push(...portfolio.tags);
    }
    if (portfolio.tag && !tags.includes(portfolio.tag)) {
      tags.push(portfolio.tag);
    }
    if (portfolio.auto_tag_date && !tags.includes(portfolio.auto_tag_date)) {
      tags.push(portfolio.auto_tag_date);
    }
    return tags;
  };

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
        const dividend = p.manual_dividend_eur 
          ? p.manual_dividend_eur * Number(p.quantity)
          : p.dividend_annual_eur ?? 0;
        if (dividend) {
          existing.dividend_annual_eur = (existing.dividend_annual_eur || 0) + dividend;
        }
      } else {
        const dividend = p.manual_dividend_eur 
          ? p.manual_dividend_eur * Number(p.quantity)
          : p.dividend_annual_eur ?? 0;
        grouped.set(p.symbol, {
          symbol: p.symbol,
          name: p.name,
          country: p.country,
          totalQuantity: Number(p.quantity),
          totalOriginalInvestment: Number(p.original_investment_eur),
          avgOriginalPrice: 0,
          current_price_eur: p.current_price_eur,
          current_value_eur: p.current_value_eur,
          dividend_annual_eur: dividend,
          lots: [p],
        });
      }
    });

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

  // Parallel fetching with concurrency limit
  const fetchWithConcurrencyLimit = async <T,>(
    items: T[],
    fetchFn: (item: T) => Promise<any>,
    maxConcurrent: number = MAX_CONCURRENT_REQUESTS
  ): Promise<PromiseSettledResult<any>[]> => {
    const results: PromiseSettledResult<any>[] = [];
    
    for (let i = 0; i < items.length; i += maxConcurrent) {
      const batch = items.slice(i, i + maxConcurrent);
      const batchResults = await Promise.allSettled(batch.map(fetchFn));
      results.push(...batchResults);
      setRefreshProgress({ current: Math.min(i + maxConcurrent, items.length), total: items.length });
    }
    
    return results;
  };

  const refreshPrices = async () => {
    setIsRefreshing(true);
    setRefreshProgress({ current: 0, total: 0 });

    // Fetch fresh portfolios from DB
    const { data: freshPortfolios, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', user?.id);

    if (error || !freshPortfolios || freshPortfolios.length === 0) {
      console.error('Failed to fetch fresh portfolios:', error);
      setIsRefreshing(false);
      setRefreshProgress(null);
      return;
    }

    // Deduplicate symbols to avoid redundant API calls
    const uniqueSymbols = [...new Set(freshPortfolios.map(p => p.symbol))];
    setRefreshProgress({ current: 0, total: uniqueSymbols.length });

    // Fetch prices in parallel with concurrency limit
    const priceMap = new Map<string, any>();
    
    const results = await fetchWithConcurrencyLimit(
      uniqueSymbols,
      async (symbol) => {
        try {
          let stockData;
          try {
            stockData = await fetchStockData(symbol);
          } catch (apiError) {
            console.log(`API failed for ${symbol}, trying scraping...`);
            const { data: scrapedData, error: scrapeError } = await supabase.functions.invoke('scrape-stock-price', {
              body: { symbol }
            });
            if (scrapeError || !scrapedData) throw new Error('Both API and scraping failed');
            stockData = scrapedData;
          }
          return { symbol, stockData, success: true };
        } catch (e) {
          console.error(`Failed to fetch ${symbol}:`, e);
          return { symbol, success: false };
        }
      }
    );

    // Build price map from successful fetches
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.success) {
        priceMap.set(result.value.symbol, result.value.stockData);
      }
    });

    // Apply prices to all portfolios
    const updated: Portfolio[] = [];
    const snapshotInserts: any[] = [];

    for (const portfolio of freshPortfolios) {
      const stockData = priceMap.get(portfolio.symbol);
      
      if (stockData) {
        const currentPrice = stockData.currentPrice;
        const currentValue = currentPrice * Number(portfolio.quantity);
        const gainLoss = currentValue - Number(portfolio.original_investment_eur);
        const gainLossPercent = (gainLoss / Number(portfolio.original_investment_eur)) * 100;

        let netDividend = 0;
        if (portfolio.manual_dividend_eur) {
          const taxBreakdown = calculateDividendTax(
            portfolio.manual_dividend_eur,
            Number(portfolio.quantity),
            portfolio.country,
            userCountry
          );
          netDividend = taxBreakdown.netDividend;
        } else if (stockData.dividend) {
          const taxBreakdown = calculateDividendTax(
            stockData.dividend,
            Number(portfolio.quantity),
            portfolio.country,
            userCountry
          );
          netDividend = taxBreakdown.netDividend;
        }

        snapshotInserts.push({
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
      } else {
        updated.push(portfolio);
      }
    }

    // Batch insert snapshots
    if (snapshotInserts.length > 0) {
      await supabase.from('portfolio_snapshots').insert(snapshotInserts);
    }

    const successCount = priceMap.size;
    const failCount = uniqueSymbols.length - successCount;
    
    console.log(`Refreshed ${successCount} symbols, ${failCount} failed`);

    setEnrichedPortfolios(updated);
    aggregatePositions(updated);
    setLastUpdated(new Date());
    setIsRefreshing(false);
    setRefreshProgress(null);
  };

  // Extract unique tags from all portfolios
  const allTags = Array.from(
    new Set(
      enrichedPortfolios.flatMap((p) => getPortfolioTags(p))
    )
  ).filter(Boolean).sort();

  // Filter portfolios by selected tags
  const filteredPortfolios = selectedTags.length > 0
    ? enrichedPortfolios.filter((p) => {
        const portfolioTags = getPortfolioTags(p);
        return portfolioTags.some(tag => selectedTags.includes(tag));
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
            const dividend = p.manual_dividend_eur 
              ? p.manual_dividend_eur * Number(p.quantity)
              : p.dividend_annual_eur ?? 0;
            if (dividend) {
              existing.dividend_annual_eur = (existing.dividend_annual_eur || 0) + dividend;
            }
          } else {
            const dividend = p.manual_dividend_eur 
              ? p.manual_dividend_eur * Number(p.quantity)
              : p.dividend_annual_eur ?? 0;
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
        <div className="text-muted-foreground">{t('dashboard.loadingPortfolio')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{t('home.title')}</h1>
            {subscribed && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary ring-1 ring-primary/20 px-3 py-1 shadow-sm">
                <Crown className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold tracking-wide">{t('dashboard.premium')}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 mr-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={togglePrivacyMode}
                className="gap-2"
                title={privacyMode ? t('dashboard.privacyModeOn') : t('dashboard.privacyModeOff')}
              >
                {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="hidden md:inline text-xs">{t('dashboard.privacyMode')}</span>
              </Button>
            </div>
            {user?.id && (
              <TaxSettingsDialog
                userId={user.id}
                currentCountry={userCountry}
                onCountryChange={setUserCountry}
              />
            )}
            <LanguageSwitcher />
            {!subscribed && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const { data, error } = await supabase.functions.invoke('create-checkout');
                  if (error) {
                    toast({
                      title: t('common.error'),
                      description: t('toast.couldNotStartCheckout'),
                      variant: "destructive",
                    });
                    return;
                  }
                  if (data?.url) window.open(data.url, '_blank');
                }}
                className="hidden sm:flex"
              >
                <Crown className="h-4 w-4 mr-2" />
                {t('nav.upgrade')}
              </Button>
            )}
            {subscribed && !isOverride && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const { data, error } = await supabase.functions.invoke('customer-portal');
                  if (error) {
                    toast({
                      title: t('common.error'), 
                      description: t('toast.couldNotOpenPortal'),
                      variant: "destructive",
                    });
                    return;
                  }
                  if (data?.url) window.open(data.url, '_blank');
                }}
                className="hidden sm:flex"
              >
                {t('nav.manageSubscription')}
              </Button>
            )}
            <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
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
              <CardTitle>{t('dashboard.welcomeTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                {t('dashboard.welcomeDescription')}
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t('dashboard.addFirstInvestment')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {isRefreshing && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center gap-3">
                <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium">
                  {refreshProgress 
                    ? t('dashboard.refreshingProgress', { current: refreshProgress.current, total: refreshProgress.total })
                    : t('dashboard.refreshingPrices')}
                </span>
              </div>
            )}
            
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">{t('dashboard.portfolioOverview')}</h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {lastUpdated && (
                    <span>{t('dashboard.lastUpdated', { time: lastUpdated.toLocaleTimeString() })}</span>
                  )}
                  {!subscribed && (
                    <span className="text-muted-foreground/70">• {t('dashboard.premiumAutoRefresh')}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Mobile Privacy Toggle */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={togglePrivacyMode}
                  className="sm:hidden"
                  title={privacyMode ? t('dashboard.privacyModeOn') : t('dashboard.privacyModeOff')}
                >
                  {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                
                {/* Share buttons */}
                {allTags.length > 0 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsShareDialogOpen(true)}
                      className="hidden sm:flex"
                    >
                      <Share2 className="mr-2 h-4 w-4" />
                      {t('dashboard.share')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsManageSharesOpen(true)}
                      className="hidden sm:flex"
                      title={t('share.manageTitle')}
                    >
                      <Link className="h-4 w-4" />
                    </Button>
                  </>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshPrices}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {t('dashboard.refreshPrices')}
                </Button>
              </div>
            </div>

            <PortfolioOverview portfolios={filteredPortfolios} isLoading={isLoadingEnriched} privacyMode={privacyMode} userCountry={userCountry} />

            <TagFilterBar
              allTags={allTags}
              selectedTags={selectedTags}
              onTagToggle={handleTagToggle}
              onClearAll={() => setSelectedTags([])}
              filteredCount={filteredPortfolios.length}
              totalCount={enrichedPortfolios.length}
            />

            <div className="grid md:grid-cols-2 gap-6">
              <PortfolioChart portfolios={filteredPortfolios} privacyMode={privacyMode} />
              <AllocationChart aggregatedPositions={displayAggregatedPositions} />
            </div>

            <Button 
              onClick={() => setIsAddDialogOpen(true)} 
              size="lg" 
              className="w-full md:w-auto"
            >
              <Plus className="mr-2 h-5 w-5" />
              {t('dashboard.addInvestment')}
            </Button>

            <SortableHoldingsTable 
              portfolios={filteredPortfolios} 
              aggregatedPositions={displayAggregatedPositions}
              onRefresh={fetchPortfolios}
              highlightedId={highlightedId}
              privacyMode={privacyMode}
            />
          </>
        )}
      </main>

      <AddInvestmentDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={fetchPortfolios}
      />
      
      <ShareDialog
        open={isShareDialogOpen}
        onOpenChange={setIsShareDialogOpen}
        availableTags={allTags}
      />
      
      <ManageSharesDialog
        open={isManageSharesOpen}
        onOpenChange={setIsManageSharesOpen}
      />
    </div>
  );
};

export default Dashboard;
