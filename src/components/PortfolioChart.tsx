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
  privacyMode?: boolean;
}

type TimeRange = '1M' | '1Y' | '5Y' | 'ALL';

export const PortfolioChart = ({ portfolios, privacyMode = false }: PortfolioChartProps) => {
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

    // Fetch ALL snapshots for the date range first
    const { data: snapshots } = await supabase
      .from('portfolio_snapshots')
      .select('*')
      .in('portfolio_id', portfolios.map(p => p.id))
      .gte('snapshot_date', startDate.toISOString())
      .order('snapshot_date', { ascending: true });

    // Group snapshots by date
    const snapshotsByDate = new Map<string, Map<string, number>>();
    snapshots?.forEach((snap: any) => {
      const dateKey = new Date(snap.snapshot_date).toISOString().split('T')[0];
      if (!snapshotsByDate.has(dateKey)) {
        snapshotsByDate.set(dateKey, new Map());
      }
      snapshotsByDate.get(dateKey)!.set(snap.portfolio_id, Number(snap.current_value_eur));
    });

    // Collect all unique dates: purchase dates (within range) + snapshot dates
    const allDates = new Set<string>();
    
    // Add all purchase dates within range
    portfolios.forEach(p => {
      const purchaseDate = new Date(p.purchase_date);
      if (purchaseDate >= startDate) {
        allDates.add(purchaseDate.toISOString().split('T')[0]);
      }
    });

    // Add all snapshot dates
    snapshots?.forEach((snap: any) => {
      allDates.add(new Date(snap.snapshot_date).toISOString().split('T')[0]);
    });

    // Always add today's date to show current values
    allDates.add(new Date().toISOString().split('T')[0]);
    
    // If we have pre-existing portfolios but no snapshot dates in range, add start date
    if (allDates.size === 1 && portfolios.some(p => new Date(p.purchase_date) < startDate)) {
      allDates.add(startDate.toISOString().split('T')[0]);
    }

    if (allDates.size === 0) {
      setChartData([]);
      setLoading(false);
      return;
    }

    // Sort dates chronologically
    const sortedDates = Array.from(allDates).sort();

    // Track per-portfolio values and when they were added
    const portfolioLastKnownValue = new Map<string, number>();
    const activePortfolios = new Set<string>();
    
    // Initialize portfolios that existed before chart start date
    // For these, we need to find their value at start date from snapshots
    const preExistingPortfolios = portfolios.filter(p => new Date(p.purchase_date) < startDate);
    
    for (const p of preExistingPortfolios) {
      activePortfolios.add(p.id);
      // Try to find snapshot closest to start date for this portfolio
      const portfolioSnapshots = snapshots?.filter(s => s.portfolio_id === p.id) || [];
      if (portfolioSnapshots.length > 0) {
        // Use the earliest snapshot we have as the starting value
        const earliestSnapshot = portfolioSnapshots[portfolioSnapshots.length - 1]; // Already sorted descending
        portfolioLastKnownValue.set(p.id, Number(earliestSnapshot.current_value_eur));
      } else {
        // No snapshots, use original investment
        portfolioLastKnownValue.set(p.id, Number(p.original_investment_eur));
      }
    }

    // Calculate cumulative invested before start
    let cumulativeInvested = preExistingPortfolios
      .reduce((sum, p) => sum + Number(p.original_investment_eur), 0);

    const data = sortedDates.map(dateKey => {
      // Add new investments made on this date
      portfolios.forEach(p => {
        const purchaseDateKey = new Date(p.purchase_date).toISOString().split('T')[0];
        if (purchaseDateKey === dateKey && !activePortfolios.has(p.id)) {
          cumulativeInvested += Number(p.original_investment_eur);
          activePortfolios.add(p.id);
          // Initialize with original investment value
          portfolioLastKnownValue.set(p.id, Number(p.original_investment_eur));
        }
      });

      // Update portfolio values from snapshots if available for this date
      const daySnapshots = snapshotsByDate.get(dateKey);
      if (daySnapshots) {
        daySnapshots.forEach((value, portfolioId) => {
          if (activePortfolios.has(portfolioId)) {
            portfolioLastKnownValue.set(portfolioId, value);
          }
        });
      }

      // Sum ALL active portfolio's latest known values
      let totalValue = 0;
      activePortfolios.forEach(portfolioId => {
        totalValue += portfolioLastKnownValue.get(portfolioId) || 0;
      });

      return {
        date: new Date(dateKey).toLocaleDateString('en-US', { 
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
              <span className="font-medium">{privacyMode ? '•••' : formatCurrency(invested)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Value:</span>
              <span className="font-medium">{privacyMode ? '•••' : formatCurrency(value)}</span>
            </div>
            <div className="flex justify-between gap-4 pt-1 border-t">
              <span className="text-muted-foreground">Gain/Loss:</span>
              <span className={`font-semibold ${gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {privacyMode ? '•••' : `${formatCurrency(gain)} (${gainPercent.toFixed(1)}%)`}
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
                tickFormatter={(value) => privacyMode ? '•••' : (value >= 1000 ? `€${(value / 1000).toFixed(0)}k` : `€${value.toFixed(0)}`)}
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
