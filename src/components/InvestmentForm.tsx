import { useState } from "react";
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

interface InvestmentFormProps {
  onSearch: (country: string, symbol: string, quantity: number, apiKey: string) => void;
  isLoading: boolean;
}

const countries = [
  { code: "AT", name: "Austria" },
  { code: "DE", name: "Germany" },
  { code: "US", name: "United States" },
  { code: "UK", name: "United Kingdom" },
  { code: "CH", name: "Switzerland" },
];

export const InvestmentForm = ({ onSearch, isLoading }: InvestmentFormProps) => {
  const [country, setCountry] = useState("");
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [apiKey, setApiKey] = useState(localStorage.getItem('alpha_vantage_key') || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (country && symbol && quantity && apiKey) {
      onSearch(country, symbol.toUpperCase(), parseFloat(quantity), apiKey);
    }
  };

  return (
    <Card className="p-6 bg-card border-border">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="country" className="text-terminal-yellow">Country of Residence</Label>
            <Select value={country} onValueChange={setCountry} required>
              <SelectTrigger id="country" className="bg-input border-border">
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
            <Label htmlFor="symbol" className="text-terminal-yellow">Stock Symbol</Label>
            <Input
              id="symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="e.g., AAPL"
              className="bg-input border-border font-mono uppercase"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity" className="text-terminal-yellow">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              className="bg-input border-border font-mono"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey" className="text-terminal-yellow">
              Alpha Vantage API Key
              <a 
                href="https://www.alphavantage.co/support/#api-key" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-terminal-blue text-xs ml-2 hover:underline"
              >
                (Get free key)
              </a>
            </Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              className="bg-input border-border font-mono"
              required
            />
          </div>
        </div>

        <Button 
          type="submit" 
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={isLoading}
        >
          {isLoading ? "Fetching Data..." : "Analyze Investment"}
        </Button>
      </form>
    </Card>
  );
};
