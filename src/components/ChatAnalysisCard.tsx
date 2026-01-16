import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Banknote, Target, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { AnalysisResult } from "@/hooks/useCalculatorChat";

interface ChatAnalysisCardProps {
  data: AnalysisResult;
}

export const ChatAnalysisCard = ({ data }: ChatAnalysisCardProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const handleSaveToPortfolio = async () => {
    if (!user) {
      navigate('/signup');
      return;
    }

    try {
      const { error } = await supabase.from('portfolios').insert({
        user_id: user.id,
        symbol: data.symbol,
        name: data.name,
        quantity: data.quantity,
        original_price_eur: data.currentPrice,
        original_investment_eur: data.investedAmount,
        country: data.country,
        purchase_date: new Date().toISOString().split('T')[0],
      });

      if (error) throw error;

      toast({
        title: t('toast.investmentSaved'),
        description: t('toast.investmentSavedDesc'),
      });
      
      navigate('/dashboard');
    } catch (error) {
      toast({
        title: t('common.error'),
        description: 'Failed to save investment',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="bg-card/80 backdrop-blur-sm border border-border rounded-xl p-4 my-3 animate-scale-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-bold text-foreground">{data.symbol}</h4>
          <p className="text-sm text-muted-foreground">{data.name}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">{t('analysis.currentPrice')}</p>
          <p className="font-mono font-semibold text-foreground">{formatCurrency(data.currentPrice)}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-muted/50 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
            <Target className="h-3 w-3" />
            <span className="text-xs">{t('analysis.shares')}</span>
          </div>
          <p className="font-mono font-semibold text-sm">{data.quantity.toFixed(2)}</p>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
            <Banknote className="h-3 w-3" />
            <span className="text-xs">{t('analysis.netDividend')}</span>
          </div>
          <p className="font-mono font-semibold text-sm text-success">{formatCurrency(data.netDividendAnnual)}</p>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
            <TrendingUp className="h-3 w-3" />
            <span className="text-xs">5Y</span>
          </div>
          <p className="font-mono font-semibold text-sm text-primary">{formatCurrency(data.projectedValue5Years)}</p>
        </div>
      </div>

      {/* Tax info */}
      <p className="text-xs text-muted-foreground text-center mb-3">
        {t('analysis.taxRate')}: {data.dividendTaxRate.toFixed(1)}% • CAGR: {data.estimatedCAGR.toFixed(1)}%
      </p>

      {/* Actions */}
      <div className="flex gap-2">
        <Button 
          size="sm" 
          className="flex-1"
          onClick={handleSaveToPortfolio}
        >
          {user ? t('analysis.saveToPortfolio') : t('nav.signup')}
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  );
};
