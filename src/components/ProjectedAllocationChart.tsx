import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePrivacy } from "@/contexts/PrivacyContext";
import { formatCurrency, formatPercentage } from "@/lib/formatters";
import { useTranslation } from "react-i18next";

interface PositionWithCAGR {
  symbol: string;
  name: string;
  current_value_eur?: number;
  cagr_5y?: number;
}

interface ProjectedAllocationChartProps {
  positions: PositionWithCAGR[];
  privacyMode?: boolean;
}

const DEFAULT_CAGR = 0.08; // 8% default market average
const MAX_CAGR = 0.25; // 25% cap for more realistic projections

export const ProjectedAllocationChart = ({ positions, privacyMode: privacyModeProp }: ProjectedAllocationChartProps) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { privacyMode: contextPrivacyMode } = usePrivacy();
  const privacyMode = privacyModeProp ?? contextPrivacyMode;

  if (positions.length === 0) {
    return (
      <Card className="border-primary/20 shadow-lg">
        <CardHeader>
          <CardTitle>{t('dashboard.projectedAllocation')}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[280px]">
          <p className="text-muted-foreground">{t('dashboard.noPositions')}</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate projected values (5 years) with CAGR capped at MAX_CAGR for realistic projections
  const projectedPositions = positions
    .filter(p => p.current_value_eur && p.current_value_eur > 0)
    .map(p => {
      const rawCagr = p.cagr_5y ?? DEFAULT_CAGR;
      // Cap CAGR at MAX_CAGR to prevent unrealistic projections
      const cagr = Math.min(rawCagr, MAX_CAGR);
      const projectedValue = (p.current_value_eur || 0) * Math.pow(1 + cagr, 5);
      return {
        ...p,
        projectedValue,
        cagr,
        rawCagr, // Keep original for display
        currentValue: p.current_value_eur || 0,
      };
    })
    .sort((a, b) => b.projectedValue - a.projectedValue);

  const topPositions = projectedPositions.slice(0, 7);
  const othersPositions = projectedPositions.slice(7);

  const data = topPositions.map(pos => ({
    name: pos.symbol,
    fullName: pos.name,
    value: pos.projectedValue,
    currentValue: pos.currentValue,
    cagr: pos.cagr,
  }));

  if (othersPositions.length > 0) {
    const othersValue = othersPositions.reduce((sum, p) => sum + p.projectedValue, 0);
    const othersCurrentValue = othersPositions.reduce((sum, p) => sum + p.currentValue, 0);
    const avgCagr = othersPositions.reduce((sum, p) => sum + p.cagr, 0) / othersPositions.length;
    data.push({
      name: t('dashboard.others'),
      fullName: `${othersPositions.length} ${t('dashboard.otherPositions')}`,
      value: othersValue,
      currentValue: othersCurrentValue,
      cagr: avgCagr,
    });
  }

  const totalProjectedValue = data.reduce((sum, item) => sum + item.value, 0);
  const totalCurrentValue = data.reduce((sum, item) => sum + item.currentValue, 0);

  const COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
    'hsl(var(--accent))',
    'hsl(var(--muted-foreground))',
    'hsl(var(--secondary))',
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      const percentage = (d.value / totalProjectedValue) * 100;
      const growth = ((d.value - d.currentValue) / d.currentValue) * 100;

      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-sm mb-1">{d.name}</p>
          <p className="text-xs text-muted-foreground mb-2">{d.fullName}</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t('dashboard.currentValue')}:</span>
              <span className="font-medium">{privacyMode ? "•••" : formatCurrency(d.currentValue)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t('dashboard.projectedValue')}:</span>
              <span className="font-medium text-primary">{privacyMode ? "•••" : formatCurrency(d.value)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t('dashboard.cagr')}:</span>
              <span className={`font-medium ${d.cagr >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatPercentage(d.cagr * 100, 1)}
              </span>
            </div>
            <div className="flex justify-between gap-4 pt-1 border-t">
              <span className="text-muted-foreground">{t('dashboard.allocation')}:</span>
              <span className="font-medium">{formatPercentage(percentage, 1)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t('dashboard.growth5Y')}:</span>
              <span className={`font-medium ${growth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                +{formatPercentage(growth, 0)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderLabel = (entry: any) => {
    if (isMobile) {
      const percentage = (entry.value / totalProjectedValue) * 100;
      return percentage > 8 ? `${percentage.toFixed(0)}%` : '';
    }
    const percentage = (entry.value / totalProjectedValue) * 100;
    return `${entry.name} ${percentage.toFixed(1)}%`;
  };

  return (
    <Card className="border-primary/20 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t('dashboard.projectedAllocation')}
          <span className="text-xs font-normal text-muted-foreground">({t('dashboard.5years')})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={isMobile ? 240 : 280} className="sm:!h-[320px]">
          <PieChart>
            <defs>
              {COLORS.map((color, index) => (
                <linearGradient key={index} id={`projGradient${index}`} x1="0" y1="0" x2="0" y2="1">
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
                  fill={`url(#projGradient${index % COLORS.length})`}
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
            {t('dashboard.projectedTotal')}: <span className="font-semibold text-primary">{privacyMode ? "•••" : formatCurrency(totalProjectedValue)}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {t('dashboard.currentTotal')}: {privacyMode ? "•••" : formatCurrency(totalCurrentValue)} → {t('dashboard.projectedGrowth')}: <span className="text-green-500 font-medium">+{formatPercentage(((totalProjectedValue - totalCurrentValue) / totalCurrentValue) * 100, 0)}</span>
          </p>
          <p className="text-xs text-muted-foreground/70 italic mt-2">
            {t('dashboard.cagrDisclaimer')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};