import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_COUNTRIES } from "@/lib/constants";
import { Search, Loader2 } from "lucide-react";

interface InvestmentFormProps {
  onSearch: (country: string, symbol: string, amount: number, quantity: number) => void;
  isLoading: boolean;
  prefilledSymbol?: string;
}

export const InvestmentForm = ({ onSearch, isLoading, prefilledSymbol }: InvestmentFormProps) => {
  const { t } = useTranslation();
  const [country, setCountry] = useState("");
  const [symbol, setSymbol] = useState("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("");

  // Handle prefilled symbol from popular stocks picker
  useEffect(() => {
    if (prefilledSymbol) {
      setSymbol(prefilledSymbol);
    }
  }, [prefilledSymbol]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (country && symbol && (amount || quantity)) {
      onSearch(country, symbol.toUpperCase(), amount ? parseFloat(amount) : 0, quantity ? parseFloat(quantity) : 0);
    }
  };

  return (
    <Card className="p-6 bg-card border-border shadow-lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="country" className="text-foreground font-medium">
              {t('form.countryOfResidence')}
            </Label>
            <Select value={country} onValueChange={setCountry} required>
              <SelectTrigger id="country" className="bg-input border-border h-11">
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
            <Label htmlFor="symbol" className="text-foreground font-medium">
              {t('form.stockSymbol')}
            </Label>
            <div className="relative">
              <Input
                id="symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder={t('form.stockSymbolPlaceholder')}
                className="bg-input border-border font-mono uppercase h-11 pr-10"
                required
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount" className="text-foreground font-medium">
              {t('form.investmentAmount')}
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (e.target.value) setQuantity("");
              }}
              placeholder={t('form.investmentAmountPlaceholder')}
              className="bg-input border-border font-mono h-11"
            />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">{t('common.or')}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity" className="text-foreground font-medium">
              {t('form.quantity')}
            </Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              min="0"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                if (e.target.value) setAmount("");
              }}
              placeholder={t('form.quantityPlaceholder')}
              className="bg-input border-border font-mono h-11"
            />
          </div>
        </div>

        <Button 
          type="submit" 
          className="w-full h-12 text-base font-semibold"
          disabled={isLoading || !country || !symbol || (!amount && !quantity)}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('form.fetchingData')}
            </>
          ) : (
            t('form.analyzeInvestment')
          )}
        </Button>
      </form>
    </Card>
  );
};
