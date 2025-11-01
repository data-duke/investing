import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Asset Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => `€${value.toFixed(2)}`} />
          </PieChart>
        </ResponsiveContainer>
        {aggregatedPositions.length > 8 && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Showing top 7 positions + Others for clarity
          </p>
        )}
      </CardContent>
    </Card>
  );
};
