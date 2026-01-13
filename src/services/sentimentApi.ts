/**
 * Sentiment API Service
 *
 * Fetches cryptocurrency sentiment data from multiple sources.
 * Priority: Santiment (GraphQL) > LunarCrush > Estimation fallback
 *
 * API Keys (optional - set in .env):
 * - VITE_SANTIMENT_API_KEY: Santiment API key
 * - VITE_LUNARCRUSH_API_KEY: LunarCrush API key
 */

import axios from 'axios';

// ============================================
// Constants & Configuration
// ============================================

const SANTIMENT_API = 'https://api.santiment.net/graphql';
const LUNARCRUSH_API = 'https://lunarcrush.com/api4/public';
const CACHE_PREFIX = 'sentiment_cache_';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// API Keys from environment
const SANTIMENT_API_KEY = import.meta.env.VITE_SANTIMENT_API_KEY || '';
const LUNARCRUSH_API_KEY = import.meta.env.VITE_LUNARCRUSH_API_KEY || '';

// Symbol mappings
const SYMBOL_TO_SANTIMENT_SLUG: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  XRP: 'ripple',
  SOL: 'solana',
  DOGE: 'dogecoin',
  ADA: 'cardano',
  AVAX: 'avalanche',
  DOT: 'polkadot',
  MATIC: 'polygon-matic',
  LINK: 'chainlink',
  ATOM: 'cosmos',
  UNI: 'uniswap',
  AAVE: 'aave',
};

const SYMBOL_TO_LUNARCRUSH: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  XRP: 'xrp',
  SOL: 'solana',
  DOGE: 'dogecoin',
  ADA: 'cardano',
  AVAX: 'avalanche',
  DOT: 'polkadot',
  MATIC: 'polygon',
  LINK: 'chainlink',
  ATOM: 'cosmos',
  UNI: 'uniswap',
  AAVE: 'aave',
};

// ============================================
// Types
// ============================================

export interface SocialMetrics {
  galaxyScore: number;           // 0-100 composite social score
  socialVolume: number;          // Total social mentions
  socialVolumeChange24h: number; // % change in volume
  socialDominance: number;       // % of total crypto social volume
  socialEngagement: number;      // Likes, shares, comments
  sentiment: number;             // -1 to 1 (bearish to bullish)
  sentimentRelative: number;     // Relative to historical average
}

export interface NewsMetrics {
  score: number;                 // -1 to 1
  articleCount24h: number;
  positiveRatio: number;         // % of positive articles
  negativeRatio: number;         // % of negative articles
}

export interface SentimentResult {
  symbol: string;
  timestamp: Date;
  social: SocialMetrics;
  news: NewsMetrics;
  compositeScore: number;        // 0-100 overall sentiment
  confidence: {
    dataCompleteness: number;    // 0-1
    sources: string[];           // Which APIs provided data
    isEstimated: boolean;
  };
  dataSource: 'santiment' | 'lunarcrush' | 'estimated' | 'cache';
}

interface CacheEntry {
  symbol: string;
  data: SentimentResult;
  fetchedAt: number;
}

// ============================================
// Cache Management
// ============================================

const getCache = (symbol: string): SentimentResult | null => {
  try {
    const cached = localStorage.getItem(`${CACHE_PREFIX}${symbol}`);
    if (!cached) return null;

    const entry: CacheEntry = JSON.parse(cached);

    // Check if cache is still valid
    if (Date.now() - entry.fetchedAt > CACHE_TTL) {
      return null;
    }

    return {
      ...entry.data,
      dataSource: 'cache',
    };
  } catch {
    return null;
  }
};

const setCache = (symbol: string, data: SentimentResult): void => {
  try {
    const entry: CacheEntry = {
      symbol,
      data,
      fetchedAt: Date.now(),
    };
    localStorage.setItem(`${CACHE_PREFIX}${symbol}`, JSON.stringify(entry));
  } catch (error) {
    console.warn('Failed to cache sentiment data:', error);
  }
};

// ============================================
// Santiment API (GraphQL)
// ============================================

interface SantimentResponse {
  data: {
    getMetric: {
      timeseriesData: Array<{
        datetime: string;
        value: number;
      }>;
    };
  };
}

/**
 * Fetch sentiment data from Santiment GraphQL API
 * Requires API key for full access
 */
