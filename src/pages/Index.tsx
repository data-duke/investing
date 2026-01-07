import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { InvestmentForm } from "@/components/InvestmentForm";
import { AnalysisTable } from "@/components/AnalysisTable";
import { FeatureComparisonBanner } from "@/components/FeatureComparisonBanner";
import { PopularStocksPicker } from "@/components/PopularStocksPicker";
import { StickyCTA } from "@/components/StickyCTA";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Sparkles, Shield, Clock } from "lucide-react";
import { fetchStockData } from "@/services/stockApi";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { COUNTRY_TAX_RATES } from "@/lib/constants";

export interface AnalysisData {
  currentPrice: number;
  originallyInvested: number;
  currentValue: number;
  currentGain: number;
  currentGainPercent: number;
  grossDividendAnnual: number;
  netDividendAnnual: number;
  dividendTaxRate: number;
  projectedValue1Year: number;
  projectedValue3Years: number;
  projectedValue5Years: number;
  estimatedCAGR: number;
  quantity: number;
  exchangeRate?: number;
  currentPriceUSD?: number;
  source?: string;
  symbol?: string;
  name?: string;
  country?: string;
}

const Index = () => {
  const { t } = useTranslation();
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [positionName, setPositionName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handlePopularStockSelect = (symbol: string) => {
    setSelectedSymbol(symbol);
  };

  const handleSearch = async (country: string, symbol: string, amount: number, inputQuantity: number) => {
    setIsLoading(true);
    try {
      const stockData = await fetchStockData(symbol);
      
      let finalQuantity = inputQuantity;
      let finalAmount = amount;
      
      if (amount && !inputQuantity) {
        finalQuantity = amount / stockData.currentPrice;
      } else if (inputQuantity && !amount) {
        finalAmount = inputQuantity * stockData.currentPrice;
      } else if (amount && inputQuantity) {
        finalAmount = inputQuantity * stockData.currentPrice;
        toast({
          title: t('common.note'),
          description: t('toast.bothAmountAndQuantity'),
        });
      }
      
      calculateAnalysis({
        country,
        symbol,
        positionName: stockData.name,
        quantity: finalQuantity,
        currentPrice: stockData.currentPrice,
        originallyInvested: finalAmount,
        announcedDividend: stockData.dividend,
        exchangeRate: stockData.exchangeRate,
        currentPriceUSD: stockData.currentPriceUSD,
        source: stockData.source,
        cagr5y: stockData.cagr5y,
      });
      
      toast({
        title: t('form.dataFetched'),
        description: t('form.retrievedDataFor', { name: stockData.name }),
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : "Failed to fetch stock data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAnalysis = (data: {
    country: string;
    symbol: string;
    positionName: string;
    quantity: number;
    currentPrice: number;
    originallyInvested: number;
    announcedDividend: number;
    exchangeRate?: number;
    currentPriceUSD?: number;
    source?: string;
    cagr5y?: number;
  }) => {
    const country = COUNTRY_TAX_RATES[data.country as keyof typeof COUNTRY_TAX_RATES];
    
    const currentValue = data.currentPrice * data.quantity;
    const currentGain = currentValue - data.originallyInvested;
    const currentGainPercent = (currentGain / data.originallyInvested) * 100;
    
    const grossDividendAnnual = data.announcedDividend * data.quantity;
    const netDividendAnnual = grossDividendAnnual * (1 - country.dividendTax);
    
    // Use stock-specific CAGR if available, otherwise fall back to 8%
    const estimatedCAGR = data.cagr5y !== undefined ? data.cagr5y : 0.08;
    
    const projectedValue1Year = currentValue * Math.pow(1 + estimatedCAGR, 1);
    const projectedValue3Years = currentValue * Math.pow(1 + estimatedCAGR, 3);
    const projectedValue5Years = currentValue * Math.pow(1 + estimatedCAGR, 5);

    setAnalysisData({
      currentPrice: data.currentPrice,
      originallyInvested: data.originallyInvested,
      currentValue,
      currentGain,
      currentGainPercent,
      grossDividendAnnual,
      netDividendAnnual,
      dividendTaxRate: country.dividendTax * 100,
      projectedValue1Year,
      projectedValue3Years,
      projectedValue5Years,
      estimatedCAGR: estimatedCAGR * 100,
      quantity: data.quantity,
      exchangeRate: data.exchangeRate,
      currentPriceUSD: data.currentPriceUSD,
      source: data.source,
      symbol: data.symbol,
      name: data.positionName,
      country: data.country,
    });
    
    setPositionName(data.positionName);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section with animated background */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 pointer-events-none" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: "1s" }} />
        
        <div className="container mx-auto px-4 py-8 max-w-7xl relative">
          {/* Header */}
          <header className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{t('home.title')}</h1>
                <p className="text-sm text-muted-foreground hidden sm:block">{t('calculator.freeAnalysis')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              {user ? (
                <Button variant="outline" onClick={() => navigate('/dashboard')}>
                  {t('nav.goToPortfolio')}
                </Button>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => navigate('/login')} className="hidden sm:inline-flex">
                    {t('nav.login')}
                  </Button>
                  <Button onClick={() => navigate('/signup')}>
                    {t('nav.signup')}
                  </Button>
                </>
              )}
            </div>
          </header>

          {/* Hero Content */}
          <div className="text-center mb-8 animate-fade-in">
            <Badge variant="secondary" className="mb-4 px-4 py-1">
              <Sparkles className="h-3 w-3 mr-1" />
              {t('calculator.freeForever')}
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
              {t('home.tagline')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              {t('calculator.subtagline')}
            </p>
            
            {/* Trust Indicators */}
            <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{t('calculator.realTimeData')}</span>
              </div>
              <div className="flex items-center gap-1">
                <Shield className="h-4 w-4" />
                <span>{t('calculator.noSignupRequired')}</span>
              </div>
            </div>
          </div>

          {/* Popular Stocks Picker */}
          <div className="mb-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <PopularStocksPicker 
              onSelect={handlePopularStockSelect} 
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 pb-8 max-w-7xl">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Form Section */}
          <div className="space-y-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <InvestmentForm 
              onSearch={handleSearch} 
              isLoading={isLoading}
              prefilledSymbol={selectedSymbol}
            />
          </div>

          {/* Results Section */}
          <div className="space-y-6 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <AnalysisTable 
              data={analysisData} 
              positionName={positionName}
              isLoggedIn={!!user}
              onNavigateToSignup={() => navigate('/signup')}
              onNavigateToDashboard={() => navigate('/dashboard')}
            />
          </div>
        </div>

        {/* Feature Comparison - show after analysis or for new users */}
        {!user && (
          <div className="mt-12 animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <h3 className="text-2xl font-bold text-center mb-6">{t('comparison.title')}</h3>
            <FeatureComparisonBanner onSignUp={() => navigate('/signup')} />
          </div>
        )}
      </div>

      {/* Sticky CTA for Mobile */}
      <StickyCTA 
        show={!!analysisData && !user} 
        onSignUp={() => navigate('/signup')} 
      />
    </div>
  );
};

export default Index;
