import { useState } from "react";
import { Portfolio, usePortfolio } from "@/hooks/usePortfolio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Trash2, Pencil, DollarSign } from "lucide-react";
import { StockNewsSection } from "./StockNewsSection";
import { EditInvestmentDialog } from "./EditInvestmentDialog";
import { ManualDividendDialog } from "./ManualDividendDialog";
import { Fragment } from "react";
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

interface AggregatedPosition {
  symbol: string;
  name: string;
  country: string;
  totalQuantity: number;
  totalOriginalInvestment: number;
  avgOriginalPrice: number;
  current_price_eur?: number;
  current_value_eur?: number;
  gain_loss_eur?: number;
  gain_loss_percent?: number;
  dividend_annual_eur?: number;
  lots: Portfolio[];
}

interface HoldingsTableProps {
  portfolios: Portfolio[];
  aggregatedPositions: AggregatedPosition[];
  onRefresh: () => void;
  highlightedId?: string | null;
}

export const HoldingsTable = ({ portfolios, aggregatedPositions, onRefresh, highlightedId }: HoldingsTableProps) => {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editPortfolio, setEditPortfolio] = useState<Portfolio | null>(null);
  const [manualDivDialog, setManualDivDialog] = useState<{ open: boolean; position: AggregatedPosition | null }>({ open: false, position: null });
  const { deleteInvestment } = usePortfolio();

  const handleDelete = async () => {
    if (deleteId) {
      await deleteInvestment(deleteId);
      setDeleteId(null);
      onRefresh();
    }
  };

  const totalValue = aggregatedPositions.reduce((sum, p) => sum + (p.current_value_eur || 0), 0);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stock</TableHead>
                <TableHead className="text-right">Tag</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Avg Price</TableHead>
                <TableHead className="text-right">Current Price</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Gain/Loss</TableHead>
                <TableHead className="text-right">Dividend</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aggregatedPositions.map((position) => {
                const isExpanded = expandedRow === position.symbol;
                const weight = totalValue > 0 
                  ? ((position.current_value_eur || 0) / totalValue * 100)
                  : 0;

                return (
                  <Fragment key={position.symbol}>
                    <TableRow
                      id={`investment-${position.lots[0]?.id}`}
                      className={`cursor-pointer hover:bg-muted/50 transition-all ${
                        highlightedId === position.lots[0]?.id ? 'animate-pulse bg-primary/20' : ''
                      }`}
                      onClick={() => setExpandedRow(isExpanded ? null : position.symbol)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          <div>
                            <div className="font-medium">{position.symbol}</div>
                            <div className="text-xs text-muted-foreground">{position.name}</div>
                            {position.lots.length > 1 && (
                              <div className="text-xs text-primary">{position.lots.length} lots</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {position.lots[0]?.tag ? (
                          <Badge variant="default" className="text-xs">{position.lots[0].tag}</Badge>
                        ) : position.lots[0]?.auto_tag_date ? (
                          <Badge variant="outline" className="text-xs">{position.lots[0].auto_tag_date}</Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">{position.totalQuantity.toFixed(2)}</TableCell>
                      <TableCell className="text-right">€{position.avgOriginalPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        {position.current_price_eur ? `€${position.current_price_eur.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        €{(position.current_value_eur || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={position.gain_loss_eur && position.gain_loss_eur >= 0 ? "text-green-600" : "text-red-600"}>
                          <div>€{(position.gain_loss_eur || 0).toFixed(2)}</div>
                          <div className="text-xs">
                            {position.gain_loss_percent ? `${position.gain_loss_percent >= 0 ? '+' : ''}${position.gain_loss_percent.toFixed(2)}%` : '-'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {position.lots[0]?.manual_dividend_eur ? (
                            <Badge variant="secondary" className="text-xs">M</Badge>
                          ) : null}
                          <span>{position.dividend_annual_eur ? `€${position.dividend_annual_eur.toFixed(2)}` : '-'}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setManualDivDialog({ open: true, position });
                            }}
                          >
                            <DollarSign className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{weight.toFixed(1)}%</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="text-muted-foreground text-xs">
                          {position.lots.length > 1 ? 'Multiple' : 'Single'}
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/30 p-6">
                          <div className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid md:grid-cols-2 gap-6">
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-sm">Position Summary</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total Shares:</span>
                                    <span className="font-semibold">{position.totalQuantity.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Avg Purchase Price:</span>
                                    <span>€{position.avgOriginalPrice.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total Invested:</span>
                                    <span>€{position.totalOriginalInvestment.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Number of Lots:</span>
                                    <span>{position.lots.length}</span>
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
                                      {position.dividend_annual_eur ? `€${position.dividend_annual_eur.toFixed(2)}` : 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total Return:</span>
                                    <span className={position.gain_loss_eur && position.gain_loss_eur >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                                      {position.gain_loss_eur ? `€${position.gain_loss_eur.toFixed(2)}` : 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Return %:</span>
                                    <span className={position.gain_loss_percent && position.gain_loss_percent >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                                      {position.gain_loss_percent ? `${position.gain_loss_percent >= 0 ? '+' : ''}${position.gain_loss_percent.toFixed(2)}%` : 'N/A'}
                                    </span>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>

                            {/* Individual Lots */}
                            {position.lots.length > 1 && (
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-sm">Individual Lots</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-3">
                                    {position.lots.map((lot) => (
                                      <div key={lot.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                                        <div className="space-y-1 text-sm flex-1">
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Purchase:</span>
                                            <span>{new Date(lot.purchase_date).toLocaleDateString()}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Qty:</span>
                                            <span>{lot.quantity} @ €{Number(lot.original_price_eur).toFixed(2)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Invested:</span>
                                            <span>€{Number(lot.original_investment_eur).toFixed(2)}</span>
                                          </div>
                                        </div>
                                        <div className="flex gap-1 ml-4">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditPortfolio(lot);
                                            }}
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDeleteId(lot.id);
                                            }}
                                          >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </CardContent>
                              </Card>
                            )}

                            {/* Single lot actions */}
                            {position.lots.length === 1 && (
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditPortfolio(position.lots[0])}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDeleteId(position.lots[0].id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </Button>
                              </div>
                            )}

                            {/* Stock News Section */}
                            <StockNewsSection symbol={position.symbol} />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
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

      <ManualDividendDialog
        open={manualDivDialog.open}
        onOpenChange={(open) => setManualDivDialog({ open, position: null })}
        portfolioIds={manualDivDialog.position?.lots.map(l => l.id) || []}
        symbol={manualDivDialog.position?.symbol || ''}
        currentDividend={manualDivDialog.position?.lots[0]?.manual_dividend_eur}
        onSuccess={onRefresh}
      />
    </>
  );
};
