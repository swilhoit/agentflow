'use client';

import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  Building2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Bell,
} from 'lucide-react';

interface EconomicEvent {
  id: string;
  eventId: string;
  eventName: string;
  description?: string;
  eventType: string;
  country: string;
  impactLevel: 'high' | 'medium' | 'low';
  scheduledTime: string;
  previousValue?: string;
  forecastValue?: string;
  actualValue?: string;
  unit?: string;
  symbol?: string;
  companyName?: string;
  earningsEstimate?: number;
  earningsActual?: number;
  earningsSurprisePct?: number;
  isReleased: boolean;
}

interface CalendarData {
  events: EconomicEvent[];
  eventsByDate: Record<string, EconomicEvent[]>;
  countsByType: Record<string, number>;
  highImpactThisWeek: EconomicEvent[];
  totalCount: number;
}

const eventTypeEmojis: Record<string, string> = {
  earnings: '📊',
  fomc: '🏛️',
  cpi: '📈',
  ppi: '🏭',
  gdp: '💹',
  employment: '👷',
  fed_speech: '🎤',
  ism: '🏭',
  retail_sales: '🛒',
  housing: '🏠',
  trade_balance: '⚖️',
  consumer_conf: '😊',
  opec: '🛢️',
  other: '📅',
};

const impactColors: Record<string, string> = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

