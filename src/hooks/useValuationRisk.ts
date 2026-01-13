/**
 * useValuationRisk Hook
 *
 * React hooks for cryptocurrency valuation risk assessment.
 * Provides multi-timeframe overvaluation analysis for portfolio assets.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Asset, OnchainData } from '../types';
import {
  calculateValuationRisk,
  estimateAltcoinValuation,
  getDefaultAltcoinValuation,
  type ValuationRiskResult,
  type ValuationInputData,
} from '../utils/valuationRisk';

// ============================================
// Constants
// ============================================

const DEFAULT_REFRESH_INTERVAL = 300000; // 5 minutes
const BTC_SYMBOL = 'BTC';

// ============================================
// Hook Types
// ============================================

export interface UseValuationRiskOptions {
  refreshInterval?: number;
  enableAutoRefresh?: boolean;
}

export interface UseValuationRiskReturn {
  results: Record<string, ValuationRiskResult>;
  btcResult: ValuationRiskResult | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => Promise<void>;
  getAssetRisk: (symbol: string) => ValuationRiskResult | null;
}

export interface MarketDataInput {
  fearGreed?: number;
  kimchiPremium?: number;
  prices: Record<string, { price: number; ma50?: number; ma200?: number }>;
  sentiment?: Record<string, {
    socialSentiment: number;
    newsScore: number;
    fundingRate: number;
  }>;
}

// ============================================
// Main Hook
// ============================================

/**
 * Hook for calculating valuation risk across portfolio assets
 */
