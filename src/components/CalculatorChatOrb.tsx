import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Send, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatAnalysisCard } from "@/components/ChatAnalysisCard";
import { useCalculatorChat, ChatMessage } from "@/hooks/useCalculatorChat";
import { cn } from "@/lib/utils";

const QUICK_PROMPTS = [
  { label: "AAPL", prompt: "Analyze $5000 in Apple stock" },
  { label: "MSFT", prompt: "What if I invest €3000 in Microsoft?" },
  { label: "AVGO", prompt: "Analyze Broadcom for dividend income" },
  { label: "CNQ.TO", prompt: "How much dividend would I get from CNQ?" },
];

export const CalculatorChatOrb = () => {
  const { t } = useTranslation();
  const { messages, isStreaming, sendMessage, resetChat } = useCalculatorChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isStreaming) {
      sendMessage(input.trim());
      setInput("");
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    if (!isStreaming) {
      sendMessage(prompt);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Glowing Orb Container */}
      <div className="relative">
        {/* Outer glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 rounded-3xl blur-xl opacity-75 animate-pulse" />
        
        {/* Main orb */}
        <div className="chat-orb relative bg-card/90 backdrop-blur-xl border-2 border-primary/30 rounded-3xl overflow-hidden">
          {/* Inner glow overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none" />
          
          {/* Chat header */}
          <div className="relative flex items-center justify-between p-4 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <span className="font-semibold text-foreground">{t('chatCalculator.title')}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetChat}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages area */}
          <ScrollArea className="h-[400px] px-4" ref={scrollRef}>
            <div className="py-4 space-y-4">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              
              {/* Typing indicator */}
              {isStreaming && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input area */}
          <div className="relative p-4 border-t border-border/50">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('chatCalculator.placeholder')}
                className="flex-1 bg-input/50 border-border/50 rounded-xl h-11"
                disabled={isStreaming}
              />
              <Button 
                type="submit" 
                size="icon"
                className="h-11 w-11 rounded-xl"
                disabled={!input.trim() || isStreaming}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Quick prompts */}
      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground mb-3">{t('chatCalculator.quickPrompts')}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {QUICK_PROMPTS.map((item) => (
            <button
              key={item.label}
              onClick={() => handleQuickPrompt(item.prompt)}
              disabled={isStreaming}
              className="px-4 py-2 text-sm font-medium bg-muted/50 hover:bg-muted border border-border/50 rounded-full transition-all hover:border-primary/50 hover:text-primary disabled:opacity-50"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const MessageBubble = ({ message }: { message: ChatMessage }) => {
  const isUser = message.role === 'user';

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[85%] rounded-2xl px-4 py-3",
        isUser 
          ? "bg-primary text-primary-foreground rounded-br-md" 
          : "bg-muted/50 text-foreground rounded-bl-md"
      )}>
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        
        {/* Analysis card */}
        {message.analysisResult && (
          <ChatAnalysisCard data={message.analysisResult} />
        )}
      </div>
    </div>
  );
};
