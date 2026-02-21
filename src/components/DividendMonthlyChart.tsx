import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@/lib/formatters";

interface DividendEvent {
  symbol: string;
  name: string;
  exDate: Date;
  paymentDate: Date | null;
  amount: number;
  quantity: number;
  totalAmount: number;
  isPast: boolean;
}

interface DividendMonthlyChartProps {
  dividendEvents: DividendEvent[];
  privacyMode: boolean;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const DividendMonthlyChart = ({ dividendEvents, privacyMode }: DividendMonthlyChartProps) => {
  const { t } = useTranslation();
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const chartData = useMemo(() => {
    const monthlyAmounts = new Array(12).fill(0);

    dividendEvents.forEach(event => {
      const date = event.paymentDate || event.exDate;
      if (date.getFullYear() === currentYear) {
        monthlyAmounts[date.getMonth()] += event.totalAmount;
      }
    });

    return MONTH_LABELS.map((month, i) => ({
      month,
      amount: Math.round(monthlyAmounts[i] * 100) / 100,
    }));
  }, [dividendEvents, currentYear]);

  const hasData = chartData.some(d => d.amount > 0);

  if (!hasData) return null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-md">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-green-600 font-semibold">
          {privacyMode ? "•••" : formatCurrency(payload[0].value)}
        </p>
      </div>
    );
  };

  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold mb-2 text-muted-foreground">
        {t("dividend.monthlyIncome")}
      </h4>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="fill-muted-foreground"
          />
          <YAxis
            tick={privacyMode ? false : { fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={privacyMode ? 10 : 45}
            tickFormatter={(v) => `€${v}`}
            className="fill-muted-foreground"
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", radius: 4 }} />
          <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={32}>
            {chartData.map((_, i) => (
              <Cell
                key={i}
                fill={i === currentMonth ? "hsl(142, 71%, 40%)" : "hsl(142, 71%, 55%)"}
                opacity={i === currentMonth ? 1 : 0.7}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
