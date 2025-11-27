import Alpaca from '@alpacahq/alpaca-trade-api';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface AlpacaConfig {
  apiKey: string;
  secretKey: string;
  paper?: boolean; // Default true for safety
  baseUrl?: string;
}

export interface AccountInfo {
  id: string;
  accountNumber: string;
  status: string;
  currency: string;
  cash: number;
  portfolioValue: number;
  buyingPower: number;
  daytradeCount: number;
  patternDayTrader: boolean;
  tradingBlocked: boolean;
  transfersBlocked: boolean;
  equity: number;
  lastEquity: number;
  longMarketValue: number;
  shortMarketValue: number;
  initialMargin: number;
  maintenanceMargin: number;
  dayTradingBuyingPower: number;
  regtBuyingPower: number;
}

export interface Position {
  assetId: string;
  symbol: string;
  exchange: string;
  assetClass: string;
  avgEntryPrice: number;
  qty: number;
  side: 'long' | 'short';
  marketValue: number;
  costBasis: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  currentPrice: number;
  lastdayPrice: number;
  changeToday: number;
}

export interface Order {
  id: string;
  clientOrderId: string;
  symbol: string;
  assetClass: string;
  qty: number;
  filledQty: number;
  filledAvgPrice: number | null;
  orderClass: string;
  orderType: 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop';
  type: string;
  side: 'buy' | 'sell';
  timeInForce: 'day' | 'gtc' | 'opg' | 'cls' | 'ioc' | 'fok';
  limitPrice: number | null;
  stopPrice: number | null;
  status: OrderStatus;
  extendedHours: boolean;
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date;
  filledAt: Date | null;
  expiredAt: Date | null;
  canceledAt: Date | null;
  failedAt: Date | null;
}

export type OrderStatus =
  | 'new'
  | 'partially_filled'
  | 'filled'
  | 'done_for_day'
  | 'canceled'
  | 'expired'
  | 'replaced'
  | 'pending_cancel'
  | 'pending_replace'
  | 'accepted'
  | 'pending_new'
  | 'accepted_for_bidding'
  | 'stopped'
  | 'rejected'
  | 'suspended'
  | 'calculated';

export interface OrderRequest {
  symbol: string;
  qty?: number;
  notional?: number; // Dollar amount for fractional shares
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop';
  timeInForce: 'day' | 'gtc' | 'opg' | 'cls' | 'ioc' | 'fok';
  limitPrice?: number;
  stopPrice?: number;
  trailPrice?: number;
  trailPercent?: number;
  extendedHours?: boolean;
  clientOrderId?: string;
  orderClass?: 'simple' | 'bracket' | 'oco' | 'oto';
  takeProfit?: {
    limitPrice: number;
  };
  stopLoss?: {
    stopPrice: number;
    limitPrice?: number;
  };
}

export interface OptionContract {
  id: string;
  symbol: string;
  name: string;
  status: string;
  tradable: boolean;
  expirationDate: string;
  rootSymbol: string;
  underlyingSymbol: string;
  underlyingAssetId: string;
  type: 'call' | 'put';
  style: 'american' | 'european';
  strikePrice: number;
  multiplier: number;
  size: number;
  openInterest: number | null;
  openInterestDate: string | null;
  closePrice: number | null;
  closePriceDate: string | null;
}

export interface OptionOrderRequest {
  symbol: string; // Option contract symbol (e.g., "AAPL240119C00150000")
  qty: number;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  timeInForce: 'day' | 'gtc';
  limitPrice?: number;
  clientOrderId?: string;
}

export interface OptionChainParams {
  underlyingSymbol: string;
  expirationDate?: string;
  expirationDateGte?: string;
  expirationDateLte?: string;
  rootSymbol?: string;
  type?: 'call' | 'put';
  strikePrice?: number;
  strikePriceGte?: number;
  strikePriceLte?: number;
  limit?: number;
  page?: number;
}

export interface Quote {
  symbol: string;
  bidPrice: number;
  bidSize: number;
  askPrice: number;
  askSize: number;
  lastPrice: number;
  lastSize: number;
  timestamp: Date;
}

export interface Bar {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number;
  tradeCount: number;
}

export interface PortfolioHistory {
  timestamp: number[];
  equity: number[];
  profitLoss: number[];
  profitLossPct: number[];
  baseValue: number;
  timeframe: string;
}

export interface Activity {
  id: string;
  activityType: string;
  transactionTime: Date;
  type: string;
  price: number;
  qty: number;
  side: string;
  symbol: string;
  leaveQty: number;
  cumQty: number;
  avgPrice: number;
  orderStatus: string;
}

