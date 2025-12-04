import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Portfolio } from "@/hooks/usePortfolio";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, ComposedChart } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { useIsMobile } from "@/hooks/use-mobile";

interface PortfolioChartProps {
  portfolios: Portfolio[];
}

type TimeRange = '1M' | '1Y' | '5Y' | 'ALL';

export const PortfolioChart = ({ portfolios }: PortfolioChartProps) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    loadChartData();
  }, [portfolios, timeRange]);

  const loadChartData = async () => {
    if (portfolios.length === 0) {
      setChartData([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Calculate date range based on selection
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
        // Get earliest purchase date
        const earliestDate = portfolios.reduce((earliest, p) => {
          const pDate = new Date(p.purchase_date);
          return pDate < earliest ? pDate : earliest;
        }, new Date());
        startDate = earliestDate;
        break;
    }

    // Track per-portfolio values: start with original investment for portfolios purchased before start
    const portfolioLastKnownValue = new Map<string, number>();
    let cumulativeInvestedBeforeStart = 0;
    
    portfolios.forEach(p => {
      const purchaseDate = new Date(p.purchase_date);
      if (purchaseDate < startDate) {
        // Portfolio existed before chart start - use original investment as baseline
        portfolioLastKnownValue.set(p.id, Number(p.original_investment_eur));
        cumulativeInvestedBeforeStart += Number(p.original_investment_eur);
      }
    });

    // Fetch snapshots for the date range
    const { data: snapshots } = await supabase
      .from('portfolio_snapshots')
      .select('*')
      .in('portfolio_id', portfolios.map(p => p.id))
      .gte('snapshot_date', startDate.toISOString())
      .order('snapshot_date', { ascending: true });

    // Collect all unique dates: purchase dates (within range) + snapshot dates
    const allDates = new Set<string>();
    
    portfolios.forEach(p => {
      const purchaseDate = new Date(p.purchase_date);
      if (purchaseDate >= startDate) {
        allDates.add(purchaseDate.toISOString().split('T')[0]);
      }
    });

    snapshots?.forEach((snap: any) => {
      allDates.add(new Date(snap.snapshot_date).toISOString().split('T')[0]);
    });

    if (allDates.size === 0) {
      // No data points in range
      setChartData([]);
      setLoading(false);
      return;
    }

    // Group snapshots by date
    const snapshotsByDate = new Map<string, Map<string, number>>();
    snapshots?.forEach((snap: any) => {
      const dateKey = new Date(snap.snapshot_date).toISOString().split('T')[0];
      if (!snapshotsByDate.has(dateKey)) {
        snapshotsByDate.set(dateKey, new Map());
      }
      snapshotsByDate.get(dateKey)!.set(snap.portfolio_id, Number(snap.current_value_eur));
    });

    // Sort dates chronologically
    const sortedDates = Array.from(allDates).sort();
    
    // Track cumulative invested
    let cumulativeInvested = cumulativeInvestedBeforeStart;
    const existingPortfolios = new Set<string>(
      portfolios.filter(p => new Date(p.purchase_date) < startDate).map(p => p.id)
    );

    const data = sortedDates.map(dateKey => {
      const currentDate = new Date(dateKey);
      
      // Add new investments made on this date
      portfolios.forEach(p => {
        const purchaseDateKey = new Date(p.purchase_date).toISOString().split('T')[0];
        if (purchaseDateKey === dateKey && !existingPortfolios.has(p.id)) {
          cumulativeInvested += Number(p.original_investment_eur);
          existingPortfolios.add(p.id);
          // Initialize portfolio value with original investment
          portfolioLastKnownValue.set(p.id, Number(p.original_investment_eur));
        }
      });

      // Update portfolio values from snapshots if available
      const daySnapshots = snapshotsByDate.get(dateKey);
      if (daySnapshots) {
        daySnapshots.forEach((value, portfolioId) => {
          portfolioLastKnownValue.set(portfolioId, value);
        });
      }

      // Sum ALL portfolio's latest known values for this date
      let totalValue = 0;
      existingPortfolios.forEach(portfolioId => {
        const value = portfolioLastKnownValue.get(portfolioId) || 0;
        totalValue += value;
      });

      return {
        date: currentDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: isMobile ? undefined : 'numeric',
          year: isMobile ? undefined : '2-digit'
        }),
        invested: cumulativeInvested,
        value: totalValue,
      };
    });

    setChartData(data);
    setLoading(false);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const invested = payload[0]?.value || 0;
      const value = payload[1]?.value || 0;
      const gain = value - invested;
      const gainPercent = invested > 0 ? ((gain / invested) * 100) : 0;

      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-semibold mb-2">{payload[0].payload.date}</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Invested:</span>
              <span className="font-medium">{formatCurrency(invested)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Value:</span>
              <span className="font-medium">{formatCurrency(value)}</span>
            </div>
            <div className="flex justify-between gap-4 pt-1 border-t">
              <span className="text-muted-foreground">Gain/Loss:</span>
              <span className={`font-semibold ${gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(gain)} ({gainPercent.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border-primary/20 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Portfolio Performance</CardTitle>
          <div className="flex gap-1">
            {(['1M', '1Y', '5Y', 'ALL'] as TimeRange[]).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeRange(range)}
                className="text-xs px-2 py-1 h-7"
              >
                {range}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-[280px]">
            <div className="text-muted-foreground">Loading chart data...</div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[280px]">
            <div className="text-muted-foreground text-center">
              No data available for selected time range
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={isMobile ? 240 : 280} className="sm:!h-[320px]">
            <ComposedChart 
              data={chartData} 
              margin={{ top: 10, right: 10, left: isMobile ? 0 : -20, bottom: isMobile ? 30 : 5 }}
            >
              <defs>
                <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05}/>
                </linearGradient>
                <linearGradient id="positiveGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                </linearGradient>
                <linearGradient id="negativeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isMobile ? 9 : 11 }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                angle={isMobile ? -45 : 0}
                textAnchor={isMobile ? 'end' : 'middle'}
                height={isMobile ? 60 : 30}
                interval={isMobile ? Math.floor(chartData.length / 4) : 'preserveStartEnd'}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: isMobile ? 9 : 11 }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(value) => value >= 1000 ? `€${(value / 1000).toFixed(0)}k` : `€${value.toFixed(0)}`}
                width={isMobile ? 45 : 50}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: isMobile ? '11px' : '12px', paddingTop: '10px' }}
                iconType="line"
              />
              {/* Area fill between invested and value */}
              <Area
                type="monotone"
                dataKey="value"
                fill="url(#valueGradient)"
                stroke="none"
                fillOpacity={1}
              />
              {/* Invested line (baseline) */}
              <Line 
                type="monotone" 
                dataKey="invested" 
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={2}
                dot={false}
                name="Capital Invested"
                strokeDasharray="5 5"
              />
              {/* Portfolio value line */}
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={false}
                name="Portfolio Value"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