export const fetchSantimentData = async (
  symbol: string
): Promise<SentimentResult | null> => {
  if (!SANTIMENT_API_KEY) {
    return null; // Skip if no API key
  }

  const slug = SYMBOL_TO_SANTIMENT_SLUG[symbol];
  if (!slug) {
    console.warn(`No Santiment mapping for ${symbol}`);
    return null;
  }

  try {
    // Fetch social volume and sentiment balance
    const query = `
      {
        socialVolume: getMetric(metric: "social_volume_total") {
          timeseriesData(
            slug: "${slug}"
            from: "utc_now-2d"
            to: "utc_now"
            interval: "1d"
          ) {
            datetime
            value
          }
        }
        sentimentBalance: getMetric(metric: "sentiment_balance_total") {
          timeseriesData(
            slug: "${slug}"
            from: "utc_now-2d"
            to: "utc_now"
            interval: "1d"
          ) {
            datetime
            value
          }
        }
        socialDominance: getMetric(metric: "social_dominance_total") {
          timeseriesData(
            slug: "${slug}"
            from: "utc_now-2d"
            to: "utc_now"
            interval: "1d"
          ) {
            datetime
            value
          }
        }
      }
    `;

    const response = await axios.post(
      SANTIMENT_API,
      { query },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Apikey ${SANTIMENT_API_KEY}`,
        },
        timeout: 15000,
      }
    );

    const data = response.data.data;
    if (!data) {
      console.warn(`No Santiment data for ${symbol}`);
      return null;
    }

    // Extract latest values
    const socialVolume = data.socialVolume?.timeseriesData?.[0]?.value || 0;
    const sentimentBalance = data.sentimentBalance?.timeseriesData?.[0]?.value || 0;
    const socialDominance = data.socialDominance?.timeseriesData?.[0]?.value || 0;

    // Calculate 24h change if we have 2 data points
    const socialVolumeYesterday = data.socialVolume?.timeseriesData?.[1]?.value || socialVolume;
    const socialVolumeChange = socialVolumeYesterday > 0
      ? ((socialVolume - socialVolumeYesterday) / socialVolumeYesterday) * 100
      : 0;

    // Normalize sentiment balance to -1 to 1 (typical range is -100 to 100)
    const normalizedSentiment = Math.max(-1, Math.min(1, sentimentBalance / 100));

    // Convert to composite score (0-100)
    const compositeScore = Math.round((normalizedSentiment + 1) * 50);

    const result: SentimentResult = {
      symbol,
      timestamp: new Date(),
      social: {
        galaxyScore: compositeScore,
        socialVolume,
        socialVolumeChange24h: socialVolumeChange,
        socialDominance,
        socialEngagement: socialVolume * 0.1, // Estimate
        sentiment: normalizedSentiment,
        sentimentRelative: 1,
      },
      news: {
        score: normalizedSentiment * 0.8, // Estimate from sentiment
        articleCount24h: 0,
        positiveRatio: (normalizedSentiment + 1) / 2,
        negativeRatio: (1 - normalizedSentiment) / 2,
      },
      compositeScore,
      confidence: {
        dataCompleteness: 0.7,
        sources: ['santiment'],
        isEstimated: false,
      },
      dataSource: 'santiment',
    };

    setCache(symbol, result);
    return result;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.warn(`Santiment API: Invalid or expired API key`);
      } else if (error.response?.status === 429) {
        console.warn(`Santiment rate limited for ${symbol}`);
      } else {
        console.error(`Santiment API Error (${symbol}):`, error.message);
      }
    } else {
      console.error(`Santiment Error (${symbol}):`, error);
    }
    return null;
  }
};

// ============================================
// LunarCrush API
// ============================================

interface LunarCrushResponse {
  data: Array<{
    galaxy_score: number;
    social_volume: number;
    social_volume_change_24h: number;
    social_dominance: number;
    social_score: number;
    average_sentiment: number;
    sentiment_relative: number;
    news_articles: number;
    news_positive: number;
    news_negative: number;
    news_neutral: number;
  }>;
}

/**
 * Fetch sentiment data from LunarCrush API
 * Requires API key (no longer has free public access)
 */
export const fetchLunarCrushSentiment = async (
  symbol: string
): Promise<SentimentResult | null> => {
  if (!LUNARCRUSH_API_KEY) {
    return null; // Skip if no API key
  }

  const lunarId = SYMBOL_TO_LUNARCRUSH[symbol];
  if (!lunarId) {
    console.warn(`No LunarCrush mapping for ${symbol}`);
    return null;
  }

  try {
    const response = await axios.get<LunarCrushResponse>(
      `${LUNARCRUSH_API}/coins/${lunarId}/time-series/v2`,
      {
        params: {
          bucket: 'day',
          interval: '1d',
        },
        headers: {
          'Authorization': `Bearer ${LUNARCRUSH_API_KEY}`,
        },
        timeout: 10000,
      }
    );

    const data = response.data.data?.[0];
    if (!data) {
      console.warn(`No LunarCrush data for ${symbol}`);
      return null;
    }

    // Normalize sentiment from -5 to 5 → -1 to 1
    const normalizedSentiment = data.average_sentiment / 5;

    // Calculate news score from positive/negative ratio
    const totalNews = data.news_positive + data.news_negative + data.news_neutral;
    const newsScore = totalNews > 0
      ? (data.news_positive - data.news_negative) / totalNews
      : 0;

    const result: SentimentResult = {
      symbol,
      timestamp: new Date(),
      social: {
        galaxyScore: data.galaxy_score || 50,
        socialVolume: data.social_volume || 0,
        socialVolumeChange24h: data.social_volume_change_24h || 0,
        socialDominance: data.social_dominance || 0,
        socialEngagement: data.social_score || 0,
        sentiment: normalizedSentiment,
        sentimentRelative: data.sentiment_relative || 1,
      },
      news: {
        score: newsScore,
        articleCount24h: data.news_articles || 0,
        positiveRatio: totalNews > 0 ? data.news_positive / totalNews : 0.5,
        negativeRatio: totalNews > 0 ? data.news_negative / totalNews : 0.5,
      },
      compositeScore: data.galaxy_score || 50,
      confidence: {
        dataCompleteness: 0.9,
        sources: ['lunarcrush'],
        isEstimated: false,
      },
      dataSource: 'lunarcrush',
    };

    setCache(symbol, result);
    return result;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.warn(`LunarCrush API: Invalid or missing API key`);
      } else if (error.response?.status === 429) {
        console.warn(`LunarCrush rate limited for ${symbol}`);
      } else {
        console.error(`LunarCrush API Error (${symbol}):`, error.message);
      }
    } else {
      console.error(`LunarCrush Error (${symbol}):`, error);
    }
    return null;
  }
};

// ============================================
// Fallback Estimation
// ============================================

export interface EstimationInput {
  fearGreed?: number;
  exchangeNetflow?: number;
  priceChange24h?: number;
  volume24h?: number;
}

/**
 * Estimate sentiment when APIs are unavailable
 * Uses Fear & Greed + on-chain data as proxy
 */
export const estimateSentiment = (
  symbol: string,
  input: EstimationInput
): SentimentResult => {
  const { fearGreed = 50, exchangeNetflow = 0, priceChange24h = 0 } = input;

  // Use Fear & Greed as base sentiment (-1 to 1)
  const baseSentiment = (fearGreed - 50) / 50;

  // Adjust based on exchange flow (outflows = bullish adjustment)
  const flowAdjustment = exchangeNetflow < -5000 ? 0.15 :
                         exchangeNetflow > 5000 ? -0.15 : 0;

  // Adjust based on price momentum
  const momentumAdjustment = priceChange24h > 5 ? 0.1 :
                             priceChange24h < -5 ? -0.1 : 0;

  const adjustedSentiment = Math.max(-1, Math.min(1,
    baseSentiment + flowAdjustment + momentumAdjustment
  ));

  // Convert to composite score (0-100)
  const compositeScore = Math.round((adjustedSentiment + 1) * 50);

  const result: SentimentResult = {
    symbol,
    timestamp: new Date(),
    social: {
      galaxyScore: compositeScore,
      socialVolume: 0,
      socialVolumeChange24h: 0,
      socialDominance: 0,
      socialEngagement: 0,
      sentiment: adjustedSentiment,
      sentimentRelative: 1,
    },
    news: {
      score: baseSentiment,
      articleCount24h: 0,
      positiveRatio: (adjustedSentiment + 1) / 2,
      negativeRatio: (1 - adjustedSentiment) / 2,
    },
    compositeScore,
    confidence: {
      dataCompleteness: 0.3, // Low confidence for estimates
      sources: ['estimated'],
      isEstimated: true,
    },
    dataSource: 'estimated',
  };

  // Cache estimated results too (shorter TTL would be nice but using same)
  setCache(symbol, result);

  return result;
};

// ============================================
// Main Fetch Functions
// ============================================

/**
 * Fetch sentiment data with priority: Santiment > LunarCrush > Estimation
 */
export const fetchSentiment = async (
  symbol: string,
  fallbackInput?: EstimationInput
): Promise<SentimentResult> => {
  // Check cache first
  const cached = getCache(symbol);
  if (cached) {
    return cached;
  }

  // Try Santiment (if API key available)
  if (SANTIMENT_API_KEY) {
    const santimentData = await fetchSantimentData(symbol);
    if (santimentData) {
      return santimentData;
    }
  }

  // Try LunarCrush (if API key available)
  if (LUNARCRUSH_API_KEY) {
    const lunarData = await fetchLunarCrushSentiment(symbol);
    if (lunarData) {
      return lunarData;
    }
  }

  // Fallback to estimation
  return estimateSentiment(symbol, fallbackInput || {});
};

/**
 * Batch fetch sentiment data for multiple symbols
 */
export const fetchAllSentiment = async (
  symbols: string[],
  fallbackInputs: Record<string, EstimationInput> = {}
): Promise<Record<string, SentimentResult>> => {
  const results: Record<string, SentimentResult> = {};
  const BATCH_SIZE = 3;
  const BATCH_DELAY = 2000; // 2 seconds between batches

  // Prioritize BTC first
  const prioritized = ['BTC', ...symbols.filter((s) => s !== 'BTC')];
  const uniqueSymbols = [...new Set(prioritized)];

  for (let i = 0; i < uniqueSymbols.length; i += BATCH_SIZE) {
    const batch = uniqueSymbols.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map((symbol) =>
        fetchSentiment(symbol, fallbackInputs[symbol])
      )
    );

    batch.forEach((symbol, idx) => {
      results[symbol] = batchResults[idx];
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
 * Check which sentiment APIs are available
 */
export const getAvailableAPIs = (): { santiment: boolean; lunarcrush: boolean } => ({
  santiment: !!SANTIMENT_API_KEY,
  lunarcrush: !!LUNARCRUSH_API_KEY,
});

/**
 * Clear all sentiment cache entries
 */
export const clearSentimentCache = (): void => {
  const keys = Object.keys(localStorage).filter((k) =>
    k.startsWith(CACHE_PREFIX)
  );
  keys.forEach((k) => localStorage.removeItem(k));
};

/**
 * Convert SentimentResult to the format expected by valuationRisk.ts
 */
export const toValuationSentiment = (
  result: SentimentResult
): {
  socialVolume: number;
  socialSentiment: number;
  twitterMentions: number;
  redditActivity: number;
  newsScore: number;
  newsVolume: number;
  fundingRate: number;
  openInterest: number;
  longShortRatio: number;
  largeTransactions: number;
  whaleAccumulation: number;
  timestamp: Date;
} => {
  return {
    socialVolume: result.social.socialVolume,
    socialSentiment: result.social.sentiment * 100, // -100 to +100
    twitterMentions: Math.round(result.social.socialEngagement * 0.6),
    redditActivity: Math.round(result.social.socialEngagement * 0.4),
    newsScore: result.news.score * 100, // -100 to +100
    newsVolume: result.news.articleCount24h,
    fundingRate: 0.01, // Placeholder
    openInterest: 0,
    longShortRatio: 1.0,
    largeTransactions: 0,
    whaleAccumulation: 0,
    timestamp: result.timestamp,
  };
};

/**
 * Get sentiment classification label
 */
export const getSentimentLabel = (
  score: number
): { label: string; labelKo: string; color: string } => {
  if (score <= 20) {
    return { label: 'Extreme Fear', labelKo: '극단적 공포', color: '#ef4444' };
  } else if (score <= 40) {
    return { label: 'Fear', labelKo: '공포', color: '#f97316' };
  } else if (score <= 60) {
    return { label: 'Neutral', labelKo: '중립', color: '#eab308' };
  } else if (score <= 80) {
    return { label: 'Greed', labelKo: '탐욕', color: '#84cc16' };
  } else {
    return { label: 'Extreme Greed', labelKo: '극단적 탐욕', color: '#22c55e' };
  }
};
