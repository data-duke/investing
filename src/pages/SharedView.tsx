import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AllocationChart } from "@/components/AllocationChart";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { TrendingUp, Lock, Clock, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AggregatedPosition } from "@/lib/constants";

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
}

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
          {
            body: { token },
          }
        );

        if (fnError) throw fnError;
        if (result.error) throw new Error(result.error);

        setData(result);
      } catch (err) {
        console.error("Error fetching shared view:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load shared view"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSharedView();
  }, [token]);

  const formatCurrency = (value: number) => {
    if (!data?.show_values) return "•••";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

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
            <h2 className="text-xl font-semibold mb-2">
              {t("share.linkNotFound")}
            </h2>
            <p className="text-muted-foreground mb-4">
              {error || t("share.linkExpiredOrInvalid")}
            </p>
            <Button onClick={() => navigate("/")}>
              {t("share.createYourOwn")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">
              {data.name || t("share.sharedPortfolio")}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Eye className="h-3 w-3" />
              {t("share.readOnly")}
            </Badge>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-6">
          {data.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("dashboard.totalValue")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(data.totalValue)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("dashboard.totalGainLoss")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  data.totalGainLoss >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {data.show_values
                  ? formatCurrency(data.totalGainLoss)
                  : formatPercent(data.totalGainLossPercent)}
              </div>
              {data.show_values && (
                <div className="text-sm text-muted-foreground">
                  {formatPercent(data.totalGainLossPercent)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("dashboard.annualDividend")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(data.totalDividend)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("dashboard.positions")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.positions.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Allocation Chart */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("dashboard.allocation")}</CardTitle>
          </CardHeader>
          <CardContent>
            <AllocationChart
              aggregatedPositions={data.positions}
              privacyMode={!data.show_values}
            />
          </CardContent>
        </Card>

        {/* Holdings Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.holdings")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">
                      {t("table.symbol")}
                    </th>
                    <th className="text-left py-3 px-2 font-medium">
                      {t("table.name")}
                    </th>
                    <th className="text-right py-3 px-2 font-medium">
                      {data.show_values
                        ? t("table.value")
                        : t("table.allocation")}
                    </th>
                    <th className="text-right py-3 px-2 font-medium">
                      {t("table.gainLoss")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.positions.map((pos) => (
                    <tr key={pos.symbol} className="border-b last:border-0">
                      <td className="py-3 px-2 font-mono font-medium">
                        {pos.symbol}
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">
                        {pos.name}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {data.show_values
                          ? formatCurrency(pos.current_value_eur || 0)
                          : `${(
                              ((pos.current_value_eur || 0) / data.totalValue) *
                              100
                            ).toFixed(1)}%`}
                      </td>
                      <td
                        className={`py-3 px-2 text-right ${
                          (pos.gain_loss_percent || 0) >= 0
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      >
                        {formatPercent(pos.gain_loss_percent || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <Card className="mt-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="py-6 text-center">
            <TrendingUp className="h-8 w-8 text-primary mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-2">
              {t("share.wantToTrack")}
            </h3>
            <p className="text-muted-foreground mb-4">
              {t("share.createYourPortfolio")}
            </p>
            <Button onClick={() => navigate("/signup")}>
              {t("share.signUpFree")}
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground mt-6 flex items-center justify-center gap-2">
          <Clock className="h-4 w-4" />
          {t("share.expiresOn", {
            date: new Date(data.expires_at).toLocaleDateString(),
          })}
        </div>
      </main>
    </div>
  );
};

export default SharedView;
