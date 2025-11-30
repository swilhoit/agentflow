import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export interface EconomicEvent {
  id: string;
  eventId: string;
  eventName: string;
  description?: string;
  eventType: string;
  country: string;
  impactLevel: 'high' | 'medium' | 'low';
  scheduledTime: string;
  actualReleaseTime?: string;
  previousValue?: string;
  forecastValue?: string;
  actualValue?: string;
  unit?: string;
  symbol?: string;
  companyName?: string;
  earningsEstimate?: number;
  earningsActual?: number;
  revenueEstimate?: number;
  revenueActual?: number;
  earningsSurprisePct?: number;
  marketReaction?: 'bullish' | 'bearish' | 'neutral';
  affectedSectors?: string[];
  tradingNotes?: string;
  isReleased: boolean;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventTypes = searchParams.get('types')?.split(',') || null;
    const impactLevels = searchParams.get('impact')?.split(',') || null;
    const country = searchParams.get('country') || 'US';
    const days = parseInt(searchParams.get('days') || '30');
    const symbol = searchParams.get('symbol') || null;
    const upcoming = searchParams.get('upcoming') === 'true';

    // Calculate date range
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    // Build query
    let query = supabase
      .from('economic_calendar')
      .select('*')
      .order('scheduled_time', { ascending: true });

    if (upcoming) {
      query = query.gte('scheduled_time', startDate.toISOString());
    }

    query = query.lte('scheduled_time', endDate.toISOString());

    if (eventTypes) {
      query = query.in('event_type', eventTypes);
    }

    if (impactLevels) {
      query = query.in('impact_level', impactLevels);
    }

    if (country !== 'all') {
      query = query.eq('country', country);
    }

    if (symbol) {
      query = query.eq('symbol', symbol);
    }

    const { data, error } = await query.limit(200);

    if (error) {
      console.error('Error fetching calendar events:', error);
      return NextResponse.json({
        error: 'Failed to fetch calendar events',
        details: error.message
      }, { status: 500 });
    }

    // Map database rows to response format
    const events: EconomicEvent[] = (data || []).map((row: any) => ({
      id: row.id?.toString(),
      eventId: row.event_id,
      eventName: row.event_name,
      description: row.description,
      eventType: row.event_type,
      country: row.country,
      impactLevel: row.impact_level,
      scheduledTime: row.scheduled_time,
      actualReleaseTime: row.actual_release_time,
      previousValue: row.previous_value,
      forecastValue: row.forecast_value,
      actualValue: row.actual_value,
      unit: row.unit,
      symbol: row.symbol,
      companyName: row.company_name,
      earningsEstimate: row.earnings_estimate ? parseFloat(row.earnings_estimate) : undefined,
      earningsActual: row.earnings_actual ? parseFloat(row.earnings_actual) : undefined,
      revenueEstimate: row.revenue_estimate,
      revenueActual: row.revenue_actual,
      earningsSurprisePct: row.earnings_surprise_pct ? parseFloat(row.earnings_surprise_pct) : undefined,
      marketReaction: row.market_reaction,
      affectedSectors: row.affected_sectors,
      tradingNotes: row.trading_notes,
      isReleased: row.is_released,
    }));

    // Group by date for calendar view
    const eventsByDate: Record<string, EconomicEvent[]> = {};
    for (const event of events) {
      const dateKey = event.scheduledTime.split('T')[0];
      if (!eventsByDate[dateKey]) {
        eventsByDate[dateKey] = [];
      }
      eventsByDate[dateKey].push(event);
    }

    // Get counts by type
    const countsByType: Record<string, number> = {};
    for (const event of events) {
      countsByType[event.eventType] = (countsByType[event.eventType] || 0) + 1;
    }

    // Get high impact events this week
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const highImpactThisWeek = events.filter(e =>
      e.impactLevel === 'high' &&
      new Date(e.scheduledTime) <= weekEnd
    );

    return NextResponse.json({
      events,
      eventsByDate,
      countsByType,
      highImpactThisWeek,
      totalCount: events.length,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      lastUpdated: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error in calendar API:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
