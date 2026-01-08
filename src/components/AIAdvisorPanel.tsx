import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { AggregatedPosition } from "@/lib/constants";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIAdvisorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  portfolioSummary: string;
  userCountry: string;
  aggregatedPositions: AggregatedPosition[];
}

const quickPrompts = [
  { key: "analyze", label: "Analyze my diversification" },
  { key: "dividends", label: "Best dividend stocks?" },
  { key: "tax", label: "Tax optimization tips" },
  { key: "suggest", label: "What should I improve?" },
];

export const AIAdvisorPanel = ({
  isOpen,
  onClose,
  portfolioSummary,
  userCountry,
}: AIAdvisorPanelProps) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portfolio-ai-advisor`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            portfolioSummary,
            userCountry,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      // Add empty assistant message that we'll update
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages((prev) => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: "assistant",
                  content: assistantContent,
                };
                return newMessages;
              });
            }
          } catch {
            // Incomplete JSON, will be handled with next chunk
          }
        }
      }
    } catch (err) {
      console.error("AI advisor error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      // Remove the empty assistant message on error
      setMessages((prev) => prev.filter((m) => m.content !== ""));
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (key: string) => {
    const prompts: Record<string, string> = {
      analyze: "Analyze my portfolio diversification. Am I too concentrated in any sector or region?",
      dividends: "Which of my stocks has the best dividend characteristics? Consider yield, growth, and sustainability.",
      tax: `Given that I'm a tax resident of ${userCountry}, are there any tax optimization opportunities in my portfolio?`,
      suggest: "What improvements would you suggest for my portfolio? Consider diversification, risk, and income potential.",
    };
    sendMessage(prompts[key]);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('ai.portfolioAdvisor')}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm text-center">
                {t('ai.howCanIHelp')}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {quickPrompts.map((prompt) => (
                  <Button
                    key={prompt.key}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickPrompt(prompt.key)}
                    className="text-xs h-auto py-2 whitespace-normal"
                  >
                    {t(`ai.prompts.${prompt.key}`, prompt.label)}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, i) => (
                <div
                  key={i}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-3 text-sm ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content || "..."}</p>
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.content === "" && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">{t('ai.thinking')}</span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-destructive mt-4 p-3 bg-destructive/10 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('ai.typeQuestion')}
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
};
