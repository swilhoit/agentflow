import { logger } from '../utils/logger';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Client, TextChannel, EmbedBuilder, Colors } from 'discord.js';
import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface EconomicEvent {
  id: string;
  eventId: string;
  eventName: string;
  description?: string;
  eventType: EventType;
  country: string;
  impactLevel: 'high' | 'medium' | 'low';
  scheduledTime: Date;
  actualReleaseTime?: Date;
  previousValue?: string;
  forecastValue?: string;
  actualValue?: string;
  unit?: string;
  // Earnings specific
  symbol?: string;
  companyName?: string;
  earningsEstimate?: number;
  earningsActual?: number;
  revenueEstimate?: number;
  revenueActual?: number;
  earningsSurprisePct?: number;
  // Trading
  marketReaction?: 'bullish' | 'bearish' | 'neutral';
  affectedSectors?: string[];
  tradingNotes?: string;
  isReleased: boolean;
  notificationSent: boolean;
}

export type EventType =
  | 'earnings'
  | 'fomc'
  | 'cpi'
  | 'ppi'
  | 'gdp'
  | 'employment'
  | 'fed_speech'
  | 'ism'
  | 'retail_sales'
  | 'housing'
  | 'trade_balance'
  | 'consumer_conf'
  | 'opec'
  | 'other';

export interface FinnhubEarningsCalendar {
  earningsCalendar: FinnhubEarning[];
}

export interface FinnhubEarning {
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  hour: 'bmo' | 'amc' | 'dmh'; // before market open, after market close, during market hours
  quarter: number;
  revenueActual: number | null;
  revenueEstimate: number | null;
  symbol: string;
  year: number;
}

export interface FinnhubEconomicCalendar {
  economicCalendar: FinnhubEconomicEvent[];
}

export interface FinnhubEconomicEvent {
  actual: number | null;
  country: string;
  estimate: number | null;
  event: string;
  impact: 'high' | 'medium' | 'low';
  prev: number | null;
  time: string;
  unit: string;
}

export interface CalendarFilter {
  eventTypes?: EventType[];
  impactLevels?: ('high' | 'medium' | 'low')[];
  country?: string;
  symbols?: string[];
  startDate?: Date;
  endDate?: Date;
  onlyUpcoming?: boolean;
}

// ============================================================================
// EconomicCalendarService
// ============================================================================

export class EconomicCalendarService extends EventEmitter {
  private supabase: SupabaseClient;
  private finnhubApiKey: string;
  private discordClient?: Client;
  private syncInterval?: NodeJS.Timeout;

  // FOMC meeting dates for 2024-2025 (manually maintained)
  private readonly fomcDates = [
    // 2024
    '2024-01-31', '2024-03-20', '2024-05-01', '2024-06-12',
    '2024-07-31', '2024-09-18', '2024-11-07', '2024-12-18',
    // 2025
    '2025-01-29', '2025-03-19', '2025-05-07', '2025-06-18',
    '2025-07-30', '2025-09-17', '2025-11-05', '2025-12-17',
  ];

  constructor() {
    super();

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    this.finnhubApiKey = process.env.FINNHUB_API_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY required');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    logger.info('📅 EconomicCalendarService initialized');
  }

  /**
   * Set Discord client for notifications
   */
  setDiscordClient(client: Client): void {
    this.discordClient = client;
  }

  /**
   * Start automatic calendar syncing
   */
  startAutoSync(intervalHours: number = 6): void {
    // Initial sync
    this.syncAllCalendars().catch(err =>
      logger.error('Initial calendar sync failed:', err)
    );

    // Schedule recurring syncs
    this.syncInterval = setInterval(
      () => this.syncAllCalendars().catch(err =>
        logger.error('Scheduled calendar sync failed:', err)
      ),
      intervalHours * 60 * 60 * 1000
    );

    logger.info(`📅 Calendar auto-sync started (every ${intervalHours} hours)`);
  }

  /**
   * Stop auto syncing
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
  }

  /**
   * Sync all calendar types
   */
  async syncAllCalendars(): Promise<void> {
    logger.info('📅 Starting full calendar sync...');

    try {
      await Promise.all([
        this.syncEarningsCalendar(),
        this.syncEconomicCalendar(),
        this.syncFomcDates(),
      ]);

      logger.info('✅ Calendar sync complete');
      this.emit('sync:complete');
    } catch (error) {
      logger.error('Calendar sync failed:', error);
      this.emit('sync:error', error);
    }
  }

