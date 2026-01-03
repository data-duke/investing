import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { countries } from "@/lib/taxCalculations";

interface TaxSettingsDialogProps {
  userId: string;
  currentCountry: string;
  onCountryChange: (country: string) => void;
}

export const TaxSettingsDialog = ({ userId, currentCountry, onCountryChange }: TaxSettingsDialogProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(currentCountry);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSelectedCountry(currentCountry);
  }, [currentCountry]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ residence_country: selectedCountry })
        .eq('id', userId);

      if (error) throw error;

      onCountryChange(selectedCountry);
      toast({
        title: t('settings.saved'),
        description: t('settings.taxResidenceUpdated'),
      });
      setOpen(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({
        title: t('common.error'),
        description: t('settings.saveFailed'),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          <span className="hidden md:inline">{t('settings.taxSettings')}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('settings.taxSettings')}</DialogTitle>
          <DialogDescription>
            {t('settings.taxSettingsDescription')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="country">{t('settings.taxResidenceCountry')}</Label>
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger id="country">
                <SelectValue placeholder={t('settings.selectCountry')} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(countries).map(([code, data]) => (
                  <SelectItem key={code} value={code}>
                    {data.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('settings.taxResidenceHint')}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
