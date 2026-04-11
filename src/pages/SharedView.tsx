import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AllocationChart } from "@/components/AllocationChart";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { TrendingUp, TrendingDown, Lock, Clock, Eye, Wallet, PiggyBank, Award, Percent, ArrowUpFromLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AggregatedPosition } from "@/lib/constants";
import { formatCurrency, formatPercentage } from "@/lib/formatters";

interface SharedViewData {
  name: string | null;
  tags: string[];
  expires_at: string;
  show_values: boolean;
  positions: AggregatedPosition[];
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  totalDividend: number;
  // Net metrics
  netLiquidationValue?: number;
  capitalGainsTax?: number;
  taxRate?: number;
  grossGain?: number;
  netGain?: number;
  totalGainPercent?: number;
  totalDividendsNet?: number;
  monthlyDividends?: number;
  dividendYield?: number;
  topPerformer?: { symbol: string; gain_loss_percent: number } | null;
  safeWithdrawalTotal?: number;
  availableProfitTotal?: number;
  previousStats?: { totalValue: number; netGain: number; totalDividends: number } | null;
}

const YoYBadge = ({ current, previous, isPercent = false }: { current: number; previous: number; isPercent?: boolean }) => {
  if (previous === 0) return null;
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const isPositive = change >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}>
      {isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {isPositive ? "+" : ""}{change.toFixed(1)}% {" "}<span className="text-muted-foreground">YoY</span>
    </span>
  );
};

