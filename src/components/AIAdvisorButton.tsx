import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { AIAdvisorPanel } from "@/components/AIAdvisorPanel";
import { AggregatedPosition } from "@/lib/constants";

interface AIAdvisorButtonProps {
  portfolioSummary: string;
  userCountry: string;
  aggregatedPositions: AggregatedPosition[];
}

export const AIAdvisorButton = ({ 
  portfolioSummary, 
  userCountry,
  aggregatedPositions 
}: AIAdvisorButtonProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
        title={t('ai.portfolioAdvisor')}
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      <AIAdvisorPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        portfolioSummary={portfolioSummary}
        userCountry={userCountry}
        aggregatedPositions={aggregatedPositions}
      />
    </>
  );
};
