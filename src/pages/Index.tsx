import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { InvestmentForm } from "@/components/InvestmentForm";
import { AnalysisTable } from "@/components/AnalysisTable";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";
import { fetchStockData } from "@/services/stockApi";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

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

// Note: For the quick analysis tool, we use simplified tax rates
// The full portfolio tracker uses comprehensive cross-border tax calculations
const countries = {
  AT: { name: "Austria", dividendTax: 0.275, capitalGainsTax: 0.275 },
  DE: { name: "Germany", dividendTax: 0.26375, capitalGainsTax: 0.26375 },
  US: { name: "United States", dividendTax: 0.15, capitalGainsTax: 0.20 },
  UK: { name: "United Kingdom", dividendTax: 0.125, capitalGainsTax: 0.20 },
  CH: { name: "Switzerland", dividendTax: 0.35, capitalGainsTax: 0 },
  RS: { name: "Serbia", dividendTax: 0.15, capitalGainsTax: 0.15 },
};

const Index = () => {
  const { t } = useTranslation();
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [positionName, setPositionName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastSearchParams, setLastSearchParams] = useState<{ country: string; symbol: string } | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSearch = async (country: string, symbol: string, amount: number, inputQuantity: number) => {
    setIsLoading(true);
    setLastSearchParams({ country, symbol });
    try {
      const stockData = await fetchStockData(symbol);
      
      // Determine quantity and amount
      let finalQuantity = inputQuantity;
      let finalAmount = amount;
      
      if (amount && !inputQuantity) {
        // Calculate quantity from amount
        finalQuantity = amount / stockData.currentPrice;
      } else if (inputQuantity && !amount) {
        // Calculate amount from quantity
        finalAmount = inputQuantity * stockData.currentPrice;
      } else if (amount && inputQuantity) {
        // Both provided - use quantity and recalculate amount
        finalAmount = inputQuantity * stockData.currentPrice;
        toast({
          title: t('common.note'),
          description: t('toast.bothAmountAndQuantity'),
        });
      }
      
      // Calculate based on fetched data
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
  }) => {
    const country = countries[data.country as keyof typeof countries];
    
    // Current value and gain/loss
    const currentValue = data.currentPrice * data.quantity;
    const currentGain = currentValue - data.originallyInvested;
    const currentGainPercent = (currentGain / data.originallyInvested) * 100;
    
    // Dividend calculations
    const grossDividendAnnual = data.announcedDividend * data.quantity;
    const netDividendAnnual = grossDividendAnnual * (1 - country.dividendTax);
    
    // Estimate CAGR (simplified - using historical average of ~8% for stocks)
    // In a real implementation, this would be fetched from historical data
    const estimatedCAGR = 0.08; // 8% annual growth rate
    
    // Future value projections based on CAGR
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
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center justify-center gap-3 flex-1">
              <TrendingUp className="h-10 w-10 text-primary" />
              <h1 className="text-4xl font-bold text-foreground">{t('home.title')}</h1>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              {user && (
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/dashboard')}
                >
                  {t('nav.goToPortfolio')}
                </Button>
              )}
              {!user && (
                <Button 
                  variant="ghost" 
                  onClick={() => navigate('/login')}
                >
                  {t('nav.login')}
                </Button>
              )}
            </div>
          </div>
          <p className="text-muted-foreground text-lg text-center">
            {t('home.tagline')}
          </p>
        </div>

        <div className="space-y-6">
          <InvestmentForm onSearch={handleSearch} isLoading={isLoading} />
          <AnalysisTable 
            data={analysisData} 
            positionName={positionName}
            isLoggedIn={!!user}
            onNavigateToSignup={() => navigate('/signup')}
            onNavigateToDashboard={() => navigate('/dashboard')}
          />
        </div>
      </div>
    </div>
  );
};

export default Index;
