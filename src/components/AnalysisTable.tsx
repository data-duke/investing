import { Card } from "@/components/ui/card";

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

interface AnalysisTableProps {
  data: AnalysisData | null;
  positionName: string;
}

export const AnalysisTable = ({ data, positionName }: AnalysisTableProps) => {
  if (!data) {
    return (
      <Card className="p-8 text-center bg-card border-border">
        <p className="text-muted-foreground font-mono">Enter investment details to see analysis_</p>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getValueColor = (value: number) => {
    if (value > 0) return "text-terminal-green";
    if (value < 0) return "text-terminal-red";
    return "text-foreground";
  };

  const rows = [
    { label: "Current Price", value: formatCurrency(data.currentPrice) },
    { label: "Originally Invested", value: formatCurrency(data.originallyInvested) },
    { label: "Current Value", value: formatCurrency(data.currentValue) },
    { label: "Expected Value (5Y)", value: formatCurrency(data.expectedValue5Years) },
    { 
      label: "EBITDA Profit", 
      value: formatCurrency(data.ebitdaProfit),
      colored: true,
      rawValue: data.ebitdaProfit
    },
    { 
      label: "Capital Gain", 
      value: formatCurrency(data.capitalGain),
      colored: true,
      rawValue: data.capitalGain
    },
    { 
      label: "Profit %", 
      value: formatPercent(data.profitPercent),
      colored: true,
      rawValue: data.profitPercent
    },
    { label: "Dividend/Share (Annual)", value: formatCurrency(data.dividendPerShare) },
    { label: "Total Dividend (Annual)", value: formatCurrency(data.totalDividendAnnual) },
    { label: "Dividend/Share (Monthly)", value: formatCurrency(data.dividendPerShareMonthly) },
    { label: "Dividend Costs", value: formatCurrency(data.dividendCosts) },
    { label: "Dividend Cost %", value: formatPercent(data.dividendCostPercent) },
    { label: "EBITDA Dividend (Q)", value: formatCurrency(data.totalEbitdaDividendQuarterly) },
    { label: "EBITDA Dividend (M)", value: formatCurrency(data.totalEbitdaDividendMonthly) },
    { label: "Total Dividend (M)", value: formatCurrency(data.totalDividendMonthly) },
    { 
      label: "ROI from Dividends", 
      value: formatPercent(data.roiFromDividends),
      colored: true,
      rawValue: data.roiFromDividends
    },
  ];

  return (
    <Card className="p-4 md:p-6 bg-card border-border">
      <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-terminal-yellow font-mono">
        {positionName}
      </h2>
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div 
            key={index}
            className="flex justify-between items-center py-2 border-b border-border last:border-b-0"
          >
            <span className="text-sm md:text-base text-muted-foreground font-mono">
              {row.label}
            </span>
            <span 
              className={`text-sm md:text-base font-mono font-semibold ${
                row.colored ? getValueColor(row.rawValue ?? 0) : 'text-foreground'
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
};
