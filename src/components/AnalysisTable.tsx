import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Save, TrendingUp } from "lucide-react";

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

interface AnalysisTableProps {
  data: AnalysisData | null;
  positionName: string;
  isLoggedIn: boolean;
  onNavigateToSignup: () => void;
  onNavigateToDashboard: () => void;
}

export const AnalysisTable = ({ data, positionName, isLoggedIn, onNavigateToSignup, onNavigateToDashboard }: AnalysisTableProps) => {
  const [isSaving, setIsSaving] = useState(false);
  const { addInvestment } = usePortfolio();
  const { toast } = useToast();

  const handleSaveToPortfolio = async () => {
    if (!data || !data.symbol || !data.country) return;
    
    setIsSaving(true);
    try {
      const originalPriceEur = data.originallyInvested / data.quantity;
      
      const result = await addInvestment({
        symbol: data.symbol,
        name: data.name || positionName,
        country: data.country,
        quantity: data.quantity,
        original_price_eur: originalPriceEur,
        original_investment_eur: data.originallyInvested,
        purchase_date: new Date().toISOString(),
      });

      if (!result.error) {
        toast({
          title: "Investment saved!",
          description: "Your investment has been added to your portfolio.",
        });
        onNavigateToDashboard();
      }
    } catch (error) {
      toast({
        title: "Error saving investment",
        description: error instanceof Error ? error.message : "Failed to save",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignUpClick = () => {
    if (!data || !data.symbol || !data.country) return;
    
    // Store pending investment in sessionStorage
    const pendingInvestment = {
      symbol: data.symbol,
      name: data.name || positionName,
      country: data.country,
      quantity: data.quantity,
      originallyInvested: data.originallyInvested,
      originalPrice: data.originallyInvested / data.quantity,
      purchase_date: new Date().toISOString(),
    };
    
    sessionStorage.setItem('pendingInvestment', JSON.stringify(pendingInvestment));
    onNavigateToSignup();
  };
  if (!data) {
    return (
      <Card className="p-6 bg-card border-border">
        <p className="text-muted-foreground text-center">
          Enter investment details above to see analysis
        </p>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getValueColor = (value: number) => {
    if (value > 0) return "text-green-500";
    if (value < 0) return "text-red-500";
    return "text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-card border-border">
        <h2 className="text-2xl font-bold text-foreground mb-6">{positionName}</h2>
        
        {/* Exchange Rate Info */}
        {data.exchangeRate && data.currentPriceUSD && (
          <div className="mb-6 p-3 bg-muted/50 rounded-md">
            <p className="text-sm text-muted-foreground">
              Exchange Rate: <span className="font-semibold text-foreground">1 USD = {data.exchangeRate.toFixed(4)} EUR</span>
              {' '} | Price in USD: <span className="font-semibold text-foreground">${data.currentPriceUSD.toFixed(2)}</span>
            </p>
          </div>
        )}
        
        {/* Investment Summary Section */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-terminal-yellow mb-4">Investment Summary</h3>
          <div className="space-y-3 font-mono">
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Initial Investment:</span>
              <span className="text-foreground font-semibold">{formatCurrency(data.originallyInvested)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Current Price per Share:</span>
              <span className="text-foreground">{formatCurrency(data.currentPrice)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Quantity Owned:</span>
              <span className="text-foreground">{data.quantity.toFixed(2)} shares</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Current Market Value:</span>
              <span className="text-foreground font-semibold">{formatCurrency(data.currentValue)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Gain/Loss:</span>
              <span className={`font-semibold ${getValueColor(data.currentGain)}`}>
                {formatCurrency(data.currentGain)} ({formatPercent(data.currentGainPercent)})
              </span>
            </div>
          </div>
        </div>

        {/* Dividends Section */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-terminal-yellow mb-4">Dividends</h3>
          {data.grossDividendAnnual > 0 ? (
            <div className="space-y-3 font-mono">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Gross Annual Dividend:</span>
                <span className="text-foreground">{formatCurrency(data.grossDividendAnnual)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Tax Rate:</span>
                <span className="text-foreground">{data.dividendTaxRate.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Net Annual Dividend (After Tax):</span>
                <span className="text-foreground font-semibold">{formatCurrency(data.netDividendAnnual)}</span>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-muted-foreground italic mb-2">No dividends applicable for this asset.</p>
              {data.source === 'Stooq' && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3">
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    ℹ️ Dividend data unavailable (using fallback data source). This may be due to API limitations or the stock may not pay dividends.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Future Value Projections Section */}
        <div>
          <h3 className="text-xl font-semibold text-terminal-yellow mb-4">Future Value Projections</h3>
          <div className="space-y-3 font-mono mb-4">
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">1 Year:</span>
              <span className="text-foreground">{formatCurrency(data.projectedValue1Year)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">3 Years:</span>
              <span className="text-foreground">{formatCurrency(data.projectedValue3Years)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">5 Years:</span>
              <span className="text-foreground">{formatCurrency(data.projectedValue5Years)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Estimated CAGR:</span>
              <span className="text-foreground">{data.estimatedCAGR.toFixed(2)}%</span>
            </div>
          </div>
          <div className="bg-muted/50 p-4 rounded-md">
            <p className="text-sm text-muted-foreground italic">
              <strong>Disclaimer:</strong> Projections are based on historical data and estimated growth rates. 
              Past performance does not predict future results. These are estimates only and actual returns may vary significantly.
            </p>
          </div>
        </div>
      </Card>

      {/* Save to Portfolio CTA */}
      {isLoggedIn ? (
        <Card className="p-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Track this investment
              </h3>
              <p className="text-sm text-muted-foreground">
                Save to your portfolio and monitor performance over time
              </p>
            </div>
            <Button 
              onClick={handleSaveToPortfolio}
              disabled={isSaving}
              size="lg"
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save to Portfolio"}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <div className="text-center space-y-4">
            <div>
              <h3 className="text-xl font-semibold mb-2 flex items-center justify-center gap-2">
                <TrendingUp className="h-6 w-6 text-primary" />
                Want to track your investments?
              </h3>
              <p className="text-muted-foreground">
                Create a free account to save and monitor your portfolio performance
              </p>
            </div>
            <Button onClick={handleSignUpClick} size="lg">
              Sign Up Free
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
