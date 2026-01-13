/**
 * Historical Data Service
 *
 * Fetches historical OHLCV data and calculates moving averages.
 * Uses Binance for major pairs and CoinGecko for broader altcoin coverage.
 */

import axios from 'axios';
import { SYMBOL_TO_GECKO_ID } from './api';

// ============================================
// Constants
// ============================================

const BINANCE_API = 'https://api.binance.com/api/v3';
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Binance symbol mapping (most have USDT pairs)
const SYMBOL_TO_BINANCE: Record<string, string> = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  XRP: 'XRPUSDT',
  SOL: 'SOLUSDT',
  DOGE: 'DOGEUSDT',
  ADA: 'ADAUSDT',
  AVAX: 'AVAXUSDT',
  DOT: 'DOTUSDT',
  MATIC: 'MATICUSDT',
  LINK: 'LINKUSDT',
  ATOM: 'ATOMUSDT',
  UNI: 'UNIUSDT',
  AAVE: 'AAVEUSDT',
};

// Cache key prefix
const CACHE_PREFIX = 'ma_cache_';
const CACHE_EXPIRY = 6 * 60 * 60 * 1000; // 6 hours

// ============================================
// Types
// ============================================

export interface HistoricalCandle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MovingAverageData {
  symbol: string;
  ma50: number;
  ma200: number;
  currentPrice: number;
  priceVsMa50: number;    // % deviation from MA50
  priceVsMa200: number;   // % deviation from MA200
  trend: 'bullish' | 'bearish' | 'neutral';
  dataSource: 'binance' | 'coingecko' | 'cache';
  lastUpdated: Date;
}

interface CacheEntry {
  symbol: string;
  ma50: number;
  ma200: number;
  lastClose: number;
  historicalCloses: number[];  // Last 200 daily closes
  fetchedAt: number;
  lastCandleDate: string;      // "2026-01-13"
}

// ============================================
// Cache Management
// ============================================

const getCache = (symbol: string): CacheEntry | null => {
  try {
    const cached = localStorage.getItem(`${CACHE_PREFIX}${symbol}`);
    if (!cached) return null;

    const entry: CacheEntry = JSON.parse(cached);

    // Check if cache is still valid (6 hours)
    if (Date.now() - entry.fetchedAt > CACHE_EXPIRY) {
      return null;
    }

    return entry;
  } catch {
    return null;
  }
};

const setCache = (symbol: string, data: Omit<CacheEntry, 'fetchedAt'>): void => {
  try {
    const entry: CacheEntry = {
      ...data,
      fetchedAt: Date.now(),
    };
    localStorage.setItem(`${CACHE_PREFIX}${symbol}`, JSON.stringify(entry));
  } catch (error) {
    console.warn('Failed to cache MA data:', error);
  }
};

// ============================================
// MA Calculation
// ============================================

/**
 * Calculate Simple Moving Average from an array of prices
 */
export const calculateSMA = (prices: number[], period: number): number => {
  if (prices.length < period) {
    // Not enough data, return average of available data
    return prices.reduce((sum, p) => sum + p, 0) / prices.length;
  }

  const relevantPrices = prices.slice(-period);
  return relevantPrices.reduce((sum, p) => sum + p, 0) / period;
};

/**
 * Calculate both MA50 and MA200 from historical prices
 */
export const calculateMAs = (
  closes: number[]
): { ma50: number; ma200: number } => {
  return {
    ma50: calculateSMA(closes, 50),
    ma200: calculateSMA(closes, 200),
  };
};

// ============================================
// Binance API
// ============================================

/**
 * Fetch historical klines (candlesticks) from Binance
 * Returns daily candles for the specified limit
 */
export const fetchBinanceKlines = async (
  symbol: string,
  limit: number = 200
): Promise<HistoricalCandle[] | null> => {
  const binanceSymbol = SYMBOL_TO_BINANCE[symbol];
  if (!binanceSymbol) {
    console.warn(`No Binance mapping for ${symbol}`);
    return null;
  }

  try {
    const response = await axios.get(`${BINANCE_API}/klines`, {
      params: {
        symbol: binanceSymbol,
        interval: '1d',
        limit,
      },
    });

    // Binance returns: [openTime, open, high, low, close, volume, closeTime, ...]
    return response.data.map((candle: (string | number)[]) => ({
      openTime: candle[0] as number,
      open: parseFloat(candle[1] as string),
      high: parseFloat(candle[2] as string),
      low: parseFloat(candle[3] as string),
      close: parseFloat(candle[4] as string),
      volume: parseFloat(candle[5] as string),
    }));
  } catch (error) {
    console.error(`Binance Klines Error (${symbol}):`, error);
    return null;
  }
};

// ============================================
// CoinGecko API
// ============================================

/**
 * Fetch historical market chart from CoinGecko
 * Returns daily prices for the specified number of days
 */
export const fetchCoinGeckoHistory = async (
  symbol: string,
  days: number = 200
): Promise<number[] | null> => {
  const geckoId = SYMBOL_TO_GECKO_ID[symbol];
  if (!geckoId) {
    console.warn(`No CoinGecko mapping for ${symbol}`);
    return null;
  }

  try {
    const response = await axios.get(
      `${COINGECKO_API}/coins/${geckoId}/market_chart`,
      {
        params: {
          vs_currency: 'usd',
          days,
          interval: 'daily',
        },
      }
    );

    // Returns { prices: [[timestamp, price], ...] }
    return response.data.prices.map((p: [number, number]) => p[1]);
  } catch (error) {
    console.error(`CoinGecko History Error (${symbol}):`, error);
    return null;
  }
};