export interface Watchlist {
  id: string;
  accountId: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  assets?: Array<{
    id: string;
    class: string;
    exchange: string;
    symbol: string;
    name: string;
    status: string;
    tradable: boolean;
  }>;
}

// ============================================================================
// Alpaca Trading Service
// ============================================================================

export class AlpacaTradingService extends EventEmitter {
  private client: Alpaca;
  private isPaper: boolean;
  private isInitialized: boolean = false;

  constructor(config: AlpacaConfig) {
    super();

    this.isPaper = config.paper !== false; // Default to paper trading for safety

    const baseUrl = config.baseUrl || (this.isPaper
      ? 'https://paper-api.alpaca.markets'
      : 'https://api.alpaca.markets');

    this.client = new Alpaca({
      keyId: config.apiKey,
      secretKey: config.secretKey,
      paper: this.isPaper,
      baseUrl: baseUrl
    });

    logger.info(`🦙 Alpaca Trading Service initialized (${this.isPaper ? 'PAPER' : 'LIVE'} trading)`);
  }

  // ==========================================================================
  // Initialization & Validation
  // ==========================================================================

  async initialize(): Promise<boolean> {
    try {
      // Verify connection by fetching account
      const account = await this.getAccount();

      if (account.tradingBlocked) {
        logger.warn('⚠️ Alpaca account trading is blocked');
        return false;
      }

      this.isInitialized = true;
      logger.info(`✅ Alpaca connection verified - Account: ${account.accountNumber}`);
      logger.info(`   Portfolio Value: $${account.portfolioValue.toFixed(2)}`);
      logger.info(`   Buying Power: $${account.buyingPower.toFixed(2)}`);

      this.emit('initialized', account);
      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize Alpaca connection:', error);
      this.emit('error', error);
      return false;
    }
  }

  isPaperTrading(): boolean {
    return this.isPaper;
  }

  // ==========================================================================
  // Account Operations
  // ==========================================================================

  async getAccount(): Promise<AccountInfo> {
    try {
      const account = await this.client.getAccount();

      return {
        id: account.id,
        accountNumber: account.account_number,
        status: account.status,
        currency: account.currency,
        cash: parseFloat(account.cash),
        portfolioValue: parseFloat(account.portfolio_value),
        buyingPower: parseFloat(account.buying_power),
        daytradeCount: parseInt(account.daytrade_count),
        patternDayTrader: account.pattern_day_trader,
        tradingBlocked: account.trading_blocked,
        transfersBlocked: account.transfers_blocked,
        equity: parseFloat(account.equity),
        lastEquity: parseFloat(account.last_equity),
        longMarketValue: parseFloat(account.long_market_value),
        shortMarketValue: parseFloat(account.short_market_value),
        initialMargin: parseFloat(account.initial_margin),
        maintenanceMargin: parseFloat(account.maintenance_margin),
        dayTradingBuyingPower: parseFloat(account.daytrading_buying_power),
        regtBuyingPower: parseFloat(account.regt_buying_power)
      };
    } catch (error) {
      logger.error('Error fetching account:', error);
      throw error;
    }
  }

  async getPortfolioHistory(params?: {
    period?: '1D' | '1W' | '1M' | '3M' | '6M' | '1A' | 'all';
    timeframe?: '1Min' | '5Min' | '15Min' | '1H' | '1D';
    dateStart?: string;
    dateEnd?: string;
    extendedHours?: boolean;
  }): Promise<PortfolioHistory> {
    try {
      const history = await this.client.getPortfolioHistory(params as any || {});

      return {
        timestamp: history.timestamp,
        equity: history.equity,
        profitLoss: history.profit_loss,
        profitLossPct: history.profit_loss_pct,
        baseValue: history.base_value,
        timeframe: history.timeframe
      };
    } catch (error) {
      logger.error('Error fetching portfolio history:', error);
      throw error;
    }
  }

