import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Portfolio } from "@/hooks/usePortfolio";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";

interface PortfolioChartProps {
  portfolios: Portfolio[];
}

type TimeRange = '1M' | '1Y' | '5Y' | 'ALL';

export const PortfolioChart = ({ portfolios }: PortfolioChartProps) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChartData();
  }, [portfolios, timeRange]);

  const loadChartData = async () => {
    if (portfolios.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (timeRange) {
      case '1M':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case '1Y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case '5Y':
        startDate.setFullYear(now.getFullYear() - 5);
        break;
      case 'ALL':
        startDate = new Date(0); // Beginning of time
        break;
    }

    // Fetch snapshots for all portfolios in the selected range
    const portfolioIds = portfolios.map(p => p.id);
    const { data: snapshots } = await supabase
      .from('portfolio_snapshots')
      .select('*')
      .in('portfolio_id', portfolioIds)
      .gte('snapshot_date', startDate.toISOString())
      .order('snapshot_date', { ascending: true });

    if (!snapshots || snapshots.length === 0) {
      // No historical data, show current vs invested
      const totalInvested = portfolios.reduce((sum, p) => sum + Number(p.original_investment_eur), 0);
      const totalCurrent = portfolios.reduce((sum, p) => sum + (p.current_value_eur || 0), 0);
      
      setChartData([
        { date: 'Invested', value: totalInvested },
        { date: 'Current', value: totalCurrent },
      ]);
      setLoading(false);
      return;
    }

    // Group snapshots by date and sum values
    const groupedByDate = snapshots.reduce((acc, snap) => {
      const date = new Date(snap.snapshot_date).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = 0;
      }
      acc[date] += Number(snap.current_value_eur);
      return acc;
    }, {} as Record<string, number>);

    const data = Object.entries(groupedByDate)
      .map(([date, value]) => ({
        date: new Date(date).toLocaleDateString(),
        value: value,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    setChartData(data);
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Portfolio Performance</CardTitle>
          <div className="flex gap-1">
            {(['1M', '1Y', '5Y', 'ALL'] as TimeRange[]).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange(range)}
              >
                {range}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Loading chart data...
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No data available for selected time range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} name="Portfolio Value" />
            </LineChart>
          </ResponsiveContainer>
        )}
        {chartData.length < 3 && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Historical chart will populate as you track your portfolio over time
          </p>
        )}
      </CardContent>
    </Card>
  );
};
