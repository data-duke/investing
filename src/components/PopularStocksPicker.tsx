import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { POPULAR_STOCKS } from "@/lib/constants";

interface PopularStocksPickerProps {
  onSelect: (symbol: string) => void;
  isLoading?: boolean;
}

export const PopularStocksPicker = ({ onSelect, isLoading }: PopularStocksPickerProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground text-center">
        {t("calculator.popularStocks")}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {POPULAR_STOCKS.slice(0, 5).map((stock) => (
          <Button
            key={stock.symbol}
            variant="outline"
            size="sm"
            onClick={() => onSelect(stock.symbol)}
            disabled={isLoading}
            className="hover-scale transition-all duration-200 text-xs px-3"
          >
            {stock.symbol}
          </Button>
        ))}
      </div>
    </div>
  );
};
