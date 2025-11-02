import { useState } from "react";
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

interface AddInvestmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const countries = [
  { code: "AT", name: "Austria" },
  { code: "DE", name: "Germany" },
  { code: "US", name: "United States" },
  { code: "UK", name: "United Kingdom" },
  { code: "CH", name: "Switzerland" },
];

export const AddInvestmentDialog = ({ open, onOpenChange, onSuccess }: AddInvestmentDialogProps) => {
  const [country, setCountry] = useState("");
  const [symbol, setSymbol] = useState("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("");
  const [purchaseDate, setPurchaseDate] = useState<Date | undefined>(new Date());
  const [tag, setTag] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const { addInvestment, portfolios } = usePortfolio();
  const { subscribed, loading: subLoading } = useSubscription();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user has reached free tier limit
    if (!subLoading && !subscribed && portfolios.length >= 3) {
      setShowUpgradeDialog(true);
      return;
    }
    
    if (!country || !symbol || (!amount && !quantity) || !purchaseDate) return;

    setIsLoading(true);
    try {
      const stockData = await fetchStockData(symbol.toUpperCase());
      
      let finalQuantity: number;
      let finalAmount: number;

      if (quantity) {
        finalQuantity = parseFloat(quantity);
        finalAmount = finalQuantity * stockData.currentPrice;
      } else {
        finalAmount = parseFloat(amount);
        finalQuantity = finalAmount / stockData.currentPrice;
      }

      const originalPriceEur = finalAmount / finalQuantity;
      
      // Generate auto tag if no custom tag provided
      const autoTag = purchaseDate.toISOString().split('T')[0];
      
      await addInvestment({
        symbol: symbol.toUpperCase(),
        name: stockData.name,
        country,
        quantity: finalQuantity,
        original_price_eur: originalPriceEur,
        original_investment_eur: finalAmount,
        purchase_date: purchaseDate.toISOString(),
        tag: tag.trim() || undefined,
        auto_tag_date: tag.trim() ? undefined : autoTag,
      });

      toast({
        title: "Investment added",
        description: `${stockData.name} has been added to your portfolio.`,
      });

      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setCountry("");
      setSymbol("");
      setAmount("");
      setQuantity("");
      setPurchaseDate(new Date());
      setTag("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error adding investment",
        description: error instanceof Error ? error.message : "Failed to add investment",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Investment</DialogTitle>
          <DialogDescription>Add a new stock to your portfolio</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="country">Country of Residence</Label>
            <Select value={country} onValueChange={setCountry} required>
              <SelectTrigger id="country">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="symbol">Stock Symbol</Label>
            <Input
              id="symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="e.g., AAPL"
              className="uppercase"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Investment Amount (EUR)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (e.target.value) setQuantity("");
              }}
              placeholder="e.g., 1000"
            />
            <p className="text-xs text-muted-foreground">
              💡 Tip: Enter both amount and quantity to preserve your exact average purchase price
            </p>
          </div>

          <div className="text-center text-sm text-muted-foreground">OR</div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity (Shares)</Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                if (e.target.value) setAmount("");
              }}
              placeholder="e.g., 10"
            />
          </div>

          <div className="space-y-2">
            <Label>Purchase Date</Label>
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
                  {purchaseDate ? format(purchaseDate, "PPP") : "Pick a date"}
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
            <Label htmlFor="tag">Tag (optional)</Label>
            <Input
              id="tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="e.g., 'tech-stocks', 'retirement', or leave empty for date tag"
            />
            <p className="text-xs text-muted-foreground">
              Group your investments with custom tags for easy filtering
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Adding..." : "Add Investment"}
          </Button>
        </form>
      </DialogContent>
      <UpgradeDialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog} />
    </Dialog>
  );
};
