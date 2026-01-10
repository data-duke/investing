import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePrivacy } from "@/contexts/PrivacyContext";
import { formatCurrency, formatPercentage } from "@/lib/formatters";

interface AggregatedPosition {
  symbol: string;
  name: string;
  totalQuantity: number;
  totalOriginalInvestment: number;
  current_value_eur?: number;
}

interface AllocationChartProps {
  aggregatedPositions: AggregatedPosition[];
  privacyMode?: boolean;
}

export const AllocationChart = ({ aggregatedPositions, privacyMode: privacyModeProp }: AllocationChartProps) => {
  const isMobile = useIsMobile();
  const { privacyMode: contextPrivacyMode } = usePrivacy();
  const privacyMode = privacyModeProp ?? contextPrivacyMode;

  if (aggregatedPositions.length === 0) {
    return (
      <Card className="border-primary/20 shadow-lg">
        <CardHeader>
          <CardTitle>Asset Allocation</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[280px]">
          <p className="text-muted-foreground">No positions available</p>
        </CardContent>
      </Card>
    );
  }

  // Sort by value and take top 7, group rest as "Others"
  const sorted = [...aggregatedPositions]
    .filter(p => p.current_value_eur && p.current_value_eur > 0)
    .sort((a, b) => (b.current_value_eur || 0) - (a.current_value_eur || 0));

  const topPositions = sorted.slice(0, 7);
  const othersPositions = sorted.slice(7);
  
  const data = topPositions.map(pos => ({
    name: pos.symbol,
    fullName: pos.name,
    value: pos.current_value_eur || 0,
  }));

  if (othersPositions.length > 0) {
    const othersValue = othersPositions.reduce((sum, p) => sum + (p.current_value_eur || 0), 0);
    data.push({
      name: "Others",
      fullName: `${othersPositions.length} other positions`,
      value: othersValue,
    });
  }

  const totalValue = data.reduce((sum, item) => sum + item.value, 0);

  const COLORS = [
    'hsl(var(--primary))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
    'hsl(var(--accent))',
    'hsl(var(--muted-foreground))',
    'hsl(var(--secondary))',
  ];

  interface ChartPayloadData {
    name: string;
    fullName: string;
    value: number;
  }

  interface TooltipPayloadItem {
    payload: ChartPayloadData;
  }

  interface CustomTooltipProps {
    active?: boolean;
    payload?: TooltipPayloadItem[];
  }

  const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = (data.value / totalValue) * 100;
      
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-sm mb-1">{data.name}</p>
          <p className="text-xs text-muted-foreground mb-2">{data.fullName}</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Value:</span>
              <span className="font-medium">{privacyMode ? "•••" : formatCurrency(data.value)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Allocation:</span>
              <span className="font-medium">{formatPercentage(percentage, 1)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderLabel = (entry: any) => {
    if (isMobile) {
      // On mobile, only show percentage for slices > 8%
      const percentage = (entry.value / totalValue) * 100;
      return percentage > 8 ? `${percentage.toFixed(0)}%` : '';
    }
    // On desktop, show symbol + percentage
    const percentage = (entry.value / totalValue) * 100;
    return `${entry.name} ${percentage.toFixed(1)}%`;
  };

  return (
    <Card className="border-primary/20 shadow-lg">
      <CardHeader>
        <CardTitle>Asset Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={isMobile ? 240 : 280} className="sm:!h-[320px]">
          <PieChart>
            <defs>
              {COLORS.map((color, index) => (
                <linearGradient key={index} id={`gradient${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                </linearGradient>
              ))}
            </defs>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={!isMobile}
              label={renderLabel}
              outerRadius={isMobile ? 70 : 90}
              innerRadius={isMobile ? 40 : 50}
              fill="hsl(var(--primary))"
              dataKey="value"
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={`url(#gradient${index % COLORS.length})`}
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            {isMobile && (
              <Legend 
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
                iconType="circle"
                iconSize={8}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-4 text-center space-y-1">
          <p className="text-sm text-muted-foreground">
            Total Portfolio Value: <span className="font-semibold text-foreground">{privacyMode ? "•••" : formatCurrency(totalValue)}</span>
          </p>
          {othersPositions.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Showing top 7 positions, {othersPositions.length} grouped as "Others"
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
