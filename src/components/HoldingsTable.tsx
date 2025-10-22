import { useState } from "react";
import { Portfolio, usePortfolio } from "@/hooks/usePortfolio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { StockNewsSection } from "./StockNewsSection";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface HoldingsTableProps {
  portfolios: Portfolio[];
  onRefresh: () => void;
}

export const HoldingsTable = ({ portfolios, onRefresh }: HoldingsTableProps) => {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { deleteInvestment } = usePortfolio();

  const handleDelete = async () => {
    if (deleteId) {
      await deleteInvestment(deleteId);
      setDeleteId(null);
      onRefresh();
    }
  };

  const totalValue = portfolios.reduce((sum, p) => sum + (p.current_value_eur || 0), 0);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stock</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Avg Price</TableHead>
                <TableHead className="text-right">Current Price</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Gain/Loss</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {portfolios.map((portfolio) => {
                const isExpanded = expandedRow === portfolio.id;
                const weight = totalValue > 0 
                  ? ((portfolio.current_value_eur || 0) / totalValue * 100)
                  : 0;

                return (
                  <>
                    <TableRow
                      key={portfolio.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedRow(isExpanded ? null : portfolio.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          <div>
                            <div className="font-medium">{portfolio.symbol}</div>
                            <div className="text-xs text-muted-foreground">{portfolio.name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{portfolio.quantity}</TableCell>
                      <TableCell className="text-right">€{Number(portfolio.original_price_eur).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        {portfolio.current_price_eur ? `€${portfolio.current_price_eur.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        €{(portfolio.current_value_eur || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={portfolio.gain_loss_eur && portfolio.gain_loss_eur >= 0 ? "text-green-600" : "text-red-600"}>
                          <div>€{(portfolio.gain_loss_eur || 0).toFixed(2)}</div>
                          <div className="text-xs">
                            {portfolio.gain_loss_percent ? `${portfolio.gain_loss_percent >= 0 ? '+' : ''}${portfolio.gain_loss_percent.toFixed(2)}%` : '-'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{weight.toFixed(1)}%</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(portfolio.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/30">
                          <StockNewsSection symbol={portfolio.symbol} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Investment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this investment from your portfolio? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
