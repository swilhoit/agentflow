/**
 * Portfolio Categories and Curated Watchlists
 *
 * Defines organized symbol lists for different investment themes and markets
 */

export type PortfolioCategory = 'ai-infrastructure' | 'main-indices' | 'uranium-energy' | 'all';

export interface Portfolio {
  id: PortfolioCategory;
  name: string;
  description: string;
  symbols: string[];
}

/**
 * Main Market Indices and Macro Assets
 */
export const MAIN_INDICES: Portfolio = {
  id: 'main-indices',
  name: 'Main Market Indices',
  description: 'Broad market indices and macro assets',
  symbols: [
    'SPY',      // S&P 500
    'QQQ',      // Nasdaq 100
    'DIA',      // Dow Jones
    'IWM',      // Russell 2000
    'GLD',      // Gold
    'BTC-USD',  // Bitcoin
    'ETH-USD',  // Ethereum
    'DXY',      // US Dollar Index
    'TLT',      // 20+ Year Treasury Bonds
    'VIX',      // Volatility Index
  ]
};

/**
 * AI Infrastructure and Computing
 */
export const AI_INFRASTRUCTURE: Portfolio = {
  id: 'ai-infrastructure',
  name: 'AI Infrastructure',
  description: 'AI infrastructure, data centers, and enabling technologies',
  symbols: [
    'NVDA',     // NVIDIA - AI chips
    'AMD',      // AMD - AI chips
    'MSFT',     // Microsoft - Azure AI
    'GOOGL',    // Google - AI/Cloud
    'META',     // Meta - AI research
    'AMZN',     // Amazon - AWS AI
    'ORCL',     // Oracle - Cloud/AI
    'PLTR',     // Palantir - AI software
    'SNOW',     // Snowflake - Data cloud
    'DDOG',     // Datadog - Monitoring
    'NET',      // Cloudflare - Edge computing
    'EQIX',     // Equinix - Data centers
    'DLR',      // Digital Realty - Data centers
    'PWR',      // Quanta Services - Infrastructure
    'SMCI',     // Super Micro Computer - AI servers
    'ARM',      // ARM Holdings - Chip design
    'AVGO',     // Broadcom - Networking/chips
    'MU',       // Micron - Memory chips
    'TSM',      // TSMC - Chip manufacturing
  ]
};

/**
 * Uranium and Nuclear Energy (Existing Portfolio)
 */
export const URANIUM_ENERGY: Portfolio = {
  id: 'uranium-energy',
  name: 'Uranium & Nuclear Energy',
  description: 'Uranium mining, nuclear power, and SMR companies',
  symbols: [
    'URA',      // Global X Uranium ETF
    'URNM',     // North Shore Uranium ETF
    'NLR',      // Nuclear Energy ETF
    'CCJ',      // Cameco
    'UUUU',     // Energy Fuels
    'UEC',      // Uranium Energy Corp
    'LEU',      // Centrus Energy
    'SMR',      // NuScale Power (SMR)
    'OKLO',     // Oklo (SMR)
    'FCX',      // Freeport-McMoRan
    'PDN.AX',   // Paladin Energy (ASX)
    'DLR',      // Digital Realty (data centers)
    'EQIX',     // Equinix (data centers)
    'WMB',      // Williams Companies
    'ET',       // Energy Transfer
    'TLN',      // Talen Energy
    'PWR',      // Quanta Services
    'U-UN.TO',  // Uranium Participation Corp
    'CGG.TO',   // Cameco (TSX)
    'KAP.L',    // Kazatomprom (LSE)
    'SRUUF',    // Sprott Uranium Trust
    '1816.HK',  // China General Nuclear
    'NNE',      // Nano Nuclear Energy
    'LTBR',     // Lightbridge Corp
    'MYRG',     // MYR Group
    'ASPI',     // ASP Isotopes
  ]
};

/**
 * All defined portfolios
 */
export const PORTFOLIOS: Portfolio[] = [
  MAIN_INDICES,
  AI_INFRASTRUCTURE,
  URANIUM_ENERGY,
];

/**
 * Get portfolio by ID
 */
export function getPortfolio(id: PortfolioCategory): Portfolio | undefined {
  return PORTFOLIOS.find(p => p.id === id);
}

/**
 * Get all symbols across all portfolios
 */
export function getAllSymbols(): string[] {
  const allSymbols = new Set<string>();
  PORTFOLIOS.forEach(portfolio => {
    portfolio.symbols.forEach(symbol => allSymbols.add(symbol));
  });
  return Array.from(allSymbols).sort();
}

/**
 * Find which portfolio(s) a symbol belongs to
 */
export function getSymbolPortfolios(symbol: string): Portfolio[] {
  return PORTFOLIOS.filter(portfolio =>
    portfolio.symbols.includes(symbol)
  );
}
