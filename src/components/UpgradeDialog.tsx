import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UpgradeDialog = ({ open, onOpenChange }: UpgradeDialogProps) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout');
      
      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: t('upgrade.errorCheckout'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Crown className="h-6 w-6 text-primary" />
            <DialogTitle>{t('upgrade.title')}</DialogTitle>
          </div>
          <DialogDescription className="space-y-4 pt-2">
            <p>
              {t('upgrade.limitReached')}
            </p>
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 space-y-2">
              <p className="font-semibold text-foreground">{t('upgrade.premiumAccess')}</p>
              <p className="text-2xl font-bold text-primary">{t('upgrade.price')}</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>✓ {t('upgrade.benefitUnlimited')}</li>
                <li>✓ {t('upgrade.benefitAnalytics')}</li>
                <li>✓ {t('upgrade.benefitRefresh')}</li>
                <li>✓ {t('upgrade.benefitCancel')}</li>
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button
            onClick={handleUpgrade}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('upgrade.processing')}
              </>
            ) : (
              <>
                <Crown className="mr-2 h-4 w-4" />
                {t('upgrade.upgradeNow')}
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            {t('upgrade.maybeLater')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
