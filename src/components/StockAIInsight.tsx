import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageCircle, Loader2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface StockAIInsightProps {
  symbol: string;
  stockName: string;
  stockData?: {
    currentPrice: number;
    dividend?: number;
    cagr5y?: number;
  };
  isLoggedIn: boolean;
  onNavigateToSignup: () => void;
}

const quickQuestions = [
  { key: "risks", label: "What are the risks?" },
  { key: "dividend", label: "Is this a good dividend stock?" },
  { key: "outlook", label: "What's the outlook?" },
  { key: "competitors", label: "Compare to competitors" },
];

export const StockAIInsight = ({ 
  symbol, 
  stockName, 
  stockData, 
  isLoggedIn,
  onNavigateToSignup 
}: StockAIInsightProps) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);

  const handleAskQuestion = async (questionKey: string) => {
    setIsLoading(true);
    setError(null);
    setResponse(null);
    setSelectedQuestion(questionKey);

    const questionMap: Record<string, string> = {
      risks: `What are the main risks of investing in ${stockName} (${symbol})?`,
      dividend: `Is ${stockName} (${symbol}) a good dividend stock? Analyze its dividend history and sustainability.`,
      outlook: `What is the outlook for ${stockName} (${symbol}) in the next 1-2 years?`,
      competitors: `How does ${stockName} (${symbol}) compare to its main competitors?`,
    };

    try {
      const { data, error: fnError } = await supabase.functions.invoke('stock-ai-insight', {
        body: { 
          symbol, 
          stockName, 
          question: questionMap[questionKey],
          stockData,
        },
      });

      if (fnError) throw fnError;
      
      if (data.error) {
        setError(data.error);
      } else {
        setResponse(data.content);
      }
    } catch (err) {
      console.error('AI insight error:', err);
      setError(t('ai.errorGettingInsight'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-5 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">{t('ai.askAboutStock', { symbol })}</h3>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Quick Questions */}
          <div className="flex flex-wrap gap-2">
            {quickQuestions.map((q) => (
              <Button
                key={q.key}
                variant={selectedQuestion === q.key ? "default" : "outline"}
                size="sm"
                onClick={() => handleAskQuestion(q.key)}
                disabled={isLoading}
                className="text-xs"
              >
                <MessageCircle className="h-3 w-3 mr-1" />
                {t(`ai.questions.${q.key}`, q.label)}
              </Button>
            ))}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{t('ai.analyzing')}</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-center gap-2 text-destructive py-2">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Response */}
          {response && (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm whitespace-pre-wrap">{response}</p>
            </div>
          )}

          {/* Premium CTA for non-logged-in users */}
          {!isLoggedIn && (
            <div className="bg-primary/10 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                {t('ai.unlockUnlimited')}
              </p>
              <Button size="sm" onClick={onNavigateToSignup}>
                {t('ai.getPremium')}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
