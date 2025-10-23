import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Portfolio, usePortfolio } from "@/hooks/usePortfolio";
import { useToast } from "@/hooks/use-toast";

interface EditInvestmentDialogProps {
  portfolio: Portfolio | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const EditInvestmentDialog = ({ portfolio, open, onOpenChange, onSuccess }: EditInvestmentDialogProps) => {
  const [quantity, setQuantity] = useState(portfolio?.quantity.toString() || "");
  const [originalPrice, setOriginalPrice] = useState(portfolio?.original_price_eur.toString() || "");
  const [purchaseDate, setPurchaseDate] = useState(
    portfolio?.purchase_date ? new Date(portfolio.purchase_date).toISOString().split('T')[0] : ""
  );
  const [isLoading, setIsLoading] = useState(false);
  const { updateInvestment } = usePortfolio();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portfolio) return;

    setIsLoading(true);
    const parsedQuantity = parseFloat(quantity);
    const parsedPrice = parseFloat(originalPrice);
    
    const result = await updateInvestment(portfolio.id, {
      quantity: parsedQuantity,
      original_price_eur: parsedPrice,
      original_investment_eur: parsedQuantity * parsedPrice,
      purchase_date: new Date(purchaseDate).toISOString(),
    });

    setIsLoading(false);
    
    if (!result.error) {
      toast({
        title: "Investment updated",
        description: "Your investment has been updated successfully.",
      });
      onOpenChange(false);
      onSuccess();
    }
  };

  if (!portfolio) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Investment - {portfolio.symbol}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity (Shares)</Label>
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
            <Label htmlFor="price">Purchase Price (EUR)</Label>
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
            <Label htmlFor="date">Purchase Date</Label>
            <Input
              id="date"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Updating..." : "Update Investment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
