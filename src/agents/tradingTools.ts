import { ToolDefinition } from './toolBasedAgent';
import {
  AlpacaTradingService,
  getAlpacaService,
  initializeAlpacaService,
  OrderRequest,
  OptionOrderRequest,
  OptionChainParams
} from '../services/alpacaTrading';
import { logger } from '../utils/logger';

// ============================================================================
// Trading Tool Definitions
// ============================================================================

export function getTradingToolDefinitions(): ToolDefinition[] {
  return [
    // ========== Account & Portfolio ==========
    {
      name: 'trading_get_account',
      description: 'Get trading account information including cash balance, portfolio value, buying power, and trading status. Use this to check available funds before trading.',
      input_schema: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'trading_get_portfolio',
      description: 'Get complete portfolio summary including all positions, open orders, total value, unrealized P/L, and daily change. Comprehensive overview of trading account.',
      input_schema: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'trading_get_positions',
      description: 'Get all current positions in the portfolio with details including quantity, average entry price, current price, market value, and unrealized P/L.',
      input_schema: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'trading_get_position',
      description: 'Get details of a specific position by symbol.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Stock ticker symbol (e.g., AAPL, TSLA, NVDA)'
          }
        },
        required: ['symbol']
      }
    },
    {
      name: 'trading_get_portfolio_history',
      description: 'Get historical portfolio value over time. Useful for analyzing performance trends.',
      input_schema: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['1D', '1W', '1M', '3M', '6M', '1A', 'all'],
            description: 'Time period for history'
          },
          timeframe: {
            type: 'string',
            enum: ['1Min', '5Min', '15Min', '1H', '1D'],
            description: 'Data granularity'
          }
        },
        required: []
      }
    },

    // ========== Stock Orders ==========
    {
      name: 'trading_market_buy',
      description: 'Place a market buy order for a stock. Executes immediately at current market price. Use for quick entry when exact price is not critical.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Stock ticker symbol (e.g., AAPL, TSLA)'
          },
          qty: {
            type: 'number',
            description: 'Number of shares to buy'
          }
        },
        required: ['symbol', 'qty']
      }
    },
    {
      name: 'trading_market_sell',
      description: 'Place a market sell order for a stock. Executes immediately at current market price.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Stock ticker symbol'
          },
          qty: {
            type: 'number',
            description: 'Number of shares to sell'
          }
        },
        required: ['symbol', 'qty']
      }
    },
    {
      name: 'trading_limit_buy',
      description: 'Place a limit buy order. Only executes if price reaches your limit or better. Good for entering at a specific price.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Stock ticker symbol'
          },
          qty: {
            type: 'number',
            description: 'Number of shares to buy'
          },
          limitPrice: {
            type: 'number',
            description: 'Maximum price you are willing to pay'
          }
        },
        required: ['symbol', 'qty', 'limitPrice']
      }
    },
    {
      name: 'trading_limit_sell',
      description: 'Place a limit sell order. Only executes if price reaches your limit or better.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Stock ticker symbol'
          },
          qty: {
            type: 'number',
            description: 'Number of shares to sell'
          },
          limitPrice: {
            type: 'number',
            description: 'Minimum price you want to receive'
          }
        },
        required: ['symbol', 'qty', 'limitPrice']
      }
    },
    {
      name: 'trading_stop_loss',
      description: 'Place a stop loss order to limit downside. Triggers a market sell when price falls to stop price.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Stock ticker symbol'
          },
          qty: {
            type: 'number',
            description: 'Number of shares to sell'
          },
          stopPrice: {
            type: 'number',
            description: 'Price at which to trigger the sell order'
          }
        },
        required: ['symbol', 'qty', 'stopPrice']
      }
    },
    {
      name: 'trading_buy_dollars',
      description: 'Buy stock with a specific dollar amount. Supports fractional shares. Great for dollar-cost averaging.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Stock ticker symbol'
          },
          dollars: {
            type: 'number',
            description: 'Dollar amount to invest'
          }
        },
        required: ['symbol', 'dollars']
      }
    },
    {
      name: 'trading_bracket_order',
      description: 'Place a bracket order with entry, take profit, and stop loss. All-in-one risk management.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Stock ticker symbol'
          },
          qty: {
            type: 'number',
            description: 'Number of shares'
          },
          side: {
            type: 'string',
            enum: ['buy', 'sell'],
            description: 'Order side'
          },
          entryPrice: {
            type: 'number',
            description: 'Limit price for entry (omit for market order)'
          },
          takeProfitPrice: {
            type: 'number',
            description: 'Price to take profit'
          },
          stopLossPrice: {
            type: 'number',
            description: 'Price for stop loss'
          }
        },
        required: ['symbol', 'qty', 'side', 'takeProfitPrice', 'stopLossPrice']
      }
    },
    {
      name: 'trading_create_order',
      description: 'Create a custom order with full control over all parameters. For advanced order types.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Stock ticker symbol'
          },
          qty: {
            type: 'number',
            description: 'Number of shares (use qty OR notional, not both)'
          },
          notional: {
            type: 'number',
            description: 'Dollar amount for fractional shares'
          },
          side: {
            type: 'string',
            enum: ['buy', 'sell'],
            description: 'Order side'
          },
          type: {
            type: 'string',
            enum: ['market', 'limit', 'stop', 'stop_limit', 'trailing_stop'],
            description: 'Order type'
          },
          timeInForce: {
            type: 'string',
            enum: ['day', 'gtc', 'opg', 'cls', 'ioc', 'fok'],
            description: 'Time in force (day=day only, gtc=good til canceled)'
          },
          limitPrice: {
            type: 'number',
            description: 'Limit price (for limit/stop_limit orders)'
          },
          stopPrice: {
            type: 'number',
            description: 'Stop price (for stop/stop_limit orders)'
          },
          trailPercent: {
            type: 'number',
            description: 'Trail percent (for trailing_stop orders)'
          },
          extendedHours: {
            type: 'boolean',
            description: 'Allow extended hours trading'
          }
        },
        required: ['symbol', 'side', 'type', 'timeInForce']
      }
    },

    // ========== Order Management ==========
    {
      name: 'trading_get_orders',
      description: 'Get list of orders. Filter by status (open, closed, all).',
      input_schema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['open', 'closed', 'all'],
            description: 'Filter by order status'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of orders to return'
          },
          symbols: {
            type: 'string',
            description: 'Comma-separated list of symbols to filter'
          }
        },
        required: []
      }
    },
    {
      name: 'trading_get_order',
      description: 'Get details of a specific order by ID.',
      input_schema: {
        type: 'object',
        properties: {
          orderId: {
            type: 'string',
            description: 'Order ID'
          }
        },
        required: ['orderId']
      }
    },
    {
      name: 'trading_cancel_order',
      description: 'Cancel a pending order by ID.',
      input_schema: {
        type: 'object',
        properties: {
          orderId: {
            type: 'string',
            description: 'Order ID to cancel'
          }
        },
        required: ['orderId']
      }
    },
    {
      name: 'trading_cancel_all_orders',
      description: 'Cancel all open orders. Use with caution!',
      input_schema: {
        type: 'object',
        properties: {},
        required: []
      }
    },

    // ========== Position Management ==========
    {
      name: 'trading_close_position',
      description: 'Close a position by symbol. Can close full position or partial.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Stock ticker symbol'
          },
          qty: {
            type: 'number',
            description: 'Number of shares to close (omit for full position)'
          },
          percentage: {
            type: 'number',
            description: 'Percentage of position to close (0-100)'
          }
        },
        required: ['symbol']
      }
    },
    {
      name: 'trading_close_all_positions',
      description: 'Close ALL positions and cancel all orders. Emergency liquidation. Use with extreme caution!',
      input_schema: {
        type: 'object',
        properties: {
          confirm: {
            type: 'boolean',
            description: 'Must be true to confirm liquidation'
          }
        },
        required: ['confirm']
      }
    },

    // ========== Options Trading ==========
    {
      name: 'trading_get_option_chain',
      description: 'Get option contracts for an underlying stock. Filter by expiration, strike, and type.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Underlying stock symbol (e.g., AAPL, SPY)'
          },
          expirationDate: {
            type: 'string',
            description: 'Specific expiration date (YYYY-MM-DD)'
          },
          expirationDateGte: {
            type: 'string',
            description: 'Minimum expiration date'
          },
          expirationDateLte: {
            type: 'string',
            description: 'Maximum expiration date'
          },
          type: {
            type: 'string',
            enum: ['call', 'put'],
            description: 'Option type'
          },
          strikePriceGte: {
            type: 'number',
            description: 'Minimum strike price'
          },
          strikePriceLte: {
            type: 'number',
            description: 'Maximum strike price'
          },
          limit: {
            type: 'number',
            description: 'Maximum contracts to return'
          }
        },
        required: ['symbol']
      }
    },
    {
      name: 'trading_get_option_contract',
      description: 'Get details of a specific option contract by symbol or ID.',
      input_schema: {
        type: 'object',
        properties: {
          symbolOrId: {
            type: 'string',
            description: 'Option contract symbol (e.g., AAPL240119C00150000) or contract ID'
          }
        },
        required: ['symbolOrId']
      }
    },
    {
      name: 'trading_buy_option',
      description: 'Buy an option contract (call or put). Opens a long option position.',
      input_schema: {
        type: 'object',
        properties: {
          contractSymbol: {
            type: 'string',
            description: 'Option contract symbol (e.g., AAPL240119C00150000)'
          },
          qty: {
            type: 'number',
            description: 'Number of contracts to buy'
          },
          type: {
            type: 'string',
            enum: ['market', 'limit'],
            description: 'Order type'
          },
          limitPrice: {
            type: 'number',
            description: 'Limit price per contract (required for limit orders)'
          }
        },
        required: ['contractSymbol', 'qty', 'type']
      }
    },
    {
      name: 'trading_sell_option',
      description: 'Sell an option contract. Closes a long option position or opens a short.',
      input_schema: {
        type: 'object',
        properties: {
          contractSymbol: {
            type: 'string',
            description: 'Option contract symbol'
          },
          qty: {
            type: 'number',
            description: 'Number of contracts to sell'
          },
          type: {
            type: 'string',
            enum: ['market', 'limit'],
            description: 'Order type'
          },
          limitPrice: {
            type: 'number',
            description: 'Limit price per contract'
          }
        },
        required: ['contractSymbol', 'qty', 'type']
      }
    },

    // ========== Market Data ==========
    {
      name: 'trading_get_quote',
      description: 'Get current bid/ask quote for a symbol.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Stock ticker symbol'
          }
        },
        required: ['symbol']
      }
    },
    {
      name: 'trading_get_snapshot',
      description: 'Get comprehensive market snapshot including quote, latest trade, and bars.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Stock ticker symbol'
          }
        },
        required: ['symbol']
      }
    },
    {
      name: 'trading_get_bars',
      description: 'Get historical price bars (candlesticks) for a symbol.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Stock ticker symbol'
          },
          timeframe: {
            type: 'string',
            enum: ['1Min', '5Min', '15Min', '1Hour', '1Day', '1Week', '1Month'],
            description: 'Bar timeframe'
          },
          start: {
            type: 'string',
            description: 'Start date (YYYY-MM-DD or ISO timestamp)'
          },
          end: {
            type: 'string',
            description: 'End date'
          },
          limit: {
            type: 'number',
            description: 'Maximum bars to return'
          }
        },
        required: ['symbol', 'timeframe']
      }
    },
    {
      name: 'trading_get_asset',
      description: 'Get asset information including tradability, marginability, and shortability.',
      input_schema: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Stock ticker symbol'
          }
        },
        required: ['symbol']
      }
    },

    // ========== Market Status ==========
    {
      name: 'trading_get_clock',
      description: 'Get market clock - whether market is open and when it opens/closes next.',
      input_schema: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'trading_get_calendar',
      description: 'Get market calendar showing trading days and hours.',
      input_schema: {
        type: 'object',
        properties: {
          start: {
            type: 'string',
            description: 'Start date (YYYY-MM-DD)'
          },
          end: {
            type: 'string',
            description: 'End date'
          }
        },
        required: []
      }
    },

    // ========== Watchlists ==========
    {
      name: 'trading_get_watchlists',
      description: 'Get all watchlists for the account.',
      input_schema: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'trading_create_watchlist',
      description: 'Create a new watchlist with symbols.',
      input_schema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Watchlist name'
          },
          symbols: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of ticker symbols to add'
          }
        },
        required: ['name', 'symbols']
      }
    },
    {
      name: 'trading_add_to_watchlist',
      description: 'Add a symbol to an existing watchlist.',
      input_schema: {
        type: 'object',
        properties: {
          watchlistId: {
            type: 'string',
            description: 'Watchlist ID'
          },
          symbol: {
            type: 'string',
            description: 'Symbol to add'
          }
        },
        required: ['watchlistId', 'symbol']
      }
    },
    {
      name: 'trading_remove_from_watchlist',
      description: 'Remove a symbol from a watchlist.',
      input_schema: {
        type: 'object',
        properties: {
          watchlistId: {
            type: 'string',
            description: 'Watchlist ID'
          },
          symbol: {
            type: 'string',
            description: 'Symbol to remove'
          }
        },
        required: ['watchlistId', 'symbol']
      }
    },

    // ========== Activity & History ==========
    {
      name: 'trading_get_activities',
      description: 'Get account activities (trades, dividends, etc.).',
      input_schema: {
        type: 'object',
        properties: {
          activityTypes: {
            type: 'string',
            description: 'Comma-separated activity types (FILL, DIV, etc.)'
          },
          date: {
            type: 'string',
            description: 'Filter to specific date (YYYY-MM-DD)'
          },
          until: {
            type: 'string',
            description: 'Activities before this date'
          },
          after: {
            type: 'string',
            description: 'Activities after this date'
          },
          pageSize: {
            type: 'number',
            description: 'Number of activities to return'
          }
        },
        required: []
      }
    }
  ];
}