const SharedView = () => {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<SharedViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSharedView = async () => {
      if (!token) {
        setError("Invalid share link");
        setLoading(false);
        return;
      }
      try {
        const { data: result, error: fnError } = await supabase.functions.invoke(
          "get-shared-view",
          { body: { token } }
        );
        if (fnError) throw fnError;
        if (result.error) throw new Error(result.error);
        setData(result);
      } catch (err) {
        console.error("Error fetching shared view:", err);
        setError(err instanceof Error ? err.message : "Failed to load shared view");
      } finally {
        setLoading(false);
      }
    };
    fetchSharedView();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t("share.linkNotFound")}</h2>
            <p className="text-muted-foreground mb-4">{error || t("share.linkExpiredOrInvalid")}</p>
            <Button onClick={() => navigate("/")}>{t("share.createYourOwn")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const prev = data.previousStats;
  const privacyMode = !data.show_values;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
            <h1 className="text-lg sm:text-xl font-bold truncate">
              {data.name || t("share.sharedPortfolio")}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" className="gap-1 text-xs">
              <Eye className="h-3 w-3" />
              <span className="hidden sm:inline">{t("share.readOnly")}</span>
            </Badge>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Tags */}
        {data.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {data.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
            ))}
          </div>
        )}

        {/* Primary KPIs - mirrors PortfolioOverview */}
        <div className="space-y-3 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
                {/* Net Liquidation */}
                <div className="pb-3 md:pb-0 md:pr-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Wallet className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {t('portfolio.netLiquidationValue')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-base font-bold text-primary">
                      {privacyMode ? "•••••" : formatCurrency(data.netLiquidationValue ?? data.totalValue)}
                    </div>
                    {prev && prev.totalValue > 0 && (
                      <YoYBadge current={data.netLiquidationValue ?? data.totalValue} previous={prev.totalValue} />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {privacyMode
                      ? t('portfolio.afterTaxDesc', { rate: formatPercentage((data.taxRate ?? 0) * 100) })
                      : (data.grossGain ?? 0) > 0
                        ? `${formatCurrency(data.capitalGainsTax ?? 0)} tax (${formatPercentage((data.taxRate ?? 0) * 100)})`
                        : t('portfolio.noTaxOnLoss')}
                  </p>
                </div>

                {/* Gain/Loss */}
                <div className="py-3 md:py-0 md:px-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {t('portfolio.totalGainLoss')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`text-base font-bold ${(data.netGain ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {privacyMode ? formatPercentage(data.totalGainPercent ?? 0) : formatCurrency(data.netGain ?? data.totalGainLoss)}
                    </div>
                    {prev && prev.netGain !== 0 && (
                      <YoYBadge current={data.netGain ?? data.totalGainLoss} previous={prev.netGain} />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {privacyMode ? "" : `${formatPercentage(data.totalGainPercent ?? 0)} · ${t('portfolio.invested', { amount: formatCurrency(data.positions.reduce((s, p) => s + p.totalOriginalInvestment, 0)) })}`}
                  </p>
                </div>

                {/* Dividends */}
                <div className="pt-3 md:pt-0 md:pl-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <PiggyBank className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {t('portfolio.annualDividends')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-base font-bold">
                      {privacyMode ? `${formatPercentage(data.dividendYield ?? 0)} yield` : formatCurrency(data.totalDividendsNet ?? data.totalDividend)}
                    </div>
                    {prev && prev.totalDividends > 0 && (
                      <YoYBadge current={data.totalDividendsNet ?? data.totalDividend} previous={prev.totalDividends} />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {privacyMode ? "" : t('portfolio.monthlyAvg', { amount: formatCurrency(data.monthlyDividends ?? 0) })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Secondary KPIs */}
          <Card>
            <CardContent className="p-3">
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
                {/* Top Performer */}
                <div className="pb-2 md:pb-0 md:pr-3 flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-muted-foreground">{t('portfolio.topPerformer')}</div>
                    <div className="text-sm font-bold text-amber-600">
                      {data.topPerformer?.symbol || t('portfolio.noData')}
                      {data.topPerformer && (
                        <span className="text-[10px] font-normal text-muted-foreground ml-1">
                          +{formatPercentage(data.topPerformer.gain_loss_percent || 0)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4% Safe Withdrawal */}
                <div className="py-2 md:py-0 md:px-3 flex items-center gap-2">
                  <Percent className="h-4 w-4 text-emerald-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-muted-foreground">{t('portfolio.safeWithdrawal')}</div>
                    <div className="text-sm font-bold text-emerald-600">
                      {privacyMode ? "•••••" : `${formatCurrency(data.safeWithdrawalTotal ?? 0)}/yr`}
                    </div>
                  </div>
                </div>

                {/* Available Profit */}
                <div className="pt-2 md:pt-0 md:pl-3 flex items-center gap-2">
                  <ArrowUpFromLine className="h-4 w-4 text-green-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-muted-foreground">{t('portfolio.availableProfit')}</div>
                    <div className={`text-sm font-bold ${(data.availableProfitTotal ?? 0) > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                      {privacyMode ? "•••••" : formatCurrency(data.availableProfitTotal ?? 0)}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Allocation Chart */}
        <Card className="mb-6">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">{t("dashboard.allocation")}</CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <AllocationChart aggregatedPositions={data.positions} privacyMode={privacyMode} />
          </CardContent>
        </Card>

        {/* Holdings */}
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">{t("dashboard.holdings")}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {/* Mobile: Card layout */}
            <div className="sm:hidden space-y-3">
              {data.positions.map((pos) => {
                const allocation = ((pos.current_value_eur || 0) / data.totalValue) * 100;
                const isPositive = (pos.gain_loss_percent || 0) >= 0;
                return (
                  <div key={pos.symbol} className="bg-muted/30 rounded-lg p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono font-semibold text-sm">{pos.symbol}</div>
                      <div className="text-xs text-muted-foreground truncate">{pos.name}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-medium text-sm">
                        {data.show_values ? formatCurrency(pos.current_value_eur || 0) : `${allocation.toFixed(1)}%`}
                      </div>
                      <div className={`text-xs flex items-center justify-end gap-0.5 ${isPositive ? "text-green-500" : "text-red-500"}`}>
                        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {formatPercentage(pos.gain_loss_percent || 0)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: Table layout */}
            <table className="hidden sm:table w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium text-sm">{t("table.symbol")}</th>
                  <th className="text-left py-3 px-2 font-medium text-sm">{t("table.name")}</th>
                  <th className="text-right py-3 px-2 font-medium text-sm">
                    {data.show_values ? t("table.value") : t("table.allocation")}
                  </th>
                  <th className="text-right py-3 px-2 font-medium text-sm">{t("table.gainLoss")}</th>
                </tr>
              </thead>
              <tbody>
                {data.positions.map((pos) => (
                  <tr key={pos.symbol} className="border-b last:border-0">
                    <td className="py-3 px-2 font-mono font-medium">{pos.symbol}</td>
                    <td className="py-3 px-2 text-muted-foreground max-w-[200px] truncate">{pos.name}</td>
                    <td className="py-3 px-2 text-right">
                      {data.show_values
                        ? formatCurrency(pos.current_value_eur || 0)
                        : `${(((pos.current_value_eur || 0) / data.totalValue) * 100).toFixed(1)}%`}
                    </td>
                    <td className={`py-3 px-2 text-right ${(pos.gain_loss_percent || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {formatPercentage(pos.gain_loss_percent || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* CTA */}
        <Card className="mt-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="py-5 sm:py-6 text-center px-4">
            <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-primary mx-auto mb-2 sm:mb-3" />
            <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">{t("share.wantToTrack")}</h3>
            <p className="text-sm text-muted-foreground mb-3 sm:mb-4">{t("share.createYourPortfolio")}</p>
            <Button onClick={() => navigate("/signup")}>{t("share.signUpFree")}</Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs sm:text-sm text-muted-foreground mt-6 flex items-center justify-center gap-2">
          <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
          {new Date(data.expires_at).getFullYear() >= 9000
            ? t("share.never")
            : t("share.expiresOn", { date: new Date(data.expires_at).toLocaleDateString() })}
        </div>
      </main>
    </div>
  );
};

export default SharedView;
