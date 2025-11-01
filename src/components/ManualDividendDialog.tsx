import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { usePortfolio } from "@/hooks/usePortfolio";

interface ManualDividendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioId: string;
  symbol: string;
  currentDividend?: number;
}

export const ManualDividendDialog = ({
  open,
  onOpenChange,
  portfolioId,
  symbol,
  currentDividend,
}: ManualDividendDialogProps) => {
  const [dividend, setDividend] = useState(currentDividend?.toString() || "");
  const [isLoading, setIsLoading] = useState(false);
  const { updateInvestment } = usePortfolio();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const dividendValue = parseFloat(dividend);
    if (isNaN(dividendValue) || dividendValue < 0) {
      toast({
        variant: "destructive",
        title: "Invalid dividend",
        description: "Please enter a valid positive number",
      });
      return;
    }

    setIsLoading(true);
    const { error } = await updateInvestment(portfolioId, {
      manual_dividend_eur: dividendValue,
    });

    setIsLoading(false);

    if (!error) {
      toast({
        title: "Dividend updated",
        description: `Manual dividend for ${symbol} set to €${dividendValue.toFixed(2)}`,
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Manual Dividend</DialogTitle>
          <DialogDescription>
            Enter the annual dividend per share in EUR for {symbol}. This will override API data.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dividend">Annual Dividend (€)</Label>
              <Input
                id="dividend"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g., 2.50"
                value={dividend}
                onChange={(e) => setDividend(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Dividend"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
