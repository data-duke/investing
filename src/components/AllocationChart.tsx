import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";

interface AggregatedPosition {
  symbol: string;
  name: string;
  current_value_eur?: number;
  totalOriginalInvestment: number;
}

interface AllocationChartProps {
  aggregatedPositions: AggregatedPosition[];
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export const AllocationChart = ({ aggregatedPositions }: AllocationChartProps) => {
  // Smart aggregation: if more than 8 positions, show top 7 + "Others"
  let chartData = aggregatedPositions.map((p) => ({
    name: p.symbol,
    value: p.current_value_eur || p.totalOriginalInvestment,
  })).sort((a, b) => b.value - a.value);

  if (chartData.length > 8) {
    const top7 = chartData.slice(0, 7);
    const othersValue = chartData.slice(7).reduce((sum, item) => sum + item.value, 0);
    chartData = [...top7, { name: "Others", value: othersValue }];
  }

  const totalValue = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="border-secondary/20 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Asset Allocation
          <span className="text-xs font-normal text-muted-foreground">
            Total: €{totalValue.toFixed(2)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-[280px] sm:h-[320px] flex items-center justify-center text-muted-foreground text-sm">
            No positions available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280} className="sm:!h-[320px]">
            <PieChart>
              <defs>
                {chartData.map((_, index) => (
                  <linearGradient key={`gradient-${index}`} id={`colorGradient${index}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.9}/>
                    <stop offset="100%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.6}/>
                  </linearGradient>
                ))}
              </defs>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={window.innerWidth < 640 ? 50 : 70}
                outerRadius={window.innerWidth < 640 ? 80 : 105}
                paddingAngle={2}
                label={(props) => {
                  const { cx, cy, midAngle, innerRadius, outerRadius, name, percent } = props;
                  const isMobile = window.innerWidth < 640;
                  const RADIAN = Math.PI / 180;
                  const radius = outerRadius + (isMobile ? 15 : 25);
                  const x = cx + radius * Math.cos(-midAngle * RADIAN);
                  const y = cy + radius * Math.sin(-midAngle * RADIAN);
                  
                  return (
                    <text
                      x={x}
                      y={y}
                      fill="hsl(var(--foreground))"
                      textAnchor={x > cx ? 'start' : 'end'}
                      dominantBaseline="central"
                      className="font-bold text-xs sm:text-sm"
                      style={{ 
                        textShadow: '2px 2px 4px hsl(var(--background)), -1px -1px 4px hsl(var(--background))',
                        paintOrder: 'stroke fill'
                      }}
                    >
                      {isMobile ? `${(percent * 100).toFixed(0)}%` : `${name} ${(percent * 100).toFixed(1)}%`}
                    </text>
                  );
                }}
              >
                {chartData.map((_, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`url(#colorGradient${index})`}
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => `€${value.toFixed(2)}`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  color: 'hsl(var(--foreground))',
                  fontSize: '12px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
        {aggregatedPositions.length > 8 && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            📊 Showing top 7 positions + Others for clarity
          </p>
        )}
      </CardContent>
    </Card>
  );
};
