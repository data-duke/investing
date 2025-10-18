import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface InvestmentData {
  country: string;
  positionName: string;
  quantity: number;
  currentPrice: number;
  originallyInvested: number;
  expectedPrice5Years: number;
  announcedDividend: number;
}

interface InvestmentFormProps {
  onCalculate: (data: InvestmentData) => void;
}

const countries = [
  { code: "AT", name: "Austria", dividendTax: 0.275, capitalGainsTax: 0.275 },
  { code: "DE", name: "Germany", dividendTax: 0.26375, capitalGainsTax: 0.26375 },
  { code: "US", name: "United States", dividendTax: 0.15, capitalGainsTax: 0.20 },
  { code: "UK", name: "United Kingdom", dividendTax: 0.125, capitalGainsTax: 0.20 },
  { code: "CH", name: "Switzerland", dividendTax: 0.35, capitalGainsTax: 0 },
];

export function InvestmentForm({ onCalculate }: InvestmentFormProps) {
  const [formData, setFormData] = useState<InvestmentData>({
    country: "AT",
    positionName: "",
    quantity: 0,
    currentPrice: 0,
    originallyInvested: 0,
    expectedPrice5Years: 0,
    announcedDividend: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCalculate(formData);
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="country">Country of Residence</Label>
            <Select value={formData.country} onValueChange={(value) => setFormData({ ...formData, country: value })}>
              <SelectTrigger id="country">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="positionName">Stock/Position Name</Label>
            <Input
              id="positionName"
              placeholder="e.g., AAPL, VWCE"
              value={formData.positionName}
              onChange={(e) => setFormData({ ...formData, positionName: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              placeholder="0"
              value={formData.quantity || ""}
              onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currentPrice">Current Price</Label>
            <Input
              id="currentPrice"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.currentPrice || ""}
              onChange={(e) => setFormData({ ...formData, currentPrice: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="originallyInvested">Originally Invested</Label>
            <Input
              id="originallyInvested"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.originallyInvested || ""}
              onChange={(e) => setFormData({ ...formData, originallyInvested: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expectedPrice5Years">Expected Price (5 Years)</Label>
            <Input
              id="expectedPrice5Years"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.expectedPrice5Years || ""}
              onChange={(e) => setFormData({ ...formData, expectedPrice5Years: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="announcedDividend">Annual Dividend per Share</Label>
            <Input
              id="announcedDividend"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.announcedDividend || ""}
              onChange={(e) => setFormData({ ...formData, announcedDividend: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>

        <Button type="submit" className="w-full">
          Calculate Investment Analysis
        </Button>
      </form>
    </Card>
  );
}
