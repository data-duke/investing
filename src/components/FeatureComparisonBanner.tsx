import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, X, Calculator, Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface FeatureComparisonBannerProps {
  onSignUp: () => void;
}

export const FeatureComparisonBanner = ({ onSignUp }: FeatureComparisonBannerProps) => {
  const { t } = useTranslation();

  const freeFeatures = [
    { text: t("comparison.singleStock"), included: true },
    { text: t("comparison.basicProjections"), included: true },
    { text: t("comparison.taxCalculations"), included: true },
    { text: t("comparison.portfolioTracking"), included: false },
    { text: t("comparison.autoRefresh"), included: false },
  ];

  const premiumFeatures = [
    { text: t("comparison.unlimitedStocks"), included: true },
    { text: t("comparison.autoRefreshPrices"), included: true },
    { text: t("comparison.historicalTracking"), included: true },
    { text: t("comparison.sharePortfolio"), included: true },
    { text: t("comparison.exportReports"), included: true },
  ];

  return (
    <div className="grid md:grid-cols-2 gap-4 animate-fade-in">
      {/* Free Calculator */}
      <Card className="p-6 border-border bg-card/50">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">{t("comparison.freeCalculator")}</h3>
        </div>
        <ul className="space-y-3 mb-6">
          {freeFeatures.map((feature, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              {feature.included ? (
                <Check className="h-4 w-4 text-green-500 shrink-0" />
              ) : (
                <X className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              )}
              <span className={feature.included ? "text-foreground" : "text-muted-foreground/50"}>
                {feature.text}
              </span>
            </li>
          ))}
        </ul>
        <div className="text-sm text-muted-foreground text-center">
          {t("comparison.usingNow")} ✓
        </div>
      </Card>

      {/* Premium Portfolio */}
      <Card className="p-6 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-bl-lg font-medium">
          {t("comparison.recommended")}
        </div>
        <div className="flex items-center gap-2 mb-4">
          <Rocket className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{t("comparison.fullPortfolio")}</h3>
        </div>
        <ul className="space-y-3 mb-6">
          {premiumFeatures.map((feature, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-primary shrink-0" />
              <span className="text-foreground">{feature.text}</span>
            </li>
          ))}
        </ul>
        <Button onClick={onSignUp} className="w-full">
          {t("comparison.getStartedFree")}
        </Button>
      </Card>
    </div>
  );
};
