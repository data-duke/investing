import { useState } from "react";
import { InvestmentForm } from "@/components/InvestmentForm";
import { AnalysisTable } from "@/components/AnalysisTable";
import { TrendingUp } from "lucide-react";
import { fetchStockData } from "@/services/stockApi";
import { useToast } from "@/hooks/use-toast";

interface AnalysisData {
  currentPrice: number;
  originallyInvested: number;
  currentValue: number;
  expectedValue5Years: number;
  ebitdaProfit: number;
  capitalGain: number;
  profitPercent: number;
  dividendPerShare: number;
  totalDividendAnnual: number;
  dividendPerShareMonthly: number;
  dividendCosts: number;
  dividendCostPercent: number;
  totalEbitdaDividendQuarterly: number;
  totalEbitdaDividendMonthly: number;
  totalDividendMonthly: number;
  roiFromDividends: number;
  shareQuantityRatio: number;
}

const countries = {
  AT: { name: "Austria", dividendTax: 0.275, capitalGainsTax: 0.275 },
  DE: { name: "Germany", dividendTax: 0.26375, capitalGainsTax: 0.26375 },
  US: { name: "United States", dividendTax: 0.15, capitalGainsTax: 0.20 },
  UK: { name: "United Kingdom", dividendTax: 0.125, capitalGainsTax: 0.20 },
  CH: { name: "Switzerland", dividendTax: 0.35, capitalGainsTax: 0 },
};

const Index = () => {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [positionName, setPositionName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSearch = async (country: string, symbol: string, quantity: number) => {
    setIsLoading(true);
    try {
      const stockData = await fetchStockData(symbol);
      
      // Calculate based on fetched data
      calculateAnalysis({
        country,
        positionName: stockData.name,
        quantity,
        currentPrice: stockData.currentPrice,
        originallyInvested: stockData.currentPrice * quantity, // Computed
        expectedPrice5Years: stockData.currentPrice * 1.5, // Simple projection (could be improved)
        announcedDividend: stockData.dividend,
      });
      
      toast({
        title: "Data fetched successfully",
        description: `Retrieved data for ${stockData.name}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch stock data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAnalysis = (data: {
    country: string;
    positionName: string;
    quantity: number;
    currentPrice: number;
    originallyInvested: number;
    expectedPrice5Years: number;
    announcedDividend: number;
  }) => {
    const country = countries[data.country as keyof typeof countries];
    const transactionCost = 0.01; // 1% transaction cost

    // Basic calculations
    const currentValue = data.currentPrice * data.quantity;
    const expectedValue5Years = data.expectedPrice5Years * data.quantity;
    
    // Capital gains
    const grossCapitalGain = expectedValue5Years - data.originallyInvested;
    const capitalGainsTax = grossCapitalGain * country.capitalGainsTax;
    const transactionCosts = expectedValue5Years * transactionCost;
    const capitalGain = grossCapitalGain - capitalGainsTax - transactionCosts;
    
    // Profit calculations
    const ebitdaProfit = currentValue - data.originallyInvested;
    const profitPercent = (ebitdaProfit / data.originallyInvested) * 100;
    
    // Dividend calculations
    const totalDividendAnnual = data.announcedDividend * data.quantity;
    const dividendCosts = totalDividendAnnual * country.dividendTax;
    const netDividendAnnual = totalDividendAnnual - dividendCosts;
    const dividendPerShareMonthly = data.announcedDividend / 12;
    const totalDividendMonthly = totalDividendAnnual / 12;
    const totalEbitdaDividendMonthly = netDividendAnnual / 12;
    const totalEbitdaDividendQuarterly = netDividendAnnual / 4;
    
    const roiFromDividends = data.originallyInvested > 0 
      ? (netDividendAnnual / data.originallyInvested) * 100 
      : 0;
    
    const dividendCostPercent = country.dividendTax * 100;

    setAnalysisData({
      currentPrice: data.currentPrice,
      originallyInvested: data.originallyInvested,
      currentValue,
      expectedValue5Years,
      ebitdaProfit,
      capitalGain,
      profitPercent,
      dividendPerShare: data.announcedDividend,
      totalDividendAnnual,
      dividendPerShareMonthly,
      dividendCosts,
      dividendCostPercent,
      totalEbitdaDividendQuarterly,
      totalEbitdaDividendMonthly,
      totalDividendMonthly,
      roiFromDividends,
      shareQuantityRatio: 0, // This would need total shares data
    });
    
    setPositionName(data.positionName);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <TrendingUp className="h-10 w-10 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">Investment Analyzer</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Make informed investment decisions with comprehensive cost-benefit analysis
          </p>
        </div>

        <div className="space-y-6">
          <InvestmentForm onSearch={handleSearch} isLoading={isLoading} />
          <AnalysisTable data={analysisData} positionName={positionName} />
        </div>
      </div>
    </div>
  );
};

export default Index;
