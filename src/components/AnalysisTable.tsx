import { Card } from "@/components/ui/card";

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
}

interface AnalysisTableProps {
  data: AnalysisData | null;
  positionName: string;
}

export const AnalysisTable = ({ data, positionName }: AnalysisTableProps) => {
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
            <p className="text-muted-foreground italic">No dividends applicable for this asset.</p>
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
    </div>
  );
};
