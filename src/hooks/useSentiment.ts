/**
 * useSentiment Hook
 *
 * React hook for fetching and managing cryptocurrency sentiment data.
 * Uses LunarCrush as primary source with fallback estimation.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  fetchAllSentiment,
  toValuationSentiment,
  type SentimentResult,
} from '../services/sentimentApi';
import type { PriceData, OnchainData } from '../types';

// ============================================
// Constants
// ============================================

const DEFAULT_REFRESH_INTERVAL = 900000; // 15 minutes
const INITIAL_FETCH_DELAY = 5000; // 5 seconds delay on initial load

// ============================================
// Hook Types
// ============================================

export interface UseSentimentOptions {
  refreshInterval?: number;
  enableAutoRefresh?: boolean;
  delayInitialFetch?: boolean;
}

export interface UseSentimentReturn {
  data: Record<string, SentimentResult>;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => Promise<void>;
  getSentiment: (symbol: string) => SentimentResult | null;
  getValuationSentiment: (symbol: string) => ReturnType<typeof toValuationSentiment> | null;
}

// ============================================
// Main Hook
// ============================================

/**
 * Hook for fetching and managing sentiment data
 */
export const useSentiment = (
  symbols: string[],
  prices: Record<string, PriceData>,
  onchainData: OnchainData | null,
  fearGreed: number | undefined,
  options: UseSentimentOptions = {}
): UseSentimentReturn => {
  const {
    refreshInterval = DEFAULT_REFRESH_INTERVAL,
    enableAutoRefresh = true,
    delayInitialFetch = true,
  } = options;

  const [data, setData] = useState<Record<string, SentimentResult>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isFetchingRef = useRef(false);
  const initialFetchDone = useRef(false);

  // Build fallback inputs from available data
  const fallbackInputs = useMemo(() => {
    const inputs: Record<string, { fearGreed?: number; exchangeNetflow?: number; priceChange24h?: number }> = {};

    symbols.forEach((symbol) => {
      inputs[symbol] = {
        fearGreed,
        exchangeNetflow: onchainData?.exchangeNetflow,
        priceChange24h: prices[symbol]?.change24h,
      };
    });

    return inputs;
  }, [symbols, fearGreed, onchainData, prices]);

  // Fetch sentiment data for all symbols
  const fetchData = useCallback(async () => {
    if (isFetchingRef.current || symbols.length === 0) return;

    isFetchingRef.current = true;

    try {
      setLoading(true);
      const results = await fetchAllSentiment(symbols, fallbackInputs);

      if (Object.keys(results).length > 0) {
        setData(results);
        setLastUpdated(new Date());
        setError(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '센티먼트 데이터 로드 실패';
      setError(errorMessage);
      console.error('Sentiment Error:', err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [symbols, fallbackInputs]);

  // Initial fetch with delay
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
  const getSentiment = useCallback(
    (symbol: string): SentimentResult | null => {
      return data[symbol] || null;
    },
    [data]
  );

  // Helper to get sentiment in valuation format
  const getValuationSentiment = useCallback(
    (symbol: string): ReturnType<typeof toValuationSentiment> | null => {
      const result = data[symbol];
      if (!result) return null;
      return toValuationSentiment(result);
    },
    [data]
  );

  return {
    data,
    loading,
    error,
    lastUpdated,
    refetch: fetchData,
    getSentiment,
    getValuationSentiment,
  };
};

// ============================================
// Utility Hooks
// ============================================

/**
 * Hook to get sentiment for a single symbol
 */
export const useSingleSentiment = (
  symbol: string,
  allData: Record<string, SentimentResult>
): SentimentResult | null => {
  return useMemo(() => allData[symbol] || null, [allData, symbol]);
};

/**
 * Hook to get portfolio-level sentiment summary
 */
export const usePortfolioSentimentSummary = (
  data: Record<string, SentimentResult>
): {
  avgCompositeScore: number;
  avgSocialSentiment: number;
  dominantSentiment: 'fear' | 'neutral' | 'greed';
  dataSourceBreakdown: Record<string, number>;
  avgConfidence: number;
} => {
  return useMemo(() => {
    const entries = Object.values(data);
    if (entries.length === 0) {
      return {
        avgCompositeScore: 50,
        avgSocialSentiment: 0,
        dominantSentiment: 'neutral' as const,
        dataSourceBreakdown: {},
        avgConfidence: 0,
      };
    }

    let totalComposite = 0;
    let totalSentiment = 0;
    let totalConfidence = 0;
    const sourceCount: Record<string, number> = {};

    entries.forEach((entry) => {
      totalComposite += entry.compositeScore;
      totalSentiment += entry.social.sentiment;
      totalConfidence += entry.confidence.dataCompleteness;
      sourceCount[entry.dataSource] = (sourceCount[entry.dataSource] || 0) + 1;
    });

    const count = entries.length;
    const avgComposite = totalComposite / count;
    const avgSentiment = totalSentiment / count;

    // Determine dominant sentiment
    let dominantSentiment: 'fear' | 'neutral' | 'greed' = 'neutral';
    if (avgComposite < 40) {
      dominantSentiment = 'fear';
    } else if (avgComposite > 60) {
      dominantSentiment = 'greed';
    }

    return {
      avgCompositeScore: avgComposite,
      avgSocialSentiment: avgSentiment,
      dominantSentiment,
      dataSourceBreakdown: sourceCount,
      avgConfidence: totalConfidence / count,
    };
  }, [data]);
};

// ============================================
// Export Types
// ============================================

export type { SentimentResult } from '../services/sentimentApi';
