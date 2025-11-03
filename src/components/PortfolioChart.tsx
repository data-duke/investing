import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Portfolio } from "@/hooks/usePortfolio";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface PortfolioChartProps {
  portfolios: Portfolio[];
}

export const PortfolioChart = ({ portfolios }: PortfolioChartProps) => {
  // For now, show current vs invested as a simple comparison
  // In future, this will use portfolio_snapshots for historical data
  const data = [
    {
      name: "Invested",
      value: portfolios.reduce((sum, p) => sum + Number(p.original_investment_eur), 0),
    },
    {
      name: "Current",
      value: portfolios.reduce((sum, p) => sum + (p.current_value_eur || 0), 0),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(value: number) => `€${value.toFixed(2)}`} />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Historical chart will populate as you track your portfolio over time
        </p>
      </CardContent>
    </Card>
  );
};
