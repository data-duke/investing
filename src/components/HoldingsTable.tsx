import { useState } from "react";
import { Portfolio, usePortfolio } from "@/hooks/usePortfolio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Trash2, Pencil } from "lucide-react";
import { StockNewsSection } from "./StockNewsSection";
import { EditInvestmentDialog } from "./EditInvestmentDialog";
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
  const [editPortfolio, setEditPortfolio] = useState<Portfolio | null>(null);
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
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditPortfolio(portfolio);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
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
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/30 p-6">
                          <div className="space-y-6">
                            {/* Detailed Financial Information */}
                            <div className="grid md:grid-cols-2 gap-6">
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-sm">Investment Details</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Purchase Date:</span>
                                    <span>{new Date(portfolio.purchase_date).toLocaleDateString()}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Original Investment:</span>
                                    <span>€{Number(portfolio.original_investment_eur).toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Shares Owned:</span>
                                    <span>{portfolio.quantity}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Country:</span>
                                    <span>{portfolio.country}</span>
                                  </div>
                                </CardContent>
                              </Card>

                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-sm">Dividends & Returns</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Annual Dividend (Net):</span>
                                    <span className="font-semibold">
                                      {portfolio.dividend_annual_eur ? `€${portfolio.dividend_annual_eur.toFixed(2)}` : 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total Return:</span>
                                    <span className={portfolio.gain_loss_eur && portfolio.gain_loss_eur >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                                      {portfolio.gain_loss_eur ? `€${portfolio.gain_loss_eur.toFixed(2)}` : 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Return %:</span>
                                    <span className={portfolio.gain_loss_percent && portfolio.gain_loss_percent >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                                      {portfolio.gain_loss_percent ? `${portfolio.gain_loss_percent >= 0 ? '+' : ''}${portfolio.gain_loss_percent.toFixed(2)}%` : 'N/A'}
                                    </span>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>

                            {/* Stock News Section */}
                            <StockNewsSection symbol={portfolio.symbol} />
                          </div>
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

      <EditInvestmentDialog
        portfolio={editPortfolio}
        open={!!editPortfolio}
        onOpenChange={(open) => !open && setEditPortfolio(null)}
        onSuccess={onRefresh}
      />
    </>
  );
};
