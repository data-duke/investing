import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { TrendingUp, X } from "lucide-react";

interface StickyCTAProps {
  show: boolean;
  onSignUp: () => void;
}

export const StickyCTA = ({ show, onSignUp }: StickyCTAProps) => {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show && !dismissed) {
      // Delay appearance for better UX
      const timer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [show, dismissed]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden animate-slide-in-right">
      <div className="bg-background/95 backdrop-blur-sm border-t border-border p-4 shadow-lg">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <TrendingUp className="h-5 w-5 text-primary shrink-0" />
            <div className="truncate">
              <p className="text-sm font-medium truncate">{t("stickyCta.title")}</p>
              <p className="text-xs text-muted-foreground truncate">{t("stickyCta.subtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" onClick={onSignUp}>
              {t("stickyCta.signUp")}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
