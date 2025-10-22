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
  const [isLoading, setIsLoading] = useState(false);
  const { addInvestment } = usePortfolio();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      await addInvestment({
        symbol: symbol.toUpperCase(),
        name: stockData.name,
        country,
        quantity: finalQuantity,
        original_price_eur: stockData.currentPrice,
        original_investment_eur: finalAmount,
        purchase_date: purchaseDate.toISOString(),
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
      <DialogContent className="max-w-md">
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

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Adding..." : "Add Investment"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