export const useValuationRisk = (
  assets: Asset[],
  onchainData: OnchainData | null,
  marketData: MarketDataInput,
  options: UseValuationRiskOptions = {}
): UseValuationRiskReturn => {
  const { refreshInterval = DEFAULT_REFRESH_INTERVAL, enableAutoRefresh = true } =
    options;

  const [results, setResults] = useState<Record<string, ValuationRiskResult>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isFetchingRef = useRef(false);

  // Extract unique symbols from assets
  const symbols = useMemo(
    () => [...new Set(assets.map((a) => a.symbol))],
    [assets]
  );

  // Calculate valuation risk for all assets
  const calculateAll = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      setLoading(true);
      const newResults: Record<string, ValuationRiskResult> = {};

      // First, calculate BTC valuation (primary data source)
      const btcPrice = marketData.prices[BTC_SYMBOL]?.price || 0;
      const btcSentiment = marketData.sentiment?.[BTC_SYMBOL];
      const btcInput: ValuationInputData = {
        symbol: BTC_SYMBOL,
        currentPrice: btcPrice,
        ma50: marketData.prices[BTC_SYMBOL]?.ma50,
        ma200: marketData.prices[BTC_SYMBOL]?.ma200,
        mvrv: onchainData?.mvrv,
        nvt: onchainData?.nvt,
        realizedPrice: onchainData?.realizedPrice,
        exchangeNetflow: onchainData?.exchangeNetflow,
        activeAddresses: onchainData?.activeAddresses,
        fearGreed: marketData.fearGreed,
        kimchiPremium: marketData.kimchiPremium,
        sentiment: btcSentiment ? {
          socialVolume: 0,
          socialSentiment: btcSentiment.socialSentiment,
          twitterMentions: 0,
          redditActivity: 0,
          newsScore: btcSentiment.newsScore,
          newsVolume: 0,
          fundingRate: btcSentiment.fundingRate,
          openInterest: 0,
          longShortRatio: 1,
          largeTransactions: 0,
          whaleAccumulation: 0,
          timestamp: new Date(),
        } : undefined,
      };

      // Calculate BTC result first
      if (symbols.includes(BTC_SYMBOL) || btcPrice > 0) {
        newResults[BTC_SYMBOL] = calculateValuationRisk(btcInput);
      }

      // Calculate for other assets using BTC correlation
      for (const symbol of symbols) {
        if (symbol === BTC_SYMBOL) continue;

        const assetPrice = marketData.prices[symbol]?.price || 0;
        const assetMa50 = marketData.prices[symbol]?.ma50;
        const assetMa200 = marketData.prices[symbol]?.ma200;
        const assetSentiment = marketData.sentiment?.[symbol];

        // Skip if no price data
        if (assetPrice === 0) continue;

        // Estimate altcoin metrics based on BTC if BTC data available
        let altcoinInput: ValuationInputData;
        if (btcInput.mvrv !== undefined || btcInput.nvt !== undefined) {
          altcoinInput = estimateAltcoinValuation(
            symbol,
            btcInput,
            assetPrice,
            assetMa200
          );
          // Add MA50 and sentiment to estimated input
          altcoinInput.ma50 = assetMa50;
        } else {
          // Fallback to minimal data
          altcoinInput = getDefaultAltcoinValuation(
            symbol,
            assetPrice,
            marketData.fearGreed
          );
          altcoinInput.ma50 = assetMa50;
          altcoinInput.ma200 = assetMa200;
        }

        // Add sentiment if available
        if (assetSentiment) {
          altcoinInput.sentiment = {
            socialVolume: 0,
            socialSentiment: assetSentiment.socialSentiment,
            twitterMentions: 0,
            redditActivity: 0,
            newsScore: assetSentiment.newsScore,
            newsVolume: 0,
            fundingRate: assetSentiment.fundingRate,
            openInterest: 0,
            longShortRatio: 1,
            largeTransactions: 0,
            whaleAccumulation: 0,
            timestamp: new Date(),
          };
        }

        newResults[symbol] = calculateValuationRisk(altcoinInput);
      }

      setResults(newResults);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '평가 리스크 계산 실패');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [symbols, onchainData, marketData]);

  // Initial calculation and auto-refresh
  useEffect(() => {
    calculateAll();

    if (enableAutoRefresh) {
      const interval = setInterval(calculateAll, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [calculateAll, refreshInterval, enableAutoRefresh]);

  // Helper to get individual asset risk
  const getAssetRisk = useCallback(
    (symbol: string): ValuationRiskResult | null => {
      return results[symbol] || null;
    },
    [results]
  );

  // BTC result for reference
  const btcResult = useMemo(() => results[BTC_SYMBOL] || null, [results]);

  return {
    results,
    btcResult,
    loading,
    error,
    lastUpdated,
    refetch: calculateAll,
    getAssetRisk,
  };
};

// ============================================
// Utility Hooks
// ============================================

/**
 * Hook to get valuation risk for a single asset
 */
export const useSingleAssetValuationRisk = (
  symbol: string,
  allResults: Record<string, ValuationRiskResult>
): ValuationRiskResult | null => {
  return useMemo(() => allResults[symbol] || null, [allResults, symbol]);
};

/**
 * Hook to get portfolio-level valuation summary
 */
export const usePortfolioValuationSummary = (
  results: Record<string, ValuationRiskResult>,
  assets: Asset[]
): {
  weightedScore: number;
  riskDistribution: Record<string, number>;
  topRisks: Array<{ symbol: string; score: number; riskLevel: string }>;
  avgConfidence: number;
} => {
  return useMemo(() => {
    if (Object.keys(results).length === 0 || assets.length === 0) {
      return {
        weightedScore: 0.5,
        riskDistribution: {
          UNDERVALUED: 0,
          FAIR_VALUE: 0,
          ELEVATED: 0,
          OVERVALUED: 0,
          EXTREME: 0,
        },
        topRisks: [],
        avgConfidence: 0,
      };
    }

    // Calculate total portfolio value for weighting
    const totalValue = assets.reduce((sum, a) => sum + (a.value || 0), 0);

    let weightedScore = 0;
    let totalConfidence = 0;
    const riskDistribution: Record<string, number> = {
      UNDERVALUED: 0,
      FAIR_VALUE: 0,
      ELEVATED: 0,
      OVERVALUED: 0,
      EXTREME: 0,
    };

    assets.forEach((asset) => {
      const result = results[asset.symbol];
      if (!result) return;

      const weight = totalValue > 0 ? (asset.value || 0) / totalValue : 0;
      weightedScore += result.compositeScore * weight;
      totalConfidence += result.confidence.overall * weight;
      riskDistribution[result.riskLevel] =
        (riskDistribution[result.riskLevel] || 0) + weight * 100;
    });

    // Top risks by score (highest overvaluation first)
    const topRisks = Object.entries(results)
      .filter(([symbol]) => assets.some((a) => a.symbol === symbol))
      .map(([symbol, result]) => ({
        symbol,
        score: result.compositeScore,
        riskLevel: result.riskLevel,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return {
      weightedScore,
      riskDistribution,
      topRisks,
      avgConfidence: totalConfidence,
    };
  }, [results, assets]);
};

// ============================================
// Export Types
// ============================================

export type {
  ValuationRiskResult,
  ValuationInputData,
} from '../utils/valuationRisk';
