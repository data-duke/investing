import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchStockData, StockData } from '@/services/stockApi';
import { calculateDividendTax } from '@/lib/taxCalculations';

export interface AnalysisResult {
  symbol: string;
  name: string;
  currentPrice: number;
  quantity: number;
  investedAmount: number;
  currentValue: number;
  grossDividendAnnual: number;
  netDividendAnnual: number;
  dividendTaxRate: number;
  projectedValue5Years: number;
  estimatedCAGR: number;
  country: string;
  stockCountry: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  analysisResult?: AnalysisResult;
  isStreaming?: boolean;
}

interface AnalysisRequest {
  symbol: string;
  amount?: number;
  country?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calculator-chat`;

export const useCalculatorChat = () => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<AnalysisRequest | null>(null);

  // Initial greeting
  useEffect(() => {
    setMessages([{
      id: 'greeting',
      role: 'assistant',
      content: t('chatCalculator.greeting'),
    }]);
  }, [t]);

  const parseAnalysisRequest = (content: string): AnalysisRequest | null => {
    const match = content.match(/```analysis\s*\n?({[\s\S]*?})\s*\n?```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        return null;
      }
    }
    return null;
  };

  const removeAnalysisBlock = (content: string): string => {
    return content.replace(/```analysis\s*\n?{[\s\S]*?}\s*\n?```/g, '').trim();
  };

  const performAnalysis = async (request: AnalysisRequest): Promise<AnalysisResult | null> => {
    try {
      const stockData = await fetchStockData(request.symbol);
      
      // Detect stock country from symbol
      let stockCountry = 'US';
      if (request.symbol.includes('.TO') || request.symbol.includes('.V')) {
        stockCountry = 'CA';
      } else if (request.symbol.includes('.L')) {
        stockCountry = 'UK';
      } else if (request.symbol.includes('.DE') || request.symbol.includes('.F')) {
        stockCountry = 'DE';
      }

      const investorCountry = request.country || 'US';
      const amount = request.amount || 1000;
      const quantity = amount / stockData.currentPrice;
      const currentValue = stockData.currentPrice * quantity;

      const taxBreakdown = calculateDividendTax(
        stockData.dividend,
        quantity,
        stockCountry,
        investorCountry
      );

      const estimatedCAGR = stockData.cagr5y !== undefined ? stockData.cagr5y : 0.08;
      const projectedValue5Years = currentValue * Math.pow(1 + estimatedCAGR, 5);

      return {
        symbol: request.symbol.toUpperCase(),
        name: stockData.name,
        currentPrice: stockData.currentPrice,
        quantity,
        investedAmount: amount,
        currentValue,
        grossDividendAnnual: taxBreakdown.grossDividend,
        netDividendAnnual: taxBreakdown.netDividend,
        dividendTaxRate: taxBreakdown.totalTaxRate * 100,
        projectedValue5Years,
        estimatedCAGR: estimatedCAGR * 100,
        country: investorCountry,
        stockCountry,
      };
    } catch (error) {
      console.error('Analysis error:', error);
      return null;
    }
  };

  const sendMessage = useCallback(async (input: string) => {
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsStreaming(true);

    let assistantContent = '';
    const assistantId = `assistant-${Date.now()}`;

    const upsertAssistant = (nextChunk: string, analysisResult?: AnalysisResult) => {
      assistantContent += nextChunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.id === assistantId) {
          return prev.map(m => 
            m.id === assistantId 
              ? { ...m, content: removeAnalysisBlock(assistantContent), analysisResult: analysisResult || m.analysisResult }
              : m
          );
        }
        return [...prev, {
          id: assistantId,
          role: 'assistant',
          content: removeAnalysisBlock(assistantContent),
          isStreaming: true,
          analysisResult,
        }];
      });
    };

    try {
      const conversationHistory = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: conversationHistory }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to connect');
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Check for analysis request in the final content
      const analysisRequest = parseAnalysisRequest(assistantContent);
      if (analysisRequest) {
        const result = await performAnalysis(analysisRequest);
        if (result) {
          setMessages(prev => 
            prev.map(m => 
              m.id === assistantId 
                ? { ...m, analysisResult: result, isStreaming: false }
                : m
            )
          );
        }
      }

      // Mark streaming as complete
      setMessages(prev => 
        prev.map(m => 
          m.id === assistantId 
            ? { ...m, isStreaming: false }
            : m
        )
      );

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Sorry, something went wrong. Please try again.',
      }]);
    } finally {
      setIsStreaming(false);
    }
  }, [messages]);

  const resetChat = useCallback(() => {
    setMessages([{
      id: 'greeting',
      role: 'assistant',
      content: t('chatCalculator.greeting'),
    }]);
  }, [t]);

  return {
    messages,
    isStreaming,
    sendMessage,
    resetChat,
  };
};
