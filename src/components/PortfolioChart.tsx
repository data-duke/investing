import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Portfolio } from "@/hooks/usePortfolio";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { AggregatedPosition } from "@/pages/Dashboard";

interface PortfolioChartProps {
  portfolios: Portfolio[];
  aggregatedPositions: AggregatedPosition[];
  selectedTags: string[];
}

type TimeRange = '1M' | '1Y' | '5Y' | 'ALL';

interface ChartDataPoint {
  date: string;
  value: number;
  invested: number;
}

export const PortfolioChart = ({ portfolios, aggregatedPositions, selectedTags }: PortfolioChartProps) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filter portfolios based on selected tags
  const filteredPortfolios = portfolios.filter(portfolio => 
    selectedTags.length === 0 || selectedTags.some(tag => portfolio.tags?.includes(tag))
  );

  useEffect(() => {
    loadChartData();
  }, [timeRange, filteredPortfolios]);

  const loadChartData = async () => {
    setIsLoading(true);
    
    try {
      const cutoffDate = getCutoffDate(timeRange);
      const portfolioIds = filteredPortfolios.map(p => p.id);
      
      if (portfolioIds.length === 0) {
        setChartData([]);
        return;
      }

      // Fetch snapshots for filtered portfolios within time range
      const { data: snapshots } = await supabase
        .from('portfolio_snapshots')
        .select('*')
        .in('portfolio_id', portfolioIds)
        .gte('snapshot_date', cutoffDate.toISOString())
        .order('snapshot_date', { ascending: true });

      if (!snapshots || snapshots.length === 0) {
        // Fallback to simple current vs invested comparison
        const totalInvested = filteredPortfolios.reduce((sum, p) => sum + Number(p.original_investment_eur), 0);
        const totalCurrent = filteredPortfolios.reduce((sum, p) => sum + (p.current_value_eur || 0), 0);
        
        setChartData([
          { date: 'Invested', value: totalInvested, invested: totalInvested },
          { date: 'Current', value: totalCurrent, invested: totalInvested },
        ]);
        return;
      }

      // Group snapshots by date and aggregate values
      const groupedData = snapshots.reduce((acc, snapshot) => {
        const date = new Date(snapshot.snapshot_date).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { totalValue: 0, count: 0 };
        }
        acc[date].totalValue += snapshot.current_value_eur;
        acc[date].count += 1;
        return acc;
      }, {} as Record<string, { totalValue: number; count: number }>);

      const totalInvested = filteredPortfolios.reduce((sum, p) => sum + Number(p.original_investment_eur), 0);

      const processedData = Object.entries(groupedData)
        .map(([date, data]) => ({
          date: new Date(date).toLocaleDateString('de-DE', { 
            month: 'short', 
            day: 'numeric',
            ...(timeRange === '5Y' || timeRange === 'ALL' ? { year: '2-digit' } : {})
          }),
          value: data.totalValue,
          invested: totalInvested,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setChartData(processedData);
    } catch (error) {
      console.error('Error loading chart data:', error);
      // Fallback data
      const totalInvested = filteredPortfolios.reduce((sum, p) => sum + Number(p.original_investment_eur), 0);
      const totalCurrent = filteredPortfolios.reduce((sum, p) => sum + (p.current_value_eur || 0), 0);
      
      setChartData([
        { date: 'Invested', value: totalInvested, invested: totalInvested },
        { date: 'Current', value: totalCurrent, invested: totalInvested },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const getCutoffDate = (range: TimeRange): Date => {
    const now = new Date();
    switch (range) {
      case '1M':
        return new Date(now.setMonth(now.getMonth() - 1));
      case '1Y':
        return new Date(now.setFullYear(now.getFullYear() - 1));
      case '5Y':
        return new Date(now.setFullYear(now.getFullYear() - 5));
      case 'ALL':
      default:
        return new Date(2020, 0, 1); // Start from 2020
    }
  };

  const timeRangeButtons: { label: string; value: TimeRange }[] = [
    { label: '1M', value: '1M' },
    { label: '1Y', value: '1Y' },
    { label: '5Y', value: '5Y' },
    { label: 'ALL', value: 'ALL' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Portfolio Performance</CardTitle>
          <div className="flex gap-1">
            {timeRangeButtons.map((button) => (
              <Button
                key={button.value}
                variant={timeRange === button.value ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeRange(button.value)}
                className="h-8 px-3 text-xs"
              >
                {button.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="date" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickFormatter={(value) => formatCurrency(value).replace('€', '€')}
            />
            <Tooltip 
              formatter={(value: number, name: string) => [
                formatCurrency(value),
                name === 'value' ? 'Portfolio Value' : 'Invested Amount'
              ]}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              name="Portfolio Value"
              dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
            />
            {chartData.length > 2 && (
              <Line 
                type="monotone" 
                dataKey="invested" 
                stroke="hsl(var(--muted-foreground))" 
                strokeWidth={1}
                strokeDasharray="5 5"
                name="Invested Amount"
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
        {chartData.length <= 2 && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Historical chart will populate as you track your portfolio over time
          </p>
        )}
        {isLoading && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Loading chart data...
          </p>
        )}
      </CardContent>
    </Card>
  );
};
