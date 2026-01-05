import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePortfolio } from "@/hooks/usePortfolio";
import { fetchStockData } from "@/services/stockApi";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeDialog } from "./UpgradeDialog";
import { TagInput } from "./TagInput";
import { SUPPORTED_COUNTRIES, FREE_TIER_PORTFOLIO_LIMIT } from "@/lib/constants";

interface AddInvestmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void> | void;
}

export const AddInvestmentDialog = ({ open, onOpenChange, onSuccess }: AddInvestmentDialogProps) => {
  const { t } = useTranslation();
  const [country, setCountry] = useState("");
  const [symbol, setSymbol] = useState("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("");
  const [purchaseDate, setPurchaseDate] = useState<Date | undefined>(new Date());
  const [tags, setTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const { addInvestment, portfolios } = usePortfolio();
  const { subscribed, loading: subLoading } = useSubscription();
  const { toast } = useToast();

  // Get all existing tags for autocomplete
  const existingTags = Array.from(
    new Set(
      portfolios.flatMap((p) => {
        const allTags: string[] = [];
        if (p.tags && p.tags.length > 0) allTags.push(...p.tags);
        if (p.tag) allTags.push(p.tag);
        return allTags;
      })
    )
  ).filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user has reached free tier limit
    if (!subLoading && !subscribed && portfolios.length >= FREE_TIER_PORTFOLIO_LIMIT) {
      setShowUpgradeDialog(true);
      return;
    }
    
    // Validate inputs
    const parsedAmount = amount ? parseFloat(amount) : null;
    const parsedQuantity = quantity ? parseFloat(quantity) : null;
    
    if (!parsedAmount && !parsedQuantity) {
      toast({
        variant: "destructive",
        title: t('addInvestment.missingInfo'),
        description: t('addInvestment.provideAmountOrQty'),
      });
      return;
    }

    if ((parsedAmount && isNaN(parsedAmount)) || (parsedQuantity && isNaN(parsedQuantity))) {
      toast({
        variant: "destructive",
        title: t('addInvestment.invalidInput'),
        description: t('addInvestment.enterValidNumbers'),
      });
      return;
    }

    if ((parsedAmount && (parsedAmount <= 0 || parsedAmount > 10000000)) || 
        (parsedQuantity && (parsedQuantity <= 0 || parsedQuantity > 1000000))) {
      toast({
        variant: "destructive",
        title: t('addInvestment.invalidInput'),
        description: t('addInvestment.reasonableValues'),
      });
      return;
    }

    if (!symbol || symbol.length > 10 || !/^[A-Z0-9.:-]+$/i.test(symbol)) {
      toast({
        variant: "destructive",
        title: t('addInvestment.invalidSymbol'),
        description: t('addInvestment.enterValidSymbol'),
      });
      return;
    }

    if (!country || !purchaseDate) {
      toast({
        variant: "destructive",
        title: t('addInvestment.missingInfo'),
        description: t('addInvestment.fillAllFields'),
      });
      return;
    }

    setIsLoading(true);
    try {
      const stockData = await fetchStockData(symbol.toUpperCase());
      
      const finalQuantity = parsedQuantity || (parsedAmount! / stockData.currentPrice);
      const finalAmount = parsedAmount || (parsedQuantity! * stockData.currentPrice);

      const originalPriceEur = finalAmount / finalQuantity;
      
      // Generate auto tag if no custom tags provided
      const autoTag = purchaseDate.toISOString().split('T')[0];
      const finalTags = tags.length > 0 ? tags : [autoTag];
      
      const result = await addInvestment({
        symbol: symbol.toUpperCase(),
        name: stockData.name,
        country,
        quantity: finalQuantity,
        original_price_eur: originalPriceEur,
        original_investment_eur: finalAmount,
        purchase_date: purchaseDate.toISOString(),
        tags: finalTags,
      });

      // Check if addInvestment returned an error
      if (result?.error) {
        throw result.error;
      }

      toast({
        title: t('addInvestment.investmentAdded'),
        description: t('addInvestment.addedToPortfolio', { name: stockData.name }),
      });

      // Close dialog and trigger refresh
      onOpenChange(false);
      
      // Wait for DB to commit, then refresh
      await new Promise(resolve => setTimeout(resolve, 300));
      await onSuccess();
      
      // Reset form after successful refresh
      setCountry("");
      setSymbol("");
      setAmount("");
      setQuantity("");
      setPurchaseDate(new Date());
      setTags([]);
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('addInvestment.errorAdding'),
        description: error instanceof Error ? error.message : t('addInvestment.errorAdding'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('addInvestment.title')}</DialogTitle>
          <DialogDescription>{t('addInvestment.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="country">{t('form.countryOfResidence')}</Label>
            <Select value={country} onValueChange={setCountry} required>
              <SelectTrigger id="country">
                <SelectValue placeholder={t('form.selectCountry')} />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {t(`countries.${c.code}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="symbol">{t('form.stockSymbol')}</Label>
            <Input
              id="symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder={t('form.stockSymbolPlaceholder')}
              className="uppercase"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">{t('form.investmentAmount')}</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (e.target.value) setQuantity("");
              }}
              placeholder={t('form.investmentAmountPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">
              💡 {t('form.amountTip')}
            </p>
          </div>

          <div className="text-center text-sm text-muted-foreground">{t('common.or')}</div>

          <div className="space-y-2">
            <Label htmlFor="quantity">{t('form.quantity')}</Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                if (e.target.value) setAmount("");
              }}
              placeholder={t('form.quantityPlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('form.purchaseDate')}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !purchaseDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {purchaseDate ? format(purchaseDate, "PPP") : t('form.pickDate')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={purchaseDate}
                  onSelect={setPurchaseDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>{t('form.tags')}</Label>
            <TagInput
              tags={tags}
              onChange={setTags}
              existingTags={existingTags}
              placeholder={t('form.tagsPlaceholder')}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? t('addInvestment.adding') : t('addInvestment.add')}
          </Button>
        </form>
      </DialogContent>
      <UpgradeDialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog} />
    </Dialog>
  );
};