  async getActivities(params?: {
    activityTypes?: string;
    date?: string;
    until?: string;
    after?: string;
    direction?: 'asc' | 'desc';
    pageSize?: number;
    pageToken?: string;
  }): Promise<Activity[]> {
    try {
      const activities = await this.client.getAccountActivities(params as any || {});

      return activities.map((activity: any) => ({
        id: activity.id,
        activityType: activity.activity_type,
        transactionTime: new Date(activity.transaction_time),
        type: activity.type,
        price: parseFloat(activity.price || '0'),
        qty: parseFloat(activity.qty || '0'),
        side: activity.side,
        symbol: activity.symbol,
        leaveQty: parseFloat(activity.leaves_qty || '0'),
        cumQty: parseFloat(activity.cum_qty || '0'),
        avgPrice: parseFloat(activity.avg_price || '0'),
        orderStatus: activity.order_status
      }));
    } catch (error) {
      logger.error('Error fetching activities:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Position Management
  // ==========================================================================

  async getPositions(): Promise<Position[]> {
    try {
      const positions = await this.client.getPositions();

      return positions.map((pos: any) => ({
        assetId: pos.asset_id,
        symbol: pos.symbol,
        exchange: pos.exchange,
        assetClass: pos.asset_class,
        avgEntryPrice: parseFloat(pos.avg_entry_price),
        qty: parseFloat(pos.qty),
        side: pos.side,
        marketValue: parseFloat(pos.market_value),
        costBasis: parseFloat(pos.cost_basis),
        unrealizedPL: parseFloat(pos.unrealized_pl),
        unrealizedPLPercent: parseFloat(pos.unrealized_plpc) * 100,
        currentPrice: parseFloat(pos.current_price),
        lastdayPrice: parseFloat(pos.lastday_price),
        changeToday: parseFloat(pos.change_today) * 100
      }));
    } catch (error) {
      logger.error('Error fetching positions:', error);
      throw error;
    }
  }

  async getPosition(symbol: string): Promise<Position | null> {
    try {
      const pos = await this.client.getPosition(symbol);

      return {
        assetId: pos.asset_id,
        symbol: pos.symbol,
        exchange: pos.exchange,
        assetClass: pos.asset_class,
        avgEntryPrice: parseFloat(pos.avg_entry_price),
        qty: parseFloat(pos.qty),
        side: pos.side,
        marketValue: parseFloat(pos.market_value),
        costBasis: parseFloat(pos.cost_basis),
        unrealizedPL: parseFloat(pos.unrealized_pl),
        unrealizedPLPercent: parseFloat(pos.unrealized_plpc) * 100,
        currentPrice: parseFloat(pos.current_price),
        lastdayPrice: parseFloat(pos.lastday_price),
        changeToday: parseFloat(pos.change_today) * 100
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      logger.error(`Error fetching position for ${symbol}:`, error);
      throw error;
    }
  }

  async closePosition(symbol: string, options?: {
    qty?: number;
    percentage?: number;
  }): Promise<Order> {
    try {
      logger.info(`📤 Closing position: ${symbol}`, options);

      const order = await this.client.closePosition(symbol);

      this.emit('positionClosed', { symbol, order });
      return this.parseOrder(order);
    } catch (error) {
      logger.error(`Error closing position ${symbol}:`, error);
      throw error;
    }
  }

  async closeAllPositions(cancelOrders: boolean = true): Promise<Order[]> {
    try {
      logger.warn('⚠️ Closing ALL positions');

      const orders = await this.client.closeAllPositions();

      this.emit('allPositionsClosed', orders);
      return orders.map((o: any) => this.parseOrder(o));
    } catch (error) {
      logger.error('Error closing all positions:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Order Management - Stocks
  // ==========================================================================

  async createOrder(request: OrderRequest): Promise<Order> {
    try {
      logger.info(`📝 Creating order: ${request.side} ${request.qty || request.notional} ${request.symbol}`);

      const orderParams: any = {
        symbol: request.symbol,
        side: request.side,
        type: request.type,
        time_in_force: request.timeInForce
      };

      // Quantity or notional (for fractional shares)
      if (request.qty) {
        orderParams.qty = request.qty;
      } else if (request.notional) {
        orderParams.notional = request.notional;
      }

      // Price parameters
      if (request.limitPrice) orderParams.limit_price = request.limitPrice;
      if (request.stopPrice) orderParams.stop_price = request.stopPrice;
      if (request.trailPrice) orderParams.trail_price = request.trailPrice;
      if (request.trailPercent) orderParams.trail_percent = request.trailPercent;

      // Extended hours
      if (request.extendedHours) orderParams.extended_hours = true;

      // Client order ID
      if (request.clientOrderId) orderParams.client_order_id = request.clientOrderId;

      // Bracket/OCO/OTO orders
      if (request.orderClass) {
        orderParams.order_class = request.orderClass;

        if (request.takeProfit) {
          orderParams.take_profit = {
            limit_price: request.takeProfit.limitPrice
          };
        }

        if (request.stopLoss) {
          orderParams.stop_loss = {
            stop_price: request.stopLoss.stopPrice,
            limit_price: request.stopLoss.limitPrice
          };
        }
      }

      const order = await this.client.createOrder(orderParams);

      this.emit('orderCreated', order);
      logger.info(`✅ Order created: ${order.id}`);

      return this.parseOrder(order);
    } catch (error) {
      logger.error('Error creating order:', error);
      throw error;
    }
  }

  async getOrder(orderId: string): Promise<Order> {
    try {
      const order = await this.client.getOrder(orderId);
      return this.parseOrder(order);
    } catch (error) {
      logger.error(`Error fetching order ${orderId}:`, error);
      throw error;
    }
  }

  async getOrderByClientId(clientOrderId: string): Promise<Order> {
    try {
      const order = await this.client.getOrderByClientId(clientOrderId);
      return this.parseOrder(order);
    } catch (error) {
      logger.error(`Error fetching order by client ID ${clientOrderId}:`, error);
      throw error;
    }
  }

  async getOrders(params?: {
    status?: 'open' | 'closed' | 'all';
    limit?: number;
    after?: string;
    until?: string;
    direction?: 'asc' | 'desc';
    nested?: boolean;
    symbols?: string;
  }): Promise<Order[]> {
    try {
      const orders = await this.client.getOrders(params as any || {});
      return orders.map((o: any) => this.parseOrder(o));
    } catch (error) {
      logger.error('Error fetching orders:', error);
      throw error;
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    try {
      logger.info(`❌ Canceling order: ${orderId}`);
      await this.client.cancelOrder(orderId);
      this.emit('orderCanceled', orderId);
    } catch (error) {
      logger.error(`Error canceling order ${orderId}:`, error);
      throw error;
    }
  }

  async cancelAllOrders(): Promise<void> {
    try {
      logger.warn('⚠️ Canceling ALL orders');
      await this.client.cancelAllOrders();
      this.emit('allOrdersCanceled');
    } catch (error) {
      logger.error('Error canceling all orders:', error);
      throw error;
    }
  }

  async replaceOrder(orderId: string, changes: {
    qty?: number;
    timeInForce?: 'day' | 'gtc' | 'opg' | 'cls' | 'ioc' | 'fok';
    limitPrice?: number;
    stopPrice?: number;
    trailPrice?: number;
    clientOrderId?: string;
  }): Promise<Order> {
    try {
      logger.info(`📝 Replacing order: ${orderId}`);

      const order = await this.client.replaceOrder(orderId, {
        qty: changes.qty,
        time_in_force: changes.timeInForce,
        limit_price: changes.limitPrice,
        stop_price: changes.stopPrice,
        trail: changes.trailPrice,
        client_order_id: changes.clientOrderId
      });

      this.emit('orderReplaced', { oldOrderId: orderId, newOrder: order });
      return this.parseOrder(order);
    } catch (error) {
      logger.error(`Error replacing order ${orderId}:`, error);
      throw error;
    }
  }

  // ==========================================================================
  // Options Trading
  // ==========================================================================

  async getOptionContracts(params: OptionChainParams): Promise<OptionContract[]> {
    try {
      logger.info(`🔍 Fetching option chain for ${params.underlyingSymbol}`);

      // Build query params
      const queryParams: any = {
        underlying_symbols: params.underlyingSymbol
      };

      if (params.expirationDate) queryParams.expiration_date = params.expirationDate;
      if (params.expirationDateGte) queryParams.expiration_date_gte = params.expirationDateGte;
      if (params.expirationDateLte) queryParams.expiration_date_lte = params.expirationDateLte;
      if (params.rootSymbol) queryParams.root_symbol = params.rootSymbol;
      if (params.type) queryParams.type = params.type;
      if (params.strikePrice) queryParams.strike_price_gte = params.strikePrice;
      if (params.strikePriceGte) queryParams.strike_price_gte = params.strikePriceGte;
      if (params.strikePriceLte) queryParams.strike_price_lte = params.strikePriceLte;
      if (params.limit) queryParams.limit = params.limit;
      if (params.page) queryParams.page_token = params.page;

      // Use REST API directly for options (cast to any as SDK types may be outdated)
      const response = await (this.client as any).getOptionContracts(queryParams);

      return (response?.option_contracts || []).map((contract: any) => ({
        id: contract.id,
        symbol: contract.symbol,
        name: contract.name,
        status: contract.status,
        tradable: contract.tradable,
        expirationDate: contract.expiration_date,
        rootSymbol: contract.root_symbol,
        underlyingSymbol: contract.underlying_symbol,
        underlyingAssetId: contract.underlying_asset_id,
        type: contract.type,
        style: contract.style,
        strikePrice: parseFloat(contract.strike_price),
        multiplier: parseInt(contract.multiplier || '100'),
        size: parseFloat(contract.size || '1'),
        openInterest: contract.open_interest ? parseInt(contract.open_interest) : null,
        openInterestDate: contract.open_interest_date,
        closePrice: contract.close_price ? parseFloat(contract.close_price) : null,
        closePriceDate: contract.close_price_date
      }));
    } catch (error) {
      logger.error('Error fetching option contracts:', error);
      throw error;
    }
  }

  async getOptionContract(symbolOrId: string): Promise<OptionContract | null> {
    try {
      const contract = await (this.client as any).getOptionContract(symbolOrId);

      if (!contract) return null;

      return {
        id: contract.id,
        symbol: contract.symbol,
        name: contract.name,
        status: contract.status,
        tradable: contract.tradable,
        expirationDate: contract.expiration_date,
        rootSymbol: contract.root_symbol,
        underlyingSymbol: contract.underlying_symbol,
        underlyingAssetId: contract.underlying_asset_id,
        type: contract.type,
        style: contract.style,
        strikePrice: parseFloat(contract.strike_price),
        multiplier: parseInt(contract.multiplier || '100'),
        size: parseFloat(contract.size || '1'),
        openInterest: contract.open_interest ? parseInt(contract.open_interest) : null,
        openInterestDate: contract.open_interest_date,
        closePrice: contract.close_price ? parseFloat(contract.close_price) : null,
        closePriceDate: contract.close_price_date
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      logger.error(`Error fetching option contract ${symbolOrId}:`, error);
      throw error;
    }
  }

  async createOptionOrder(request: OptionOrderRequest): Promise<Order> {
    try {
      logger.info(`📝 Creating option order: ${request.side} ${request.qty} ${request.symbol}`);

      const orderParams: any = {
        symbol: request.symbol,
        qty: request.qty,
        side: request.side,
        type: request.type,
        time_in_force: request.timeInForce
      };

      if (request.limitPrice) orderParams.limit_price = request.limitPrice;
      if (request.clientOrderId) orderParams.client_order_id = request.clientOrderId;

      const order = await this.client.createOrder(orderParams);

      this.emit('optionOrderCreated', order);
      logger.info(`✅ Option order created: ${order.id}`);

      return this.parseOrder(order);
    } catch (error) {
      logger.error('Error creating option order:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Market Data
  // ==========================================================================

  async getLatestQuote(symbol: string): Promise<Quote> {
    try {
      const quote = await this.client.getLatestQuote(symbol);

      return {
        symbol: symbol,
        bidPrice: quote.BidPrice,
        bidSize: quote.BidSize,
        askPrice: quote.AskPrice,
        askSize: quote.AskSize,
        lastPrice: (quote.BidPrice + quote.AskPrice) / 2,
        lastSize: 0,
        timestamp: new Date(quote.Timestamp)
      };
    } catch (error) {
      logger.error(`Error fetching quote for ${symbol}:`, error);
      throw error;
    }
  }

  async getLatestTrade(symbol: string): Promise<{
    price: number;
    size: number;
    timestamp: Date;
    exchange: string;
  }> {
    try {
      const trade = await this.client.getLatestTrade(symbol);

      return {
        price: trade.Price,
        size: trade.Size,
        timestamp: new Date(trade.Timestamp),
        exchange: trade.Exchange
      };
    } catch (error) {
      logger.error(`Error fetching trade for ${symbol}:`, error);
      throw error;
    }
  }

  async getBars(symbol: string, params: {
    timeframe: '1Min' | '5Min' | '15Min' | '1Hour' | '1Day' | '1Week' | '1Month';
    start?: string;
    end?: string;
    limit?: number;
    adjustment?: 'raw' | 'split' | 'dividend' | 'all';
  }): Promise<Bar[]> {
    try {
      const bars = await this.client.getBarsV2(symbol, {
        timeframe: params.timeframe,
        start: params.start,
        end: params.end,
        limit: params.limit || 100,
        adjustment: params.adjustment || 'raw'
      });

      const result: Bar[] = [];
      for await (const bar of bars) {
        result.push({
          timestamp: new Date(bar.Timestamp),
          open: bar.OpenPrice,
          high: bar.HighPrice,
          low: bar.LowPrice,
          close: bar.ClosePrice,
          volume: bar.Volume,
          vwap: bar.VWAP,
          tradeCount: bar.TradeCount
        });
      }

      return result;
    } catch (error) {
      logger.error(`Error fetching bars for ${symbol}:`, error);
      throw error;
    }
  }

  async getSnapshot(symbol: string): Promise<{
    latestTrade: { price: number; size: number; timestamp: Date };
    latestQuote: Quote;
    minuteBar: Bar | null;
    dailyBar: Bar | null;
    prevDailyBar: Bar | null;
  }> {
    try {
      const snapshot = await this.client.getSnapshot(symbol);

      return {
        latestTrade: {
          price: snapshot.LatestTrade?.Price || 0,
          size: snapshot.LatestTrade?.Size || 0,
          timestamp: new Date(snapshot.LatestTrade?.Timestamp || Date.now())
        },
        latestQuote: {
          symbol: symbol,
          bidPrice: snapshot.LatestQuote?.BidPrice || 0,
          bidSize: snapshot.LatestQuote?.BidSize || 0,
          askPrice: snapshot.LatestQuote?.AskPrice || 0,
          askSize: snapshot.LatestQuote?.AskSize || 0,
          lastPrice: snapshot.LatestTrade?.Price || 0,
          lastSize: snapshot.LatestTrade?.Size || 0,
          timestamp: new Date(snapshot.LatestQuote?.Timestamp || Date.now())
        },
        minuteBar: snapshot.MinuteBar ? {
          timestamp: new Date(snapshot.MinuteBar.Timestamp),
          open: snapshot.MinuteBar.OpenPrice,
          high: snapshot.MinuteBar.HighPrice,
          low: snapshot.MinuteBar.LowPrice,
          close: snapshot.MinuteBar.ClosePrice,
          volume: snapshot.MinuteBar.Volume,
          vwap: snapshot.MinuteBar.VWAP,
          tradeCount: snapshot.MinuteBar.TradeCount
        } : null,
        dailyBar: snapshot.DailyBar ? {
          timestamp: new Date(snapshot.DailyBar.Timestamp),
          open: snapshot.DailyBar.OpenPrice,
          high: snapshot.DailyBar.HighPrice,
          low: snapshot.DailyBar.LowPrice,
          close: snapshot.DailyBar.ClosePrice,
          volume: snapshot.DailyBar.Volume,
          vwap: snapshot.DailyBar.VWAP,
          tradeCount: snapshot.DailyBar.TradeCount
        } : null,
        prevDailyBar: snapshot.PrevDailyBar ? {
          timestamp: new Date(snapshot.PrevDailyBar.Timestamp),
          open: snapshot.PrevDailyBar.OpenPrice,
          high: snapshot.PrevDailyBar.HighPrice,
          low: snapshot.PrevDailyBar.LowPrice,
          close: snapshot.PrevDailyBar.ClosePrice,
          volume: snapshot.PrevDailyBar.Volume,
          vwap: snapshot.PrevDailyBar.VWAP,
          tradeCount: snapshot.PrevDailyBar.TradeCount
        } : null
      };
    } catch (error) {
      logger.error(`Error fetching snapshot for ${symbol}:`, error);
      throw error;
    }
  }

  // ==========================================================================
  // Watchlists
  // ==========================================================================

  async getWatchlists(): Promise<Watchlist[]> {
    try {
      const watchlists = await this.client.getWatchlists();

      return watchlists.map((wl: any) => ({
        id: wl.id,
        accountId: wl.account_id,
        createdAt: new Date(wl.created_at),
        updatedAt: new Date(wl.updated_at),
        name: wl.name,
        assets: wl.assets?.map((a: any) => ({
          id: a.id,
          class: a.class,
          exchange: a.exchange,
          symbol: a.symbol,
          name: a.name,
          status: a.status,
          tradable: a.tradable
        }))
      }));
    } catch (error) {
      logger.error('Error fetching watchlists:', error);
      throw error;
    }
  }

  async createWatchlist(name: string, symbols: string[]): Promise<Watchlist> {
    try {
      const watchlist = await (this.client as any).addWatchlist(name, { symbols });

      return {
        id: watchlist.id,
        accountId: watchlist.account_id,
        createdAt: new Date(watchlist.created_at),
        updatedAt: new Date(watchlist.updated_at),
        name: watchlist.name,
        assets: watchlist.assets?.map((a: any) => ({
          id: a.id,
          class: a.class,
          exchange: a.exchange,
          symbol: a.symbol,
          name: a.name,
          status: a.status,
          tradable: a.tradable
        }))
      };
    } catch (error) {
      logger.error('Error creating watchlist:', error);
      throw error;
    }
  }

  async deleteWatchlist(watchlistId: string): Promise<void> {
    try {
      await this.client.deleteWatchlist(watchlistId);
    } catch (error) {
      logger.error(`Error deleting watchlist ${watchlistId}:`, error);
      throw error;
    }
  }

  async addToWatchlist(watchlistId: string, symbol: string): Promise<Watchlist> {
    try {
      const watchlist = await this.client.addToWatchlist(watchlistId, symbol);

      return {
        id: watchlist.id,
        accountId: watchlist.account_id,
        createdAt: new Date(watchlist.created_at),
        updatedAt: new Date(watchlist.updated_at),
        name: watchlist.name,
        assets: watchlist.assets?.map((a: any) => ({
          id: a.id,
          class: a.class,
          exchange: a.exchange,
          symbol: a.symbol,
          name: a.name,
          status: a.status,
          tradable: a.tradable
        }))
      };
    } catch (error) {
      logger.error(`Error adding ${symbol} to watchlist:`, error);
      throw error;
    }
  }

  async removeFromWatchlist(watchlistId: string, symbol: string): Promise<Watchlist> {
    try {
      const watchlist = await this.client.deleteFromWatchlist(watchlistId, symbol);

      return {
        id: watchlist.id,
        accountId: watchlist.account_id,
        createdAt: new Date(watchlist.created_at),
        updatedAt: new Date(watchlist.updated_at),
        name: watchlist.name,
        assets: watchlist.assets?.map((a: any) => ({
          id: a.id,
          class: a.class,
          exchange: a.exchange,
          symbol: a.symbol,
          name: a.name,
          status: a.status,
          tradable: a.tradable
        }))
      };
    } catch (error) {
      logger.error(`Error removing ${symbol} from watchlist:`, error);
      throw error;
    }
  }

  // ==========================================================================
  // Assets
  // ==========================================================================

  async getAsset(symbol: string): Promise<{
    id: string;
    class: string;
    exchange: string;
    symbol: string;
    name: string;
    status: string;
    tradable: boolean;
    marginable: boolean;
    shortable: boolean;
    easyToBorrow: boolean;
    fractionable: boolean;
  } | null> {
    try {
      const asset = await this.client.getAsset(symbol);

      return {
        id: asset.id,
        class: asset.class,
        exchange: asset.exchange,
        symbol: asset.symbol,
        name: asset.name,
        status: asset.status,
        tradable: asset.tradable,
        marginable: asset.marginable,
        shortable: asset.shortable,
        easyToBorrow: asset.easy_to_borrow,
        fractionable: asset.fractionable
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      logger.error(`Error fetching asset ${symbol}:`, error);
      throw error;
    }
  }

  async getAssets(params?: {
    status?: 'active' | 'inactive';
    assetClass?: 'us_equity' | 'crypto';
    exchange?: string;
  }): Promise<Array<{
    id: string;
    class: string;
    exchange: string;
    symbol: string;
    name: string;
    status: string;
    tradable: boolean;
    marginable: boolean;
    shortable: boolean;
    easyToBorrow: boolean;
    fractionable: boolean;
  }>> {
    try {
      const assets = await this.client.getAssets(params || {});

      return assets.map((asset: any) => ({
        id: asset.id,
        class: asset.class,
        exchange: asset.exchange,
        symbol: asset.symbol,
        name: asset.name,
        status: asset.status,
        tradable: asset.tradable,
        marginable: asset.marginable,
        shortable: asset.shortable,
        easyToBorrow: asset.easy_to_borrow,
        fractionable: asset.fractionable
      }));
    } catch (error) {
      logger.error('Error fetching assets:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Calendar & Clock
  // ==========================================================================

  async getClock(): Promise<{
    timestamp: Date;
    isOpen: boolean;
    nextOpen: Date;
    nextClose: Date;
  }> {
    try {
      const clock = await this.client.getClock();

      return {
        timestamp: new Date(clock.timestamp),
        isOpen: clock.is_open,
        nextOpen: new Date(clock.next_open),
        nextClose: new Date(clock.next_close)
      };
    } catch (error) {
      logger.error('Error fetching clock:', error);
      throw error;
    }
  }

  async getCalendar(params?: {
    start?: string;
    end?: string;
  }): Promise<Array<{
    date: string;
    open: string;
    close: string;
  }>> {
    try {
      const calendar = await this.client.getCalendar(params as any || {});

      return calendar.map((day: any) => ({
        date: day.date,
        open: day.open,
        close: day.close
      }));
    } catch (error) {
      logger.error('Error fetching calendar:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Convenience Methods
  // ==========================================================================

  /**
   * Simple market buy order
   */
  async marketBuy(symbol: string, qty: number): Promise<Order> {
    return this.createOrder({
      symbol,
      qty,
      side: 'buy',
      type: 'market',
      timeInForce: 'day'
    });
  }

  /**
   * Simple market sell order
   */
  async marketSell(symbol: string, qty: number): Promise<Order> {
    return this.createOrder({
      symbol,
      qty,
      side: 'sell',
      type: 'market',
      timeInForce: 'day'
    });
  }

  /**
   * Buy with dollar amount (fractional shares)
   */
  async buyDollarAmount(symbol: string, dollars: number): Promise<Order> {
    return this.createOrder({
      symbol,
      notional: dollars,
      side: 'buy',
      type: 'market',
      timeInForce: 'day'
    });
  }

  /**
   * Limit buy order
   */
  async limitBuy(symbol: string, qty: number, limitPrice: number): Promise<Order> {
    return this.createOrder({
      symbol,
      qty,
      side: 'buy',
      type: 'limit',
      timeInForce: 'gtc',
      limitPrice
    });
  }

  /**
   * Limit sell order
   */
  async limitSell(symbol: string, qty: number, limitPrice: number): Promise<Order> {
    return this.createOrder({
      symbol,
      qty,
      side: 'sell',
      type: 'limit',
      timeInForce: 'gtc',
      limitPrice
    });
  }

  /**
   * Stop loss order
   */
  async stopLoss(symbol: string, qty: number, stopPrice: number): Promise<Order> {
    return this.createOrder({
      symbol,
      qty,
      side: 'sell',
      type: 'stop',
      timeInForce: 'gtc',
      stopPrice
    });
  }

  /**
   * Bracket order (entry + take profit + stop loss)
   */
  async bracketOrder(symbol: string, qty: number, options: {
    side: 'buy' | 'sell';
    entryPrice?: number; // If provided, uses limit order
    takeProfitPrice: number;
    stopLossPrice: number;
    stopLossLimitPrice?: number;
  }): Promise<Order> {
    return this.createOrder({
      symbol,
      qty,
      side: options.side,
      type: options.entryPrice ? 'limit' : 'market',
      timeInForce: 'gtc',
      limitPrice: options.entryPrice,
      orderClass: 'bracket',
      takeProfit: {
        limitPrice: options.takeProfitPrice
      },
      stopLoss: {
        stopPrice: options.stopLossPrice,
        limitPrice: options.stopLossLimitPrice
      }
    });
  }

  /**
   * Get portfolio summary
   */
  async getPortfolioSummary(): Promise<{
    account: AccountInfo;
    positions: Position[];
    openOrders: Order[];
    totalValue: number;
    totalUnrealizedPL: number;
    totalUnrealizedPLPercent: number;
    dailyChange: number;
    dailyChangePercent: number;
  }> {
    const [account, positions, openOrders] = await Promise.all([
      this.getAccount(),
      this.getPositions(),
      this.getOrders({ status: 'open' })
    ]);

    const totalUnrealizedPL = positions.reduce((sum, pos) => sum + pos.unrealizedPL, 0);
    const totalCostBasis = positions.reduce((sum, pos) => sum + pos.costBasis, 0);
    const totalUnrealizedPLPercent = totalCostBasis > 0
      ? (totalUnrealizedPL / totalCostBasis) * 100
      : 0;

    const dailyChange = account.equity - account.lastEquity;
    const dailyChangePercent = account.lastEquity > 0
      ? (dailyChange / account.lastEquity) * 100
      : 0;

    return {
      account,
      positions,
      openOrders,
      totalValue: account.portfolioValue,
      totalUnrealizedPL,
      totalUnrealizedPLPercent,
      dailyChange,
      dailyChangePercent
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private parseOrder(order: any): Order {
    return {
      id: order.id,
      clientOrderId: order.client_order_id,
      symbol: order.symbol,
      assetClass: order.asset_class,
      qty: parseFloat(order.qty || '0'),
      filledQty: parseFloat(order.filled_qty || '0'),
      filledAvgPrice: order.filled_avg_price ? parseFloat(order.filled_avg_price) : null,
      orderClass: order.order_class,
      orderType: order.order_type,
      type: order.type,
      side: order.side,
      timeInForce: order.time_in_force,
      limitPrice: order.limit_price ? parseFloat(order.limit_price) : null,
      stopPrice: order.stop_price ? parseFloat(order.stop_price) : null,
      status: order.status,
      extendedHours: order.extended_hours,
      createdAt: new Date(order.created_at),
      updatedAt: new Date(order.updated_at),
      submittedAt: new Date(order.submitted_at),
      filledAt: order.filled_at ? new Date(order.filled_at) : null,
      expiredAt: order.expired_at ? new Date(order.expired_at) : null,
      canceledAt: order.canceled_at ? new Date(order.canceled_at) : null,
      failedAt: order.failed_at ? new Date(order.failed_at) : null
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let alpacaServiceInstance: AlpacaTradingService | null = null;

export function getAlpacaService(): AlpacaTradingService | null {
  return alpacaServiceInstance;
}

export function initializeAlpacaService(config: AlpacaConfig): AlpacaTradingService {
  if (alpacaServiceInstance) {
    return alpacaServiceInstance;
  }

  alpacaServiceInstance = new AlpacaTradingService(config);
  return alpacaServiceInstance;
}

export default AlpacaTradingService;
