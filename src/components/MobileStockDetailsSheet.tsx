import { Portfolio } from "@/hooks/usePortfolio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import { StockNewsSection } from "./StockNewsSection";
import { formatCurrency, formatNumber, formatPercentage } from "@/lib/formatters";
import { usePrivacy } from "@/contexts/PrivacyContext";
import { calculateCapitalGainsTax } from "@/lib/taxCalculations";
import { AggregatedPosition } from "@/lib/constants";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface MobileStockDetailsSheetProps {
  position: AggregatedPosition | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (portfolio: Portfolio) => void;
  onDelete: (id: string) => void;
  onSetDividend: (position: AggregatedPosition) => void;
  userCountry?: string;
}

export const MobileStockDetailsSheet = ({
  position,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onSetDividend,
  userCountry = 'AT',
}: MobileStockDetailsSheetProps) => {
  const { privacyMode } = usePrivacy();
  
  if (!position) return null;

  // Calculate net value after capital gains tax
  const marketValue = position.current_value_eur || 0;
  const gain = position.gain_loss_eur || 0;
  const taxResult = gain > 0 ? calculateCapitalGainsTax(gain, userCountry) : { tax: 0, taxRate: 0 };
  const netValue = marketValue - taxResult.tax;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-xl">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="text-lg">{position.symbol}</SheetTitle>
          <SheetDescription>{position.name}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
              <div className="text-xs text-muted-foreground">Net Value (After Tax)</div>
              <div className="font-semibold text-primary">{privacyMode ? '•••' : formatCurrency(netValue)}</div>
              {!privacyMode && gain > 0 && (
                <div className="text-xs text-muted-foreground">
                  -{formatCurrency(taxResult.tax)} tax
                </div>
              )}
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Gross Value</div>
              <div className="font-semibold">{privacyMode ? '•••' : formatCurrency(marketValue)}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Gain/Loss</div>
              <div className={`font-semibold ${position.gain_loss_eur && position.gain_loss_eur >= 0 ? "text-green-600" : "text-red-600"}`}>
                {privacyMode ? '•••' : formatCurrency(position.gain_loss_eur || 0)}
                <span className="text-xs ml-1">
                  ({position.gain_loss_percent ? formatPercentage(position.gain_loss_percent) : '-'})
                </span>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Capital Gains Tax</div>
              <div className="font-semibold">
                {privacyMode ? '•••' : (gain > 0 ? `${formatPercentage(taxResult.taxRate)}` : 'No tax')}
              </div>
            </div>
          </div>

          {/* Position Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Position Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Shares</span>
                <span className="font-medium">{formatNumber(position.totalQuantity)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg Purchase Price</span>
                <span>{privacyMode ? '•••' : formatCurrency(position.avgOriginalPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Price</span>
                <span>{privacyMode ? '•••' : (position.current_price_eur ? formatCurrency(position.current_price_eur) : '-')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Invested</span>
                <span>{privacyMode ? '•••' : formatCurrency(position.totalOriginalInvestment)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Number of Lots</span>
                <span>{position.lots.length}</span>
              </div>
            </CardContent>
          </Card>

          {/* Dividends */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Dividends</span>
                {position.lots[0]?.manual_dividend_eur && (
                  <Badge variant="secondary" className="text-xs">Manual</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Annual Dividend</span>
                <span className="font-medium">
                  {privacyMode ? '•••' : (position.dividend_annual_eur ? formatCurrency(position.dividend_annual_eur) : 'N/A')}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => onSetDividend(position)}
              >
                Set Manual Dividend
              </Button>
            </CardContent>
          </Card>

          {/* Individual Lots */}
          {position.lots.length > 1 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Individual Lots ({position.lots.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {position.lots.map((lot) => (
                  <div key={lot.id} className="bg-muted/30 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Purchase Date</span>
                      <span>{new Date(lot.purchase_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Quantity</span>
                      <span>{formatNumber(Number(lot.quantity))} @ {privacyMode ? '•••' : formatCurrency(Number(lot.original_price_eur))}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Invested</span>
                      <span>{privacyMode ? '•••' : formatCurrency(Number(lot.original_investment_eur))}</span>
                    </div>
                    {lot.tag && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tag</span>
                        <Badge variant="default" className="text-xs">{lot.tag}</Badge>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => onEdit(lot)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-destructive hover:text-destructive"
                        onClick={() => onDelete(lot.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            /* Single Lot Actions */
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onEdit(position.lots[0])}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit Position
              </Button>
              <Button
                variant="outline"
                className="flex-1 text-destructive hover:text-destructive"
                onClick={() => onDelete(position.lots[0].id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          )}

          {/* Stock News */}
          <StockNewsSection symbol={position.symbol} />
        </div>
      </SheetContent>
    </Sheet>
  );
};
