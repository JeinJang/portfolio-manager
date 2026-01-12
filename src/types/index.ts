// ============================================
// Asset & Portfolio Types
// ============================================

export type AssetType = 'crypto' | 'stock_kr' | 'stock_us';
export type ExchangeType = 'upbit' | 'bithumb' | 'binance' | 'coinbase' | 'stock_kr' | 'stock_us';
export type CurrencyType = 'KRW' | 'USD' | 'USDT';

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  exchange: ExchangeType;
  amount: number;
  avgPrice: number;
  currentPrice?: number;
  change24h?: number;
  value?: number;
  allocation?: number;
  pnl?: number;
  pnlValue?: number;
}

export interface CashHolding {
  id: string;
  currency: CurrencyType;
  name: string;
  amount: number;
  icon: string;
  exchange?: ExchangeType;
}

export interface Portfolio {
  assets: Asset[];
  cash: CashHolding[];
  totalValue: number;
  totalCash: number;
  totalCrypto: number;
  cashAllocation: number;
  totalPnl: number;
}

// ============================================
// Market Data Types
// ============================================

export interface PriceData {
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  timestamp?: number;
}

export interface FearGreedData {
  value: number;
  classification: 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed';
  timestamp: string;
}

export interface OnchainData {
  // BTC Onchain
  hashRate: number;
  difficulty: number;
  txCount24h: number;
  activeAddresses: number;

  // MVRV & Valuation
  mvrv: number;
  nvt: number;
  realizedPrice: number;

  // Exchange Flow
  exchangeNetflow: number;
  exchangeReserve: number;

  // Supply
  circulatingSupply: number;
  totalSupply: number;
}

export interface MacroData {
  // Fear & Greed
  fearGreed: FearGreedData;

  // Exchange Rates
  usdKrw: number;
  dxy: number;

  // Traditional Markets
  sp500: number;
  nasdaq: number;
  vix: number;

  // Crypto Market
  btcDominance: number;
  totalMarketCap: number;
  altseasonIndex: number;
}

export interface KimchiPremium {
  symbol: string;
  krwPrice: number;
  usdPrice: number;
  premium: number;
}

export interface MarketData {
  prices: Record<string, PriceData>;
  globalPrices: Record<string, { usd: number; usd_24h_change: number }>;
  fearGreed: FearGreedData;
  exchangeRate: number;
  onchain: OnchainData | null;
  macro: MacroData | null;
  kimchiPremiums: Record<string, number>;
  avgKimchiPremium: number;
  lastUpdated: Date;
}

// ============================================
// Analysis & Recommendation Types
// ============================================

export type RiskLevel = 'AGGRESSIVE' | 'GROWTH' | 'BALANCED' | 'CAUTIOUS' | 'DEFENSIVE' | 'PRESERVATION';
export type ActionType = 'REDUCE_CASH' | 'NEUTRAL' | 'INCREASE_CASH' | 'MAX_CASH';
export type TradeAction = 'BUY' | 'SELL' | 'HOLD';

export interface IndicatorAnalysis {
  score: number;
  action: ActionType;
  reason: string;
  value?: number;
}

export interface CashRecommendation {
  score: number;
  recommendedCash: number;
  riskLevel: RiskLevel;
  strategy: string;
  analyses: Record<string, IndicatorAnalysis>;
  breakdown: {
    indicator: string;
    score: number;
    weight: number;
    contribution: number;
    action: ActionType;
    reason: string;
  }[];
}

export interface RebalanceAction {
  asset: Asset;
  currentAllocation: number;
  targetAllocation: number;
  difference: number;
  action: TradeAction;
  amount: number;
  value: number;
}

// ============================================
// Exchange API Types
// ============================================

export interface ExchangeBalance {
  currency: string;
  balance: number;
  locked: number;
  avgBuyPrice: number;
}

export interface ExchangeOrder {
  uuid: string;
  side: 'bid' | 'ask';
  ordType: 'limit' | 'market';
  price: number;
  volume: number;
  remainingVolume: number;
  state: 'wait' | 'done' | 'cancel';
  market: string;
  createdAt: string;
}

export interface TradeResult {
  success: boolean;
  order?: ExchangeOrder;
  error?: string;
}

// ============================================
// UI Types
// ============================================

export type TabType = 'overview' | 'macro' | 'onchain' | 'rebalance' | 'settings';

export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
}

export interface ExchangeInfo {
  name: string;
  nameKo: string;
  color: string;
  fees: { maker: number; taker: number };
  url: string | null;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface UpbitTickerResponse {
  market: string;
  trade_price: number;
  signed_change_rate: number;
  acc_trade_price_24h: number;
  high_price: number;
  low_price: number;
}

export interface BithumbTickerResponse {
  status: string;
  data: {
    closing_price: string;
    fluctate_rate_24H: string;
    acc_trade_value_24H: string;
    max_price: string;
    min_price: string;
  };
}