function CalendarSkeleton() {
  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-96 w-full" />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default function CalendarPage() {
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterImpact, setFilterImpact] = useState<string | null>(null);

  useEffect(() => {
    fetchCalendarData();
  }, [filterType, filterImpact]);

  const fetchCalendarData = async () => {
    try {
      setLoading(true);
      let url = '/api/calendar?upcoming=true&days=30';
      if (filterType) url += `&types=${filterType}`;
      if (filterImpact) url += `&impact=${filterImpact}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch calendar data');

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getWeekDates = (date: Date): Date[] => {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay() + 1); // Monday
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + direction * 7);
    setSelectedDate(newDate);
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  if (loading) return <CalendarSkeleton />;

  const weekDates = getWeekDates(selectedDate);

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarIcon className="h-7 w-7" />
              Economic Calendar
            </h1>
            <p className="text-muted-foreground">
              Track upcoming earnings, FOMC meetings, CPI releases, and other market-moving events
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchCalendarData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">High Impact This Week</p>
                  <p className="text-2xl font-bold">{data?.highImpactThisWeek.length || 0}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Earnings Reports</p>
                  <p className="text-2xl font-bold">{data?.countsByType?.earnings || 0}</p>
                </div>
                <Building2 className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">FOMC/Fed Events</p>
                  <p className="text-2xl font-bold">
                    {(data?.countsByType?.fomc || 0) + (data?.countsByType?.fed_speech || 0)}
                  </p>
                </div>
                <span className="text-3xl">🏛️</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Events (30d)</p>
                  <p className="text-2xl font-bold">{data?.totalCount || 0}</p>
                </div>
                <CalendarIcon className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterImpact === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterImpact(null)}
          >
            All Impact
          </Button>
          <Button
            variant={filterImpact === 'high' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterImpact('high')}
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            High
          </Button>
          <Button
            variant={filterImpact === 'medium' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterImpact('medium')}
          >
            Medium
          </Button>

          <div className="border-l mx-2" />

          <Button
            variant={filterType === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType(null)}
          >
            All Types
          </Button>
          <Button
            variant={filterType === 'earnings' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('earnings')}
          >
            📊 Earnings
          </Button>
          <Button
            variant={filterType === 'fomc' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('fomc')}
          >
            🏛️ FOMC
          </Button>
          <Button
            variant={filterType === 'cpi' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('cpi')}
          >
            📈 CPI
          </Button>
          <Button
            variant={filterType === 'employment' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('employment')}
          >
            👷 Employment
          </Button>
        </div>

        {/* Week Navigation */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Weekly View</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigateWeek(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>
                  Today
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigateWeek(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Week Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}

              {weekDates.map((date) => {
                const dateKey = formatDate(date);
                const dayEvents = data?.eventsByDate?.[dateKey] || [];
                const highImpactCount = dayEvents.filter(e => e.impactLevel === 'high').length;

                return (
                  <div
                    key={dateKey}
                    className={cn(
                      'min-h-[120px] border rounded-lg p-2 cursor-pointer transition-colors',
                      isToday(date) && 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950',
                      'hover:bg-muted/50'
                    )}
                    onClick={() => setSelectedDate(date)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn(
                        'text-sm font-medium',
                        isToday(date) && 'text-blue-600 dark:text-blue-400'
                      )}>
                        {date.getDate()}
                      </span>
                      {highImpactCount > 0 && (
                        <Badge variant="destructive" className="text-xs px-1">
                          {highImpactCount}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1 overflow-y-auto max-h-[80px]">
                      {dayEvents.slice(0, 4).map((event) => (
                        <div
                          key={event.eventId}
                          className={cn(
                            'text-xs p-1 rounded truncate',
                            impactColors[event.impactLevel]
                          )}
                          title={event.eventName}
                        >
                          {eventTypeEmojis[event.eventType]} {event.symbol || event.eventName.slice(0, 15)}
                        </div>
                      ))}
                      {dayEvents.length > 4 && (
                        <div className="text-xs text-muted-foreground text-center">
                          +{dayEvents.length - 4} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* High Impact Events This Week */}
        {data?.highImpactThisWeek && data.highImpactThisWeek.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                High Impact Events This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.highImpactThisWeek.map((event) => (
                  <div
                    key={event.eventId}
                    className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="text-3xl">{eventTypeEmojis[event.eventType]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate">{event.eventName}</h4>
                        <Badge className={impactColors[event.impactLevel]}>
                          {event.impactLevel}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(event.scheduledTime).toLocaleString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          timeZoneName: 'short',
                        })}
                      </p>
                      {event.symbol && (
                        <Badge variant="outline" className="mt-2">
                          {event.symbol}
                        </Badge>
                      )}
                      <div className="flex gap-4 mt-2 text-sm">
                        {event.forecastValue && (
                          <span>
                            <span className="text-muted-foreground">Forecast:</span>{' '}
                            <span className="font-medium">{event.forecastValue}{event.unit}</span>
                          </span>
                        )}
                        {event.previousValue && (
                          <span>
                            <span className="text-muted-foreground">Previous:</span>{' '}
                            <span>{event.previousValue}{event.unit}</span>
                          </span>
                        )}
                        {event.earningsEstimate && (
                          <span>
                            <span className="text-muted-foreground">EPS Est:</span>{' '}
                            <span className="font-medium">${event.earningsEstimate.toFixed(2)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Events List */}
        <Card>
          <CardHeader>
            <CardTitle>All Upcoming Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date/Time</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Event</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Impact</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Forecast</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Previous</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.events.slice(0, 50).map((event) => (
                    <tr key={event.eventId} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 text-sm">
                        {new Date(event.scheduledTime).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span>{eventTypeEmojis[event.eventType]}</span>
                          <span className="font-medium">{event.eventName}</span>
                          {event.symbol && (
                            <Badge variant="outline" className="text-xs">
                              {event.symbol}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 capitalize text-sm">{event.eventType.replace('_', ' ')}</td>
                      <td className="py-3 px-4">
                        <Badge className={impactColors[event.impactLevel]}>
                          {event.impactLevel}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {event.forecastValue && `${event.forecastValue}${event.unit || ''}`}
                        {event.earningsEstimate && `$${event.earningsEstimate.toFixed(2)}`}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {event.previousValue && `${event.previousValue}${event.unit || ''}`}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {event.isReleased ? (
                          <span className={cn(
                            'font-medium',
                            event.earningsSurprisePct && event.earningsSurprisePct > 0 ? 'text-green-600' : '',
                            event.earningsSurprisePct && event.earningsSurprisePct < 0 ? 'text-red-600' : ''
                          )}>
                            {event.actualValue || (event.earningsActual && `$${event.earningsActual.toFixed(2)}`)}
                            {event.earningsSurprisePct && (
                              <span className="text-xs ml-1">
                                ({event.earningsSurprisePct > 0 ? '+' : ''}{event.earningsSurprisePct.toFixed(1)}%)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-red-500">
            <CardContent className="pt-6">
              <p className="text-red-500">Error: {error}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
