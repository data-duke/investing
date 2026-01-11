import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, ChevronLeft, ChevronRight, DollarSign, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { useTranslation } from "react-i18next";
import { usePrivacy } from "@/contexts/PrivacyContext";
import { AggregatedPosition } from "@/lib/constants";

interface DividendCalendarProps {
  positions: AggregatedPosition[];
  privacyMode?: boolean;
}

interface DividendEvent {
  symbol: string;
  name: string;
  exDate: Date;
  paymentDate: Date | null;
  amount: number;
  quantity: number;
  totalAmount: number;
  isPast: boolean;
}

interface MonthGroup {
  month: string;
  year: number;
  events: DividendEvent[];
  totalExpected: number;
}

export const DividendCalendar = ({ positions, privacyMode: privacyModeProp }: DividendCalendarProps) => {
  const { t } = useTranslation();
  const { privacyMode: contextPrivacyMode } = usePrivacy();
  const privacyMode = privacyModeProp ?? contextPrivacyMode;
  
  const [dividendEvents, setDividendEvents] = useState<DividendEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'upcoming' | 'past'>('upcoming');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    fetchDividendDates();
  }, [positions]);

  const fetchDividendDates = async () => {
    if (positions.length === 0) {
      setDividendEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const symbols = positions.map(p => p.symbol);
      
      // Fetch dividend dates from edge function
      const { data, error } = await supabase.functions.invoke('fetch-dividend-calendar', {
        body: { symbols }
      });

      if (error) {
        console.error('Error fetching dividend calendar:', error);
        setLoading(false);
        return;
      }

      const now = new Date();
      const events: DividendEvent[] = [];

      // Process dividend data
      if (data?.dividends) {
        for (const div of data.dividends) {
          const position = positions.find(p => p.symbol === div.symbol);
          if (!position) continue;

          const exDate = new Date(div.ex_date);
          const paymentDate = div.payment_date ? new Date(div.payment_date) : null;
          const amount = Number(div.dividend_amount) || 0;
          const quantity = position.totalQuantity;
          
          events.push({
            symbol: div.symbol,
            name: position.name,
            exDate,
            paymentDate,
            amount,
            quantity,
            totalAmount: amount * quantity,
            isPast: exDate < now
          });
        }
      }

      // Sort by ex-date
      events.sort((a, b) => a.exDate.getTime() - b.exDate.getTime());
      
      setDividendEvents(events);
    } catch (e) {
      console.error('Failed to fetch dividend dates:', e);
    } finally {
      setLoading(false);
    }
  };

  // Group events by month
  const groupEventsByMonth = (events: DividendEvent[]): MonthGroup[] => {
    const groups = new Map<string, MonthGroup>();
    
    events.forEach(event => {
      const date = event.exDate;
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'long' });
      
      if (!groups.has(key)) {
        groups.set(key, {
          month: monthName,
          year: date.getFullYear(),
          events: [],
          totalExpected: 0
        });
      }
      
      const group = groups.get(key)!;
      group.events.push(event);
      group.totalExpected += event.totalAmount;
    });

    return Array.from(groups.values());
  };

  // Filter events based on view mode
  const filteredEvents = dividendEvents.filter(e => 
    viewMode === 'upcoming' ? !e.isPast : e.isPast
  );

  const monthGroups = groupEventsByMonth(
    viewMode === 'upcoming' 
      ? filteredEvents 
      : filteredEvents.reverse()
  );

  // Navigate months for empty state
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      return newMonth;
    });
  };

  if (loading) {
    return (
      <Card className="border-primary/20 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('dividend.calendar')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('dividend.calendar')}
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant={viewMode === 'upcoming' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('upcoming')}
              className="text-xs px-3 h-8"
            >
              {t('dividend.upcoming')}
            </Button>
            <Button
              variant={viewMode === 'past' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('past')}
              className="text-xs px-3 h-8"
            >
              {t('dividend.past')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {monthGroups.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <div className="flex items-center justify-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigateMonth('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-muted-foreground font-medium">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <Button variant="ghost" size="icon" onClick={() => navigateMonth('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {viewMode === 'upcoming' 
                ? t('dividend.noUpcoming')
                : t('dividend.noPast')}
            </p>
          </div>
        ) : (
          <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2">
            {monthGroups.map((group, idx) => (
              <div key={idx} className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-semibold text-sm">
                    {group.month} {group.year}
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    {t('dividend.expected')}: 
                    <span className="font-semibold text-primary ml-1">
                      {privacyMode ? '•••' : formatCurrency(group.totalExpected)}
                    </span>
                  </span>
                </div>
                
                <div className="space-y-2">
                  {group.events.map((event, eventIdx) => (
                    <div 
                      key={eventIdx}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center justify-center bg-background rounded-md p-2 min-w-[50px] border">
                          <span className="text-xs text-muted-foreground">
                            {event.exDate.toLocaleDateString('en-US', { month: 'short' })}
                          </span>
                          <span className="text-lg font-bold">
                            {event.exDate.getDate()}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{event.symbol}</span>
                            {event.isPast ? (
                              <Badge variant="secondary" className="text-xs">
                                {t('dividend.received')}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                {t('dividend.pending')}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {event.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {privacyMode ? '•••' : formatCurrency(event.amount)}/{t('common.shares').toLowerCase().slice(0, -1)}
                            </span>
                            <span className="text-xs text-muted-foreground">×</span>
                            <span className="text-xs text-muted-foreground">
                              {event.quantity} {t('common.shares')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-green-500" />
                          <span className="font-semibold text-green-600">
                            {privacyMode ? '•••' : formatCurrency(event.totalAmount)}
                          </span>
                        </div>
                        {event.paymentDate && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              {t('dividend.paysOn')} {event.paymentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