// ============================================
// Main Fetch Functions
// ============================================

/**
 * Fetch MA data for a single symbol
 * Tries Binance first, falls back to CoinGecko
 */
export const fetchMovingAverages = async (
  symbol: string,
  currentPrice?: number
): Promise<MovingAverageData | null> => {
  // Check cache first
  const cached = getCache(symbol);
  if (cached && currentPrice) {
    const { ma50, ma200 } = cached;
    return {
      symbol,
      ma50,
      ma200,
      currentPrice,
      priceVsMa50: ma50 > 0 ? ((currentPrice - ma50) / ma50) * 100 : 0,
      priceVsMa200: ma200 > 0 ? ((currentPrice - ma200) / ma200) * 100 : 0,
      trend: determineTrend(currentPrice, ma50, ma200),
      dataSource: 'cache',
      lastUpdated: new Date(cached.fetchedAt),
    };
  }

  // Try Binance first (better rate limits, more reliable)
  let closes: number[] | null = null;
  let dataSource: 'binance' | 'coingecko' = 'binance';

  const binanceData = await fetchBinanceKlines(symbol);
  if (binanceData && binanceData.length > 0) {
    closes = binanceData.map((c) => c.close);
  } else {
    // Fallback to CoinGecko
    dataSource = 'coingecko';
    closes = await fetchCoinGeckoHistory(symbol);
  }

  if (!closes || closes.length === 0) {
    console.warn(`No historical data available for ${symbol}`);
    return null;
  }

  // Calculate MAs
  const { ma50, ma200 } = calculateMAs(closes);
  const latestPrice = currentPrice || closes[closes.length - 1];

  // Cache the result
  const today = new Date().toISOString().split('T')[0];
  setCache(symbol, {
    symbol,
    ma50,
    ma200,
    lastClose: closes[closes.length - 1],
    historicalCloses: closes.slice(-200),
    lastCandleDate: today,
  });

  return {
    symbol,
    ma50,
    ma200,
    currentPrice: latestPrice,
    priceVsMa50: ma50 > 0 ? ((latestPrice - ma50) / ma50) * 100 : 0,
    priceVsMa200: ma200 > 0 ? ((latestPrice - ma200) / ma200) * 100 : 0,
    trend: determineTrend(latestPrice, ma50, ma200),
    dataSource,
    lastUpdated: new Date(),
  };
};

/**
 * Determine trend based on price vs MAs
 */
const determineTrend = (
  price: number,
  ma50: number,
  ma200: number
): 'bullish' | 'bearish' | 'neutral' => {
  if (ma50 === 0 || ma200 === 0) return 'neutral';

  const aboveMa50 = price > ma50;
  const aboveMa200 = price > ma200;
  const ma50AboveMa200 = ma50 > ma200; // Golden cross condition

  if (aboveMa50 && aboveMa200 && ma50AboveMa200) {
    return 'bullish';
  } else if (!aboveMa50 && !aboveMa200 && !ma50AboveMa200) {
    return 'bearish';
  }
  return 'neutral';
};

/**
 * Batch fetch MA data for multiple symbols
 * Respects rate limits with batching and delays
 */
export const fetchAllMovingAverages = async (
  symbols: string[],
  currentPrices: Record<string, number> = {}
): Promise<Record<string, MovingAverageData>> => {
  const results: Record<string, MovingAverageData> = {};
  const BATCH_SIZE = 5;
  const BATCH_DELAY = 1500; // 1.5 seconds between batches

  // Prioritize BTC first (needed for other calculations)
  const prioritized = ['BTC', ...symbols.filter((s) => s !== 'BTC')];
  const uniqueSymbols = [...new Set(prioritized)];

  for (let i = 0; i < uniqueSymbols.length; i += BATCH_SIZE) {
    const batch = uniqueSymbols.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map((symbol) =>
        fetchMovingAverages(symbol, currentPrices[symbol])
      )
    );

    batch.forEach((symbol, idx) => {
      const result = batchResults[idx];
      if (result) {
        results[symbol] = result;
      }
    });

    // Delay between batches (except for last batch)
    if (i + BATCH_SIZE < uniqueSymbols.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
    }
  }

  return results;
};

// ============================================
// Utility Functions
// ============================================

/**
 * Clear all MA cache entries
 */
export const clearMACache = (): void => {
  const keys = Object.keys(localStorage).filter((k) =>
    k.startsWith(CACHE_PREFIX)
  );
  keys.forEach((k) => localStorage.removeItem(k));
};

/**
 * Get cache status for debugging
 */
export const getMACacheStatus = (): Record<
  string,
  { cached: boolean; age: number | null }
> => {
  const status: Record<string, { cached: boolean; age: number | null }> = {};
  const keys = Object.keys(localStorage).filter((k) =>
    k.startsWith(CACHE_PREFIX)
  );

  keys.forEach((k) => {
    const symbol = k.replace(CACHE_PREFIX, '');
    const cached = getCache(symbol);
    status[symbol] = {
      cached: !!cached,
      age: cached ? Date.now() - cached.fetchedAt : null,
    };
  });

  return status;
};
