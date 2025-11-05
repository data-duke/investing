import { useState, useEffect, useMemo } from "react";
import { Portfolio } from "@/hooks/usePortfolio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Trash2, Pencil, DollarSign, ArrowUpDown } from "lucide-react";
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
import { formatCurrency, formatNumber, formatPercentage } from "@/lib/formatters";
import { usePortfolio } from "@/hooks/usePortfolio";

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

type SortField = 'symbol' | 'quantity' | 'avgPrice' | 'currentPrice' | 'value' | 'gain' | 'dividend' | 'weight';
type SortDirection = 'asc' | 'desc';

export const SortableHoldingsTable = ({ portfolios, aggregatedPositions, onRefresh, highlightedId }: HoldingsTableProps) => {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editPortfolio, setEditPortfolio] = useState<Portfolio | null>(null);
  const [manualDivDialog, setManualDivDialog] = useState<{ open: boolean; portfolio: Portfolio | null }>({ open: false, portfolio: null });
  const [sortField, setSortField] = useState<SortField>('symbol');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const { deleteInvestment } = usePortfolio();

  // Load sort preferences from localStorage
  useEffect(() => {
    const savedSort = localStorage.getItem('portfolioSort');
    if (savedSort) {
      const { field, direction } = JSON.parse(savedSort);
      setSortField(field);
      setSortDirection(direction);
    }
  }, []);

  const handleSort = (field: SortField) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(newDirection);
    localStorage.setItem('portfolioSort', JSON.stringify({ field, direction: newDirection }));
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteInvestment(deleteId);
      setDeleteId(null);
      onRefresh();
    }
  };

  const totalValue = aggregatedPositions.reduce((sum, p) => sum + (p.current_value_eur || 0), 0);

  const sortedPositions = useMemo(() => {
    return [...aggregatedPositions].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortField) {
        case 'symbol':
          aVal = a.symbol;
          bVal = b.symbol;
          break;
        case 'quantity':
          aVal = a.totalQuantity;
          bVal = b.totalQuantity;
          break;
        case 'avgPrice':
          aVal = a.avgOriginalPrice;
          bVal = b.avgOriginalPrice;
          break;
        case 'currentPrice':
          aVal = a.current_price_eur || 0;
          bVal = b.current_price_eur || 0;
          break;
        case 'value':
          aVal = a.current_value_eur || 0;
          bVal = b.current_value_eur || 0;
          break;
        case 'gain':
          aVal = a.gain_loss_percent || 0;
          bVal = b.gain_loss_percent || 0;
          break;
        case 'dividend':
          aVal = a.dividend_annual_eur || 0;
          bVal = b.dividend_annual_eur || 0;
          break;
        case 'weight':
          aVal = totalValue > 0 ? ((a.current_value_eur || 0) / totalValue) : 0;
          bVal = totalValue > 0 ? ((b.current_value_eur || 0) / totalValue) : 0;
          break;
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }

      return sortDirection === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal;
    });
  }, [aggregatedPositions, sortField, sortDirection, totalValue]);

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {children}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

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
                <TableHead><SortButton field="symbol">Stock</SortButton></TableHead>
                <TableHead className="text-right">Tag</TableHead>
                <TableHead className="text-right"><SortButton field="quantity">Qty</SortButton></TableHead>
                <TableHead className="text-right"><SortButton field="avgPrice">Avg Price</SortButton></TableHead>
                <TableHead className="text-right"><SortButton field="currentPrice">Current Price</SortButton></TableHead>
                <TableHead className="text-right"><SortButton field="value">Value</SortButton></TableHead>
                <TableHead className="text-right"><SortButton field="gain">Gain/Loss</SortButton></TableHead>
                <TableHead className="text-right"><SortButton field="dividend">Dividend</SortButton></TableHead>
                <TableHead className="text-right"><SortButton field="weight">Weight</SortButton></TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPositions.map((position) => {
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
                      <TableCell className="text-right">{formatNumber(position.totalQuantity)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(position.avgOriginalPrice)}</TableCell>
                      <TableCell className="text-right">
                        {position.current_price_eur ? formatCurrency(position.current_price_eur) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(position.current_value_eur || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={position.gain_loss_eur && position.gain_loss_eur >= 0 ? "text-green-600" : "text-red-600"}>
                          <div>{formatCurrency(position.gain_loss_eur || 0)}</div>
                          <div className="text-xs">
                            {position.gain_loss_percent ? formatPercentage(position.gain_loss_percent) : '-'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {position.lots[0]?.manual_dividend_eur ? (
                            <Badge variant="secondary" className="text-xs">M</Badge>
                          ) : null}
                          <span>{position.dividend_annual_eur ? formatCurrency(position.dividend_annual_eur) : '-'}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setManualDivDialog({ open: true, portfolio: position.lots[0] });
                            }}
                          >
                            <span className="text-xs">€</span>
                            <span className="hidden sm:inline ml-1">Set</span>
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(weight, 1)}%</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="text-muted-foreground text-xs">
                          {position.lots.length > 1 ? 'Multiple' : 'Single'}
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={10} className="bg-muted/30 p-6">
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
                                    <span className="font-semibold">{formatNumber(position.totalQuantity)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Avg Purchase Price:</span>
                                    <span>{formatCurrency(position.avgOriginalPrice)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total Invested:</span>
                                    <span>{formatCurrency(position.totalOriginalInvestment)}</span>
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
                                      {position.dividend_annual_eur ? formatCurrency(position.dividend_annual_eur) : 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total Return:</span>
                                    <span className={position.gain_loss_eur && position.gain_loss_eur >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                                      {position.gain_loss_eur ? formatCurrency(position.gain_loss_eur) : 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Return %:</span>
                                    <span className={position.gain_loss_percent && position.gain_loss_percent >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                                      {position.gain_loss_percent ? formatPercentage(position.gain_loss_percent) : 'N/A'}
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
                                            <span>{formatNumber(Number(lot.quantity))} @ {formatCurrency(Number(lot.original_price_eur))}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Invested:</span>
                                            <span>{formatCurrency(Number(lot.original_investment_eur))}</span>
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
        onOpenChange={(open) => setManualDivDialog({ open, portfolio: null })}
        portfolioId={manualDivDialog.portfolio?.id || ''}
        symbol={manualDivDialog.portfolio?.symbol || ''}
        currentDividend={manualDivDialog.portfolio?.manual_dividend_eur}
      />
    </>
  );
};