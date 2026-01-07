import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useToast } from "@/hooks/use-toast";
import { usePrivacy } from "@/contexts/PrivacyContext";
import { useState } from "react";
import { Save, TrendingUp, TrendingDown, ArrowRight, Info, DollarSign, Calendar, Percent } from "lucide-react";
import { AnimatedValue } from "@/components/AnimatedValue";

export interface AnalysisData {
  currentPrice: number;
  originallyInvested: number;
  currentValue: number;
  currentGain: number;
  currentGainPercent: number;
  grossDividendAnnual: number;
  netDividendAnnual: number;
  dividendTaxRate: number;
  projectedValue1Year: number;
  projectedValue3Years: number;
  projectedValue5Years: number;
  estimatedCAGR: number;
  quantity: number;
  exchangeRate?: number;
  currentPriceUSD?: number;
  source?: string;
  symbol?: string;
  name?: string;
  country?: string;
}

interface AnalysisTableProps {
  data: AnalysisData | null;
  positionName: string;
  isLoggedIn: boolean;
  onNavigateToSignup: () => void;
  onNavigateToDashboard: () => void;
}

export const AnalysisTable = ({ data, positionName, isLoggedIn, onNavigateToSignup, onNavigateToDashboard }: AnalysisTableProps) => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const { addInvestment } = usePortfolio();
  const { toast } = useToast();
  const { privacyMode } = usePrivacy();

  const handleSaveToPortfolio = async () => {
    if (!data || !data.symbol || !data.country) return;
    
    setIsSaving(true);
    try {
      const originalPriceEur = data.originallyInvested / data.quantity;
      
      const result = await addInvestment({
        symbol: data.symbol,
        name: data.name || positionName,
        country: data.country,
        quantity: data.quantity,
        original_price_eur: originalPriceEur,
        original_investment_eur: data.originallyInvested,
        purchase_date: new Date().toISOString(),
      });

      if (!result.error) {
        toast({
          title: t('toast.investmentSaved'),
          description: t('toast.investmentAddedToPortfolio'),
        });
        onNavigateToDashboard();
      }
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : "Failed to save",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignUpClick = () => {
    if (!data || !data.symbol || !data.country) return;
    
    const pendingInvestment = {
      symbol: data.symbol,
      name: data.name || positionName,
      country: data.country,
      quantity: data.quantity,
      originallyInvested: data.originallyInvested,
      originalPrice: data.originallyInvested / data.quantity,
      purchase_date: new Date().toISOString(),
    };
    
    sessionStorage.setItem('pendingInvestment', JSON.stringify(pendingInvestment));
    onNavigateToSignup();
  };

  const formatCurrency = (value: number) => {
    if (privacyMode) return "•••";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatCurrencyAnimated = (value: number) => {
    return `€${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (!data) {
    return (
      <Card className="p-8 bg-card/50 border-border border-dashed h-full flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">{t('calculator.noResults')}</h3>
        <p className="text-muted-foreground max-w-sm">
          {t('calculator.enterDetails')}
        </p>
      </Card>
    );
  }

  const isPositive = data.currentGain >= 0;

  return (
    <div className="space-y-4">
      {/* Main Summary Card */}
      <Card className="p-6 bg-card border-border overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full pointer-events-none" />
        
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground">{data.symbol}</p>
            <h2 className="text-2xl font-bold text-foreground">{positionName}</h2>
          </div>
          {data.source && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              {data.source}
            </span>
          )}
        </div>

        {/* Current Value Highlight */}
        <div className="bg-muted/50 rounded-xl p-5 mb-4">
          <p className="text-sm text-muted-foreground mb-1">{t('analysis.currentValue')}</p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-4xl font-bold text-foreground">
              {privacyMode ? "•••" : (
                <AnimatedValue 
                  value={data.currentValue} 
                  formatter={formatCurrencyAnimated}
                />
              )}
            </span>
            <span className={`flex items-center gap-1 text-lg font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              {privacyMode ? (
                `${data.currentGainPercent >= 0 ? '+' : ''}${data.currentGainPercent.toFixed(2)}%`
              ) : (
                `${data.currentGain >= 0 ? '+' : ''}${formatCurrency(data.currentGain)} (${data.currentGainPercent >= 0 ? '+' : ''}${data.currentGainPercent.toFixed(2)}%)`
              )}
            </span>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
              <DollarSign className="h-3 w-3" />
              {t('analysis.currentPrice')}
            </div>
            <p className="font-semibold">{formatCurrency(data.currentPrice)}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
              <Percent className="h-3 w-3" />
              {t('analysis.sharesOwned')}
            </div>
            <p className="font-semibold">{data.quantity.toFixed(2)}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
              <Calendar className="h-3 w-3" />
              {t('analysis.originallyInvested')}
            </div>
            <p className="font-semibold">{formatCurrency(data.originallyInvested)}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
              <Info className="h-3 w-3" />
              {t('analysis.taxRate')}
            </div>
            <p className="font-semibold">{data.dividendTaxRate.toFixed(1)}%</p>
          </div>
        </div>
      </Card>

      {/* Dividends Card */}
      {data.grossDividendAnnual > 0 && (
        <Card className="p-5 bg-card border-border">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            {t('analysis.dividendDetails')}
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{t('analysis.grossAnnualDividend')}</span>
              <span className="font-medium">{formatCurrency(data.grossDividendAnnual)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{t('analysis.netAnnualDividend')}</span>
              <span className="font-semibold text-green-500">{formatCurrency(data.netDividendAnnual)}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Projections Card */}
      <Card className="p-5 bg-card border-border">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          {t('analysis.futureValueProjections')}
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          {data.estimatedCAGR === 8 ? (
            t('analysis.basedOnMarketAverage')
          ) : (
            t('analysis.basedOnHistoricalCAGR', { cagr: data.estimatedCAGR.toFixed(1) })
          )}
        </p>
        
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 text-center p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">{t('analysis.in1Year')}</p>
            <p className="font-semibold text-sm">{formatCurrency(data.projectedValue1Year)}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 text-center p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">{t('analysis.in3Years')}</p>
            <p className="font-semibold text-sm">{formatCurrency(data.projectedValue3Years)}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-xs text-muted-foreground mb-1">{t('analysis.in5Years')}</p>
            <p className="font-semibold text-sm text-primary">{formatCurrency(data.projectedValue5Years)}</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-3 italic">
          {t('analysis.disclaimer')}
        </p>
      </Card>

      {/* CTA Card */}
      {isLoggedIn ? (
        <Card className="p-5 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                {t('analysis.saveToPortfolio')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('calculator.trackOverTime')}
              </p>
            </div>
            <Button onClick={handleSaveToPortfolio} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-5 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h3 className="text-lg font-semibold">{t('analysis.signUpToSave')}</h3>
            </div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {t('calculator.createFreeAccount')}
            </p>
            <Button onClick={handleSignUpClick} size="lg">
              {t('nav.signup')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
