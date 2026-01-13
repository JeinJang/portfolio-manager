/**
 * useMovingAverages Hook
 *
 * React hook for fetching and managing moving average data.
 * Provides MA50/MA200 data with automatic caching and refresh.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  fetchAllMovingAverages,
  type MovingAverageData,
} from '../services/historicalData';
import type { PriceData } from '../types';

// ============================================
// Constants
// ============================================

const DEFAULT_REFRESH_INTERVAL = 300000; // 5 minutes
const INITIAL_FETCH_DELAY = 2000; // 2 seconds delay on initial load

// ============================================
// Hook Types
// ============================================

export interface UseMovingAveragesOptions {
  refreshInterval?: number;
  enableAutoRefresh?: boolean;
  delayInitialFetch?: boolean;
}

export interface UseMovingAveragesReturn {
  data: Record<string, MovingAverageData>;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => Promise<void>;
  getMAData: (symbol: string) => MovingAverageData | null;
}

// ============================================
// Main Hook
// ============================================

/**
 * Hook for fetching and managing moving average data
 */
export const useMovingAverages = (
  symbols: string[],
  prices: Record<string, PriceData>,
  options: UseMovingAveragesOptions = {}
): UseMovingAveragesReturn => {
  const {
    refreshInterval = DEFAULT_REFRESH_INTERVAL,
    enableAutoRefresh = true,
    delayInitialFetch = true,
  } = options;

  const [data, setData] = useState<Record<string, MovingAverageData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isFetchingRef = useRef(false);
  const initialFetchDone = useRef(false);

  // Extract current prices for MA calculation
  const currentPrices = useMemo(() => {
    const result: Record<string, number> = {};
    Object.entries(prices).forEach(([symbol, priceData]) => {
      if (priceData?.price) {
        result[symbol] = priceData.price;
      }
    });
    return result;
  }, [prices]);

  // Fetch MA data for all symbols
  const fetchData = useCallback(async () => {
    if (isFetchingRef.current || symbols.length === 0) return;

    isFetchingRef.current = true;

    try {
      setLoading(true);
      const results = await fetchAllMovingAverages(symbols, currentPrices);

      if (Object.keys(results).length > 0) {
        setData(results);
        setLastUpdated(new Date());
        setError(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'MA 데이터 로드 실패';
      setError(errorMessage);
      console.error('Moving Averages Error:', err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [symbols, currentPrices]);

  // Initial fetch with optional delay
  useEffect(() => {
    if (initialFetchDone.current) return;

    const doInitialFetch = async () => {
      if (delayInitialFetch) {
        // Delay initial fetch to let other data load first
        await new Promise((resolve) => setTimeout(resolve, INITIAL_FETCH_DELAY));
      }
      await fetchData();
      initialFetchDone.current = true;
    };

    doInitialFetch();
  }, [fetchData, delayInitialFetch]);

  // Auto-refresh
  useEffect(() => {
    if (!enableAutoRefresh || !initialFetchDone.current) return;

    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval, enableAutoRefresh]);

  // Helper to get individual symbol data
  const getMAData = useCallback(
    (symbol: string): MovingAverageData | null => {
      return data[symbol] || null;
    },
    [data]
  );

  return {
    data,
    loading,
    error,
    lastUpdated,
    refetch: fetchData,
    getMAData,
  };
};

// ============================================
// Utility Hooks
// ============================================

/**
 * Hook to get MA data for a single symbol
 */
export const useSingleMA = (
  symbol: string,
  allData: Record<string, MovingAverageData>
): MovingAverageData | null => {
  return useMemo(() => allData[symbol] || null, [allData, symbol]);
};

/**
 * Hook to get portfolio-level MA summary
 */
export const usePortfolioMASummary = (
  data: Record<string, MovingAverageData>
): {
  avgPriceVsMa50: number;
  avgPriceVsMa200: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  overallTrend: 'bullish' | 'bearish' | 'neutral';
} => {
  return useMemo(() => {
    const entries = Object.values(data);
    if (entries.length === 0) {
      return {
        avgPriceVsMa50: 0,
        avgPriceVsMa200: 0,
        bullishCount: 0,
        bearishCount: 0,
        neutralCount: 0,
        overallTrend: 'neutral' as const,
      };
    }

    let totalMa50Dev = 0;
    let totalMa200Dev = 0;
    let bullish = 0;
    let bearish = 0;
    let neutral = 0;

    entries.forEach((entry) => {
      totalMa50Dev += entry.priceVsMa50;
      totalMa200Dev += entry.priceVsMa200;

      if (entry.trend === 'bullish') bullish++;
      else if (entry.trend === 'bearish') bearish++;
      else neutral++;
    });

    const count = entries.length;
    const avgMa50Dev = totalMa50Dev / count;
    const avgMa200Dev = totalMa200Dev / count;

    // Determine overall trend
    let overallTrend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (bullish > bearish && bullish > neutral) {
      overallTrend = 'bullish';
    } else if (bearish > bullish && bearish > neutral) {
      overallTrend = 'bearish';
    }

    return {
      avgPriceVsMa50: avgMa50Dev,
      avgPriceVsMa200: avgMa200Dev,
      bullishCount: bullish,
      bearishCount: bearish,
      neutralCount: neutral,
      overallTrend,
    };
  }, [data]);
};

// ============================================
// Export Types
// ============================================

export type { MovingAverageData } from '../services/historicalData';