// ============================================================================
// Trading Tool Executor
// ============================================================================

export class TradingToolExecutor {
  private alpaca: AlpacaTradingService | null = null;

  constructor() {
    // Try to initialize from environment variables
    const apiKey = process.env.ALPACA_API_KEY;
    const secretKey = process.env.ALPACA_SECRET_KEY;
    const paper = process.env.ALPACA_PAPER !== 'false'; // Default to paper

    if (apiKey && secretKey) {
      this.alpaca = initializeAlpacaService({ apiKey, secretKey, paper });
      logger.info(`🦙 TradingToolExecutor initialized (${paper ? 'PAPER' : 'LIVE'} mode)`);
    } else {
      logger.warn('⚠️ TradingToolExecutor: ALPACA_API_KEY and ALPACA_SECRET_KEY not set');
    }
  }

  private ensureAlpaca(): AlpacaTradingService {
    if (!this.alpaca) {
      throw new Error('Alpaca trading service not configured. Set ALPACA_API_KEY and ALPACA_SECRET_KEY environment variables.');
    }
    return this.alpaca;
  }

  async execute(toolName: string, input: any): Promise<any> {
    const alpaca = this.ensureAlpaca();

    try {
      switch (toolName) {
        // ========== Account & Portfolio ==========
        case 'trading_get_account':
          return await alpaca.getAccount();

        case 'trading_get_portfolio':
          return await alpaca.getPortfolioSummary();

        case 'trading_get_positions':
          return await alpaca.getPositions();

        case 'trading_get_position':
          return await alpaca.getPosition(input.symbol);

        case 'trading_get_portfolio_history':
          return await alpaca.getPortfolioHistory({
            period: input.period,
            timeframe: input.timeframe
          });

        // ========== Stock Orders ==========
        case 'trading_market_buy':
          return await alpaca.marketBuy(input.symbol, input.qty);

        case 'trading_market_sell':
          return await alpaca.marketSell(input.symbol, input.qty);

        case 'trading_limit_buy':
          return await alpaca.limitBuy(input.symbol, input.qty, input.limitPrice);

        case 'trading_limit_sell':
          return await alpaca.limitSell(input.symbol, input.qty, input.limitPrice);

        case 'trading_stop_loss':
          return await alpaca.stopLoss(input.symbol, input.qty, input.stopPrice);

        case 'trading_buy_dollars':
          return await alpaca.buyDollarAmount(input.symbol, input.dollars);

        case 'trading_bracket_order':
          return await alpaca.bracketOrder(input.symbol, input.qty, {
            side: input.side,
            entryPrice: input.entryPrice,
            takeProfitPrice: input.takeProfitPrice,
            stopLossPrice: input.stopLossPrice
          });

        case 'trading_create_order':
          return await alpaca.createOrder({
            symbol: input.symbol,
            qty: input.qty,
            notional: input.notional,
            side: input.side,
            type: input.type,
            timeInForce: input.timeInForce,
            limitPrice: input.limitPrice,
            stopPrice: input.stopPrice,
            trailPercent: input.trailPercent,
            extendedHours: input.extendedHours
          });

        // ========== Order Management ==========
        case 'trading_get_orders':
          return await alpaca.getOrders({
            status: input.status,
            limit: input.limit,
            symbols: input.symbols
          });

        case 'trading_get_order':
          return await alpaca.getOrder(input.orderId);

        case 'trading_cancel_order':
          await alpaca.cancelOrder(input.orderId);
          return { success: true, message: `Order ${input.orderId} canceled` };

        case 'trading_cancel_all_orders':
          await alpaca.cancelAllOrders();
          return { success: true, message: 'All orders canceled' };

        // ========== Position Management ==========
        case 'trading_close_position':
          return await alpaca.closePosition(input.symbol, {
            qty: input.qty,
            percentage: input.percentage
          });

        case 'trading_close_all_positions':
          if (!input.confirm) {
            return { success: false, error: 'Must set confirm=true to close all positions' };
          }
          return await alpaca.closeAllPositions(true);

        // ========== Options Trading ==========
        case 'trading_get_option_chain':
          return await alpaca.getOptionContracts({
            underlyingSymbol: input.symbol,
            expirationDate: input.expirationDate,
            expirationDateGte: input.expirationDateGte,
            expirationDateLte: input.expirationDateLte,
            type: input.type,
            strikePriceGte: input.strikePriceGte,
            strikePriceLte: input.strikePriceLte,
            limit: input.limit
          });

        case 'trading_get_option_contract':
          return await alpaca.getOptionContract(input.symbolOrId);

        case 'trading_buy_option':
          return await alpaca.createOptionOrder({
            symbol: input.contractSymbol,
            qty: input.qty,
            side: 'buy',
            type: input.type,
            timeInForce: 'day',
            limitPrice: input.limitPrice
          });

        case 'trading_sell_option':
          return await alpaca.createOptionOrder({
            symbol: input.contractSymbol,
            qty: input.qty,
            side: 'sell',
            type: input.type,
            timeInForce: 'day',
            limitPrice: input.limitPrice
          });

        // ========== Market Data ==========
        case 'trading_get_quote':
          return await alpaca.getLatestQuote(input.symbol);

        case 'trading_get_snapshot':
          return await alpaca.getSnapshot(input.symbol);

        case 'trading_get_bars':
          return await alpaca.getBars(input.symbol, {
            timeframe: input.timeframe,
            start: input.start,
            end: input.end,
            limit: input.limit
          });

        case 'trading_get_asset':
          return await alpaca.getAsset(input.symbol);

        // ========== Market Status ==========
        case 'trading_get_clock':
          return await alpaca.getClock();

        case 'trading_get_calendar':
          return await alpaca.getCalendar({
            start: input.start,
            end: input.end
          });

        // ========== Watchlists ==========
        case 'trading_get_watchlists':
          return await alpaca.getWatchlists();

        case 'trading_create_watchlist':
          return await alpaca.createWatchlist(input.name, input.symbols);

        case 'trading_add_to_watchlist':
          return await alpaca.addToWatchlist(input.watchlistId, input.symbol);

        case 'trading_remove_from_watchlist':
          return await alpaca.removeFromWatchlist(input.watchlistId, input.symbol);

        // ========== Activity & History ==========
        case 'trading_get_activities':
          return await alpaca.getActivities({
            activityTypes: input.activityTypes,
            date: input.date,
            until: input.until,
            after: input.after,
            pageSize: input.pageSize
          });

        default:
          throw new Error(`Unknown trading tool: ${toolName}`);
      }
    } catch (error: any) {
      logger.error(`Trading tool error (${toolName}):`, error);
      return {
        success: false,
        error: error.message || 'Unknown trading error',
        details: error.response?.data || error.stack
      };
    }
  }

  /**
   * Check if a tool name is a trading tool
   */
  static isTradingTool(toolName: string): boolean {
    return toolName.startsWith('trading_');
  }
}

// Singleton instance
let tradingToolExecutorInstance: TradingToolExecutor | null = null;

export function getTradingToolExecutor(): TradingToolExecutor {
  if (!tradingToolExecutorInstance) {
    tradingToolExecutorInstance = new TradingToolExecutor();
  }
  return tradingToolExecutorInstance;
}

export default TradingToolExecutor;
