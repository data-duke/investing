import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Portfolio, usePortfolio } from "@/hooks/usePortfolio";
import { useToast } from "@/hooks/use-toast";
import { TagInput } from "./TagInput";

interface EditInvestmentDialogProps {
  portfolio: Portfolio | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const EditInvestmentDialog = ({ portfolio, open, onOpenChange, onSuccess }: EditInvestmentDialogProps) => {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { updateInvestment, portfolios } = usePortfolio();
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

  // Update state when portfolio changes
  useEffect(() => {
    if (portfolio && open) {
      setQuantity(portfolio.quantity.toString());
      setOriginalPrice(portfolio.original_price_eur.toString());
      setPurchaseDate(new Date(portfolio.purchase_date).toISOString().split('T')[0]);
      
      // Initialize tags from portfolio
      const portfolioTags: string[] = [];
      if (portfolio.tags && portfolio.tags.length > 0) {
        portfolioTags.push(...portfolio.tags);
      } else if (portfolio.tag) {
        portfolioTags.push(portfolio.tag);
      } else if (portfolio.auto_tag_date) {
        portfolioTags.push(portfolio.auto_tag_date);
      }
      setTags(portfolioTags);
    }
  }, [portfolio, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portfolio) return;
    
    // Validate inputs
    const parsedQuantity = parseFloat(quantity);
    const parsedPrice = parseFloat(originalPrice);
    
    if (isNaN(parsedQuantity) || isNaN(parsedPrice)) {
      toast({
        variant: "destructive",
        title: t('editInvestment.invalidInput'),
        description: t('editInvestment.enterValidNumbers'),
      });
      return;
    }

    if (parsedQuantity <= 0 || parsedQuantity > 1000000) {
      toast({
        variant: "destructive",
        title: t('editInvestment.invalidQuantity'),
        description: t('editInvestment.quantityRange'),
      });
      return;
    }

    if (parsedPrice <= 0 || parsedPrice > 1000000) {
      toast({
        variant: "destructive",
        title: t('editInvestment.invalidPrice'),
        description: t('editInvestment.priceRange'),
      });
      return;
    }

    setIsLoading(true);
    
    // Generate auto tag if no tags provided
    const autoTag = new Date(purchaseDate).toISOString().split('T')[0];
    const finalTags = tags.length > 0 ? tags : [autoTag];
    
    const result = await updateInvestment(portfolio.id, {
      quantity: parsedQuantity,
      original_price_eur: parsedPrice,
      original_investment_eur: parsedQuantity * parsedPrice,
      purchase_date: new Date(purchaseDate).toISOString(),
      tags: finalTags,
    });

    setIsLoading(false);
    
    if (!result.error) {
      toast({
        title: t('editInvestment.updated'),
        description: t('editInvestment.updatedDescription'),
      });
      onOpenChange(false);
      onSuccess();
    }
  };

  if (!portfolio) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('editInvestment.title', { symbol: portfolio.symbol })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quantity">{t('form.quantity')}</Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">{t('form.purchasePrice')}</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              value={originalPrice}
              onChange={(e) => setOriginalPrice(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">{t('form.purchaseDate')}</Label>
            <Input
              id="date"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              required
            />
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

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t('editInvestment.updating') : t('editInvestment.update')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
