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
    <Card className="border-primary/20 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Portfolio Performance
            <span className="text-xs font-normal text-muted-foreground">€ EUR</span>
          </CardTitle>
          <div className="flex gap-1">
            {(['1M', '1Y', '5Y', 'ALL'] as TimeRange[]).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? 'default' : 'ghost'}
                size="sm"
                className={timeRange === range ? 'bg-primary/20 hover:bg-primary/30' : ''}
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
          <div className="h-[280px] sm:h-[320px] flex items-center justify-center text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading chart data...</span>
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[280px] sm:h-[320px] flex items-center justify-center text-muted-foreground text-sm">
            No data available for selected time range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280} className="sm:!h-[320px]">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                width={50}
              />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)} 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  color: 'hsl(var(--foreground))',
                  fontSize: '12px'
                }}
                labelStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: '11px' }}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                fill="url(#valueGradient)"
                name="Portfolio Value"
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 3 }}
                activeDot={{ r: 5, stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
        {chartData.length < 3 && chartData.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3 text-center px-4">
            💡 Historical chart will become more detailed as you track your portfolio over time
          </p>
        )}
      </CardContent>
    </Card>
  );
};
