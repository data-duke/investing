import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

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

export function AnalysisTable({ data, positionName }: AnalysisTableProps) {
  if (!data) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Enter investment details above to see the analysis</p>
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
    if (value > 0) return "text-success";
    if (value < 0) return "text-warning";
    return "text-foreground";
  };

  const rows = [
    { label: "Current Price", value: formatCurrency(data.currentPrice) },
    { label: "Originally Invested", value: formatCurrency(data.originallyInvested) },
    { label: "Current Value of Shares", value: formatCurrency(data.currentValue) },
    { label: "Expected Value (5 Years)", value: formatCurrency(data.expectedValue5Years) },
    { 
      label: "EBITDA Profit", 
      value: formatCurrency(data.ebitdaProfit),
      colored: true 
    },
    { 
      label: "Capital Gain (after taxes)", 
      value: formatCurrency(data.capitalGain),
      colored: true 
    },
    { 
      label: "Profit %", 
      value: formatPercent(data.profitPercent),
      colored: true 
    },
    { label: "Dividend per Share (Annual)", value: formatCurrency(data.dividendPerShare) },
    { label: "Total Dividend by Quantity (Annual)", value: formatCurrency(data.totalDividendAnnual) },
    { label: "Dividend per Share (Monthly)", value: formatCurrency(data.dividendPerShareMonthly) },
    { label: "Dividend Costs per Share", value: formatCurrency(data.dividendCosts) },
    { label: "Dividend Cost %", value: formatPercent(data.dividendCostPercent) },
    { label: "Total EBITDA Dividend (Quarterly)", value: formatCurrency(data.totalEbitdaDividendQuarterly) },
    { label: "Total EBITDA Dividend (Monthly)", value: formatCurrency(data.totalEbitdaDividendMonthly) },
    { label: "Total Dividend (Monthly)", value: formatCurrency(data.totalDividendMonthly) },
    { 
      label: "ROI from Dividends (Annual)", 
      value: formatPercent(data.roiFromDividends),
      colored: true 
    },
  ];

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">Analysis Results: {positionName}</h2>
      <ScrollArea className="w-full">
        <div className="min-w-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold">Metric</TableHead>
                <TableHead className="text-right font-semibold">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell 
                    className={`text-right font-semibold ${
                      row.colored ? getValueColor(parseFloat(row.value.replace(/[^0-9.-]+/g, ""))) : ""
                    }`}
                  >
                    {row.value}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </Card>
  );
}