  /**
   * Fetch and store earnings calendar from Finnhub
   */
  async syncEarningsCalendar(): Promise<number> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30); // Next 30 days

    const fromStr = startDate.toISOString().split('T')[0];
    const toStr = endDate.toISOString().split('T')[0];

    const url = `https://finnhub.io/api/v1/calendar/earnings?from=${fromStr}&to=${toStr}&token=${this.finnhubApiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Finnhub API error: ${response.status}`);
      }

      const data = await response.json() as FinnhubEarningsCalendar;
      let savedCount = 0;

      for (const earning of data.earningsCalendar || []) {
        // Parse the time based on hour field
        let scheduledTime = new Date(`${earning.date}T16:00:00-05:00`); // Default to 4pm ET
        if (earning.hour === 'bmo') {
          scheduledTime = new Date(`${earning.date}T07:00:00-05:00`); // Before market open
        } else if (earning.hour === 'amc') {
          scheduledTime = new Date(`${earning.date}T16:30:00-05:00`); // After market close
        }

        const eventId = `earnings-${earning.symbol}-${earning.date}`;

        const { error } = await this.supabase
          .from('economic_calendar')
          .upsert({
            event_id: eventId,
            event_name: `${earning.symbol} Q${earning.quarter} ${earning.year} Earnings`,
            event_type: 'earnings',
            country: 'US',
            impact_level: this.getEarningsImpact(earning.symbol),
            scheduled_time: scheduledTime.toISOString(),
            symbol: earning.symbol,
            earnings_estimate: earning.epsEstimate,
            earnings_actual: earning.epsActual,
            revenue_estimate: earning.revenueEstimate,
            revenue_actual: earning.revenueActual,
            earnings_surprise_pct: earning.epsActual && earning.epsEstimate
              ? ((earning.epsActual - earning.epsEstimate) / Math.abs(earning.epsEstimate)) * 100
              : null,
            is_released: earning.epsActual !== null,
            source: 'finnhub',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'event_id' });

        if (!error) savedCount++;
      }

      logger.info(`📅 Synced ${savedCount} earnings events`);
      return savedCount;
    } catch (error) {
      logger.error('Failed to sync earnings calendar:', error);
      throw error;
    }
  }

  /**
   * Fetch and store economic calendar from Finnhub
   */
  async syncEconomicCalendar(): Promise<number> {
    const url = `https://finnhub.io/api/v1/calendar/economic?token=${this.finnhubApiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Finnhub API error: ${response.status}`);
      }

      const data = await response.json() as FinnhubEconomicCalendar;
      let savedCount = 0;

      for (const event of data.economicCalendar || []) {
        if (event.country !== 'US') continue; // Focus on US events

        const eventType = this.mapEventType(event.event);
        const eventId = `econ-${event.event.toLowerCase().replace(/\s+/g, '-')}-${event.time}`;

        const { error } = await this.supabase
          .from('economic_calendar')
          .upsert({
            event_id: eventId,
            event_name: event.event,
            event_type: eventType,
            country: event.country,
            impact_level: event.impact || 'medium',
            scheduled_time: event.time,
            previous_value: event.prev?.toString(),
            forecast_value: event.estimate?.toString(),
            actual_value: event.actual?.toString(),
            unit: event.unit,
            is_released: event.actual !== null,
            source: 'finnhub',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'event_id' });

        if (!error) savedCount++;
      }

      logger.info(`📅 Synced ${savedCount} economic events`);
      return savedCount;
    } catch (error) {
      logger.error('Failed to sync economic calendar:', error);
      throw error;
    }
  }

  /**
   * Sync FOMC meeting dates
   */
  async syncFomcDates(): Promise<number> {
    let savedCount = 0;

    for (const dateStr of this.fomcDates) {
      const meetingDate = new Date(dateStr);
      if (meetingDate < new Date()) continue; // Skip past dates

      const eventId = `fomc-${dateStr}`;
      const scheduledTime = new Date(`${dateStr}T14:00:00-05:00`); // 2pm ET typical release

      const { error } = await this.supabase
        .from('economic_calendar')
        .upsert({
          event_id: eventId,
          event_name: 'FOMC Meeting - Interest Rate Decision',
          description: 'Federal Reserve interest rate decision and monetary policy statement',
          event_type: 'fomc',
          country: 'US',
          impact_level: 'high',
          scheduled_time: scheduledTime.toISOString(),
          affected_sectors: ['financials', 'real_estate', 'utilities', 'technology'],
          source: 'manual',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'event_id' });

      if (!error) savedCount++;
    }

    logger.info(`📅 Synced ${savedCount} FOMC meeting dates`);
    return savedCount;
  }

  /**
   * Get upcoming events
   */
  async getUpcomingEvents(filter: CalendarFilter = {}): Promise<EconomicEvent[]> {
    let query = this.supabase
      .from('economic_calendar')
      .select('*')
      .gte('scheduled_time', new Date().toISOString())
      .order('scheduled_time', { ascending: true });

    if (filter.eventTypes?.length) {
      query = query.in('event_type', filter.eventTypes);
    }

    if (filter.impactLevels?.length) {
      query = query.in('impact_level', filter.impactLevels);
    }

    if (filter.country) {
      query = query.eq('country', filter.country);
    }

    if (filter.symbols?.length) {
      query = query.in('symbol', filter.symbols);
    }

    if (filter.endDate) {
      query = query.lte('scheduled_time', filter.endDate.toISOString());
    }

    const { data, error } = await query.limit(100);

    if (error) {
      logger.error('Failed to get upcoming events:', error);
      throw error;
    }

    return (data || []).map(this.mapDbToEvent);
  }

  /**
   * Get events for a specific date range
   */
  async getEventsByDateRange(startDate: Date, endDate: Date): Promise<EconomicEvent[]> {
    const { data, error } = await this.supabase
      .from('economic_calendar')
      .select('*')
      .gte('scheduled_time', startDate.toISOString())
      .lte('scheduled_time', endDate.toISOString())
      .order('scheduled_time', { ascending: true });

    if (error) {
      logger.error('Failed to get events by date range:', error);
      throw error;
    }

    return (data || []).map(this.mapDbToEvent);
  }

  /**
   * Get today's events
   */
  async getTodaysEvents(): Promise<EconomicEvent[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.getEventsByDateRange(today, tomorrow);
  }

  /**
   * Get high impact events in the next N days
   */
  async getHighImpactEvents(days: number = 7): Promise<EconomicEvent[]> {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    return this.getUpcomingEvents({
      impactLevels: ['high'],
      endDate,
    });
  }

  /**
   * Get earnings for watched symbols
   */
  async getWatchedEarnings(symbols: string[]): Promise<EconomicEvent[]> {
    return this.getUpcomingEvents({
      eventTypes: ['earnings'],
      symbols,
    });
  }

  /**
   * Get events grouped by week for calendar view
   */
  async getEventsGroupedByWeek(weeks: number = 4): Promise<Map<string, EconomicEvent[]>> {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (weeks * 7));

    const events = await this.getUpcomingEvents({ endDate });
    const grouped = new Map<string, EconomicEvent[]>();

    for (const event of events) {
      const weekStart = this.getWeekStart(event.scheduledTime);
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!grouped.has(weekKey)) {
        grouped.set(weekKey, []);
      }
      grouped.get(weekKey)!.push(event);
    }

    return grouped;
  }

  /**
   * Check for and notify about upcoming events
   */
  async checkAndNotifyUpcomingEvents(): Promise<void> {
    // Get events in the next 24 hours that haven't been notified
    const tomorrow = new Date();
    tomorrow.setHours(tomorrow.getHours() + 24);

    const { data: events, error } = await this.supabase
      .from('economic_calendar')
      .select('*')
      .gte('scheduled_time', new Date().toISOString())
      .lte('scheduled_time', tomorrow.toISOString())
      .eq('notification_sent', false)
      .eq('impact_level', 'high')
      .order('scheduled_time', { ascending: true });

    if (error || !events?.length) return;

    for (const eventData of events) {
      const event = this.mapDbToEvent(eventData);
      await this.sendEventNotification(event);

      // Mark as notified
      await this.supabase
        .from('economic_calendar')
        .update({ notification_sent: true })
        .eq('event_id', event.eventId);
    }
  }

  /**
   * Send Discord notification for an event
   */
  private async sendEventNotification(event: EconomicEvent): Promise<void> {
    if (!this.discordClient) return;

    try {
      const channel = await this.findTradingChannel();
      if (!channel) return;

      const embed = this.createEventEmbed(event);
      await channel.send({ embeds: [embed] });

      logger.info(`📢 Sent notification for ${event.eventName}`);
    } catch (error) {
      logger.error('Failed to send event notification:', error);
    }
  }

  /**
   * Create Discord embed for an event
   */
  private createEventEmbed(event: EconomicEvent): EmbedBuilder {
    const impactColors = {
      high: Colors.Red,
      medium: Colors.Yellow,
      low: Colors.Green,
    };

    const typeEmojis: Record<EventType, string> = {
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

    const scheduledStr = event.scheduledTime.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    const embed = new EmbedBuilder()
      .setColor(impactColors[event.impactLevel])
      .setTitle(`${typeEmojis[event.eventType]} ${event.eventName}`)
      .addFields(
        { name: '📅 Scheduled', value: scheduledStr, inline: true },
        { name: '⚡ Impact', value: event.impactLevel.toUpperCase(), inline: true },
      );

    if (event.description) {
      embed.setDescription(event.description);
    }

    if (event.eventType === 'earnings' && event.symbol) {
      embed.addFields(
        { name: '📈 Symbol', value: event.symbol, inline: true },
      );
      if (event.earningsEstimate) {
        embed.addFields(
          { name: '💰 EPS Estimate', value: `$${event.earningsEstimate.toFixed(2)}`, inline: true },
        );
      }
    }

    if (event.forecastValue) {
      embed.addFields(
        { name: '🎯 Forecast', value: `${event.forecastValue}${event.unit || ''}`, inline: true },
      );
    }

    if (event.previousValue) {
      embed.addFields(
        { name: '📊 Previous', value: `${event.previousValue}${event.unit || ''}`, inline: true },
      );
    }

    if (event.tradingNotes) {
      embed.addFields(
        { name: '📝 Trading Notes', value: event.tradingNotes },
      );
    }

    return embed;
  }

  /**
   * Find trading channel
   */
  private async findTradingChannel(): Promise<TextChannel | null> {
    if (!this.discordClient) return null;

    try {
      const guilds = await this.discordClient.guilds.fetch();

      for (const [guildId] of guilds) {
        const fullGuild = await this.discordClient.guilds.fetch(guildId);
        const channels = await fullGuild.channels.fetch();

        for (const [, channel] of channels) {
          if (channel && (channel.name === 'trading' || channel.name === 'global-ai') && channel.isTextBased()) {
            return channel as TextChannel;
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('Error finding trading channel:', error);
      return null;
    }
  }

  /**
   * Map Finnhub event name to event type
   */
  private mapEventType(eventName: string): EventType {
    const name = eventName.toLowerCase();

    if (name.includes('cpi') || name.includes('consumer price')) return 'cpi';
    if (name.includes('ppi') || name.includes('producer price')) return 'ppi';
    if (name.includes('gdp')) return 'gdp';
    if (name.includes('payroll') || name.includes('employment') || name.includes('jobless')) return 'employment';
    if (name.includes('ism')) return 'ism';
    if (name.includes('retail sales')) return 'retail_sales';
    if (name.includes('housing') || name.includes('home')) return 'housing';
    if (name.includes('trade balance')) return 'trade_balance';
    if (name.includes('consumer confidence') || name.includes('consumer sentiment')) return 'consumer_conf';
    if (name.includes('fomc') || name.includes('fed fund') || name.includes('interest rate')) return 'fomc';
    if (name.includes('fed') && name.includes('speak')) return 'fed_speech';

    return 'other';
  }

  /**
   * Get impact level for earnings (based on market cap, index membership)
   */
  private getEarningsImpact(symbol: string): 'high' | 'medium' | 'low' {
    // High impact: Mega-caps and market bellwethers
    const highImpact = [
      'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA',
      'JPM', 'V', 'MA', 'BAC', 'WMT', 'PG', 'JNJ', 'UNH', 'HD', 'DIS',
      'NFLX', 'ADBE', 'CRM', 'ORCL', 'AMD', 'INTC', 'COST', 'PEP', 'KO',
      'MRK', 'PFE', 'ABBV', 'LLY', 'TMO', 'ABT', 'CVX', 'XOM', 'BA', 'CAT',
    ];

    if (highImpact.includes(symbol)) return 'high';

    // Medium impact: S&P 500 components
    // For now, default to medium for recognized symbols
    if (symbol.length <= 4) return 'medium';

    return 'low';
  }

  /**
   * Get Monday of the week for a date
   */
  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Map database row to EconomicEvent
   */
  private mapDbToEvent(row: any): EconomicEvent {
    return {
      id: row.id?.toString(),
      eventId: row.event_id,
      eventName: row.event_name,
      description: row.description,
      eventType: row.event_type,
      country: row.country,
      impactLevel: row.impact_level,
      scheduledTime: new Date(row.scheduled_time),
      actualReleaseTime: row.actual_release_time ? new Date(row.actual_release_time) : undefined,
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
      notificationSent: row.notification_sent,
    };
  }
}

// Singleton instance
let calendarServiceInstance: EconomicCalendarService | null = null;

export function getEconomicCalendarService(): EconomicCalendarService {
  if (!calendarServiceInstance) {
    calendarServiceInstance = new EconomicCalendarService();
  }
  return calendarServiceInstance;
}
