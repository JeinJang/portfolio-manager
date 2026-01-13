/**
 * Valuation Risk Module
 *
 * Multi-timeframe cryptocurrency valuation risk assessment.
 * Analyzes overvaluation risk across short, medium, and long-term horizons
 * using on-chain metrics, market data, and category-based estimations.
 */

import { getAssetCategory } from './cashAnalysis';

// ============================================
// Type Definitions
// ============================================

export type ValuationTimeframe = 'short' | 'medium' | 'long';

export type ValuationRiskLevel =
  | 'UNDERVALUED'
  | 'FAIR_VALUE'
  | 'ELEVATED'
  | 'OVERVALUED'
  | 'EXTREME';

export type AssetCategory = 'core' | 'major' | 'growth' | 'speculative';

// Individual metric analysis result
export interface MetricAnalysis {
  name: string;
  nameKo: string;
  value: number;
  normalizedScore: number; // 0-1 (0=undervalued, 1=overvalued)
  weight: number;
  confidence: number; // 0-1
  reason: string;
}

// Timeframe-specific assessment
export interface TimeframeAssessment {
  timeframe: ValuationTimeframe;
  label: string;
  overvaluationScore: number; // 0-1 composite
  riskLevel: ValuationRiskLevel;
  metrics: MetricAnalysis[];
  confidence: number;
}

// Key driver explaining score contribution
export interface ValuationDriver {
  metric: string;
  contribution: number;
  direction: 'bullish' | 'neutral' | 'bearish';
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

// Main result interface
export interface ValuationRiskResult {
  symbol: string;
  timestamp: Date;
  compositeScore: number; // 0-1 overall overvaluation
  riskLevel: ValuationRiskLevel;
  shortTerm: TimeframeAssessment;
  mediumTerm: TimeframeAssessment;
  longTerm: TimeframeAssessment;
  keyDrivers: ValuationDriver[];
  confidence: {
    overall: number;
    dataCompleteness: number;
    isEstimated: boolean;
    estimationMethod?: string;
  };
  recommendation: {
    action: 'ACCUMULATE' | 'HOLD' | 'REDUCE' | 'EXIT';
    reason: string;
    urgency: 'low' | 'medium' | 'high';
  };
}

// Sentiment data interface (for future API integration)
export interface SentimentData {
  socialVolume: number;
  socialSentiment: number; // -100 to +100
  twitterMentions: number;
  redditActivity: number;
  newsScore: number; // -100 to +100
  newsVolume: number;
  fundingRate: number;
  openInterest: number;
  longShortRatio: number;
  largeTransactions: number;
  whaleAccumulation: number;
  timestamp: Date;
}

// Input data for valuation calculation
export interface ValuationInputData {
  symbol: string;
  mvrv?: number;
  nvt?: number;
  realizedPrice?: number;
  exchangeNetflow?: number;
  activeAddresses?: number;
  activeAddresses30dAvg?: number;
  currentPrice: number;
  ma50?: number;
  ma200?: number;
  ath?: number;
  cycleLow?: number;
  fearGreed?: number;
  kimchiPremium?: number;
  sentiment?: SentimentData;
}

// ============================================
// Weight Configurations
// ============================================

// Timeframe-specific metric weights
// Updated with sentiment metrics for comprehensive analysis
export const TIMEFRAME_WEIGHTS: Record<
  ValuationTimeframe,
  Record<string, number>
> = {
  // Short-term (1-7 days): Focus on momentum and sentiment
  // Sentiment is highly relevant for short-term movements
  short: {
    priceVsMa50: 0.20,           // Technical momentum
    exchangeNetflow: 0.15,       // On-chain flow
    fearGreed: 0.15,             // Market sentiment
    kimchiPremium: 0.10,         // Korean market heat
    activeAddressRatio: 0.10,    // Network activity
    socialSentiment: 0.15,       // Social media sentiment (NEW)
    fundingRate: 0.15,           // Derivatives sentiment (NEW)
  },
  // Medium-term (1-4 weeks): Balance of technicals and fundamentals
  // Moderate sentiment influence
  medium: {
    mvrv: 0.22,                  // On-chain valuation
    priceVsMa200: 0.18,          // Long-term trend
    nvt: 0.15,                   // Network valuation
    exchangeNetflow: 0.12,       // Flow dynamics
    fearGreed: 0.13,             // Market mood
    socialSentiment: 0.10,       // Social trends (NEW)
    newsSentiment: 0.10,         // News sentiment (NEW)
  },
  // Long-term (1-6 months): Focus on fundamentals and cycle position
  // Sentiment has minimal weight for long-term
  long: {
    mvrv: 0.28,                  // Primary valuation metric
    nvt: 0.18,                   // Network fundamentals
    cyclePosition: 0.18,         // Market cycle
    priceVsMa200: 0.14,          // Long-term technical
    realizedPriceRatio: 0.14,    // Cost basis analysis
    socialSentiment: 0.08,       // Long-term social trend (NEW)
  },
};

// Composite timeframe weights for overall score
export const COMPOSITE_TIMEFRAME_WEIGHTS: Record<ValuationTimeframe, number> = {
  short: 0.20,
  medium: 0.35,
  long: 0.45,
};

// Category-based valuation thresholds
export const CATEGORY_VALUATION_THRESHOLDS: Record<
  AssetCategory,
  {
    mvrvOverbought: number;
    mvrvOversold: number;
    nvtOverbought: number;
    ma200DeviationMax: number;
    betaToBtc: number;
  }
> = {
  core: {
    mvrvOverbought: 3.5,
    mvrvOversold: 1.0,
    nvtOverbought: 95,
    ma200DeviationMax: 80,
    betaToBtc: 1.0,
  },
  major: {
    mvrvOverbought: 3.0,
    mvrvOversold: 0.8,
    nvtOverbought: 85,
    ma200DeviationMax: 100,
    betaToBtc: 1.3,
  },
  growth: {
    mvrvOverbought: 2.5,
    mvrvOversold: 0.6,
    nvtOverbought: 75,
    ma200DeviationMax: 120,
    betaToBtc: 1.6,
  },
  speculative: {
    mvrvOverbought: 2.0,
    mvrvOversold: 0.5,
    nvtOverbought: 65,
    ma200DeviationMax: 150,
    betaToBtc: 2.0,
  },
};

// Timeframe labels in Korean
const TIMEFRAME_LABELS: Record<ValuationTimeframe, string> = {
  short: '단기 (1-7일)',
  medium: '중기 (1-4주)',
  long: '장기 (1-6개월)',
};

// ============================================
// Utility Functions
// ============================================

/**
 * Convert overvaluation score (0-1) to risk level
 */
const getValuationRiskLevel = (score: number): ValuationRiskLevel => {
  if (score < 0.2) return 'UNDERVALUED';
  if (score < 0.4) return 'FAIR_VALUE';
  if (score < 0.6) return 'ELEVATED';
  if (score < 0.8) return 'OVERVALUED';
  return 'EXTREME';
};

/**
 * Clamp a value between 0 and 1
 */
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Adjust a metric value by beta coefficient, with bounds
 */
const adjustMetricByBeta = (
  baseValue: number,
  beta: number,
  minValue: number,
  maxValue: number
): number => {
  const neutral = (minValue + maxValue) / 2;
  const deviation = baseValue - neutral;
  const adjustedDeviation = deviation * beta;
  const adjusted = neutral + adjustedDeviation;
  return Math.max(minValue, Math.min(maxValue, adjusted));
};

// ============================================
// Sentiment Analysis Functions
// ============================================

/**
 * Analyze social sentiment for valuation
 * socialSentiment ranges from -100 (extreme fear) to +100 (extreme greed)
 */
export const analyzeSocialSentimentValuation = (
  sentiment: number
): MetricAnalysis => {
  // Normalize from -100 to +100 → 0 to 1
  const normalizedScore = (sentiment + 100) / 200;

  let reason: string;
  if (sentiment <= -60) {
    reason = `소셜 센티먼트 ${sentiment.toFixed(0)} - 극단적 공포, 축적 기회`;
  } else if (sentiment <= -20) {
    reason = `소셜 센티먼트 ${sentiment.toFixed(0)} - 부정적 분위기`;
  } else if (sentiment <= 20) {
    reason = `소셜 센티먼트 ${sentiment.toFixed(0)} - 중립`;
  } else if (sentiment <= 60) {
    reason = `소셜 센티먼트 ${sentiment.toFixed(0)} - 긍정적 분위기, 주의`;
  } else {
    reason = `소셜 센티먼트 ${sentiment.toFixed(0)} - 극단적 탐욕, 고평가 위험`;
  }

  return {
    name: 'socialSentiment',
    nameKo: '소셜 센티먼트',
    value: sentiment,
    normalizedScore: clamp01(normalizedScore),
    weight: 0,
    confidence: 1.0,
    reason,
  };
};

/**
 * Analyze news sentiment for valuation
 * newsScore ranges from -100 to +100
 */
export const analyzeNewsSentimentValuation = (
  newsScore: number
): MetricAnalysis => {
  // Normalize from -100 to +100 → 0 to 1
  const normalizedScore = (newsScore + 100) / 200;

  let reason: string;
  if (newsScore <= -50) {
    reason = `뉴스 센티먼트 ${newsScore.toFixed(0)} - 매우 부정적`;
  } else if (newsScore <= -20) {
    reason = `뉴스 센티먼트 ${newsScore.toFixed(0)} - 부정적`;
  } else if (newsScore <= 20) {
    reason = `뉴스 센티먼트 ${newsScore.toFixed(0)} - 중립`;
  } else if (newsScore <= 50) {
    reason = `뉴스 센티먼트 ${newsScore.toFixed(0)} - 긍정적`;
  } else {
    reason = `뉴스 센티먼트 ${newsScore.toFixed(0)} - 매우 긍정적, 과열 주의`;
  }

  return {
    name: 'newsSentiment',
    nameKo: '뉴스 센티먼트',
    value: newsScore,
    normalizedScore: clamp01(normalizedScore),
    weight: 0,
    confidence: 0.8,
    reason,
  };
};

/**
 * Analyze funding rate for short-term sentiment
 * Positive = longs paying shorts = bullish sentiment = overheated
 * Negative = shorts paying longs = bearish sentiment
 */
export const analyzeFundingRateValuation = (
  fundingRate: number
): MetricAnalysis => {
  // Typical range: -0.1% to +0.1%
  let normalizedScore: number;
  let reason: string;

  if (fundingRate < -0.05) {
    normalizedScore = 0.1;
    reason = `펀딩비 ${(fundingRate * 100).toFixed(3)}% - 극단적 숏 포지션, 반등 가능`;
  } else if (fundingRate < 0) {
    normalizedScore = 0.3;
    reason = `펀딩비 ${(fundingRate * 100).toFixed(3)}% - 약세 심리`;
  } else if (fundingRate < 0.03) {
    normalizedScore = 0.5;
    reason = `펀딩비 ${(fundingRate * 100).toFixed(3)}% - 정상 범위`;
  } else if (fundingRate < 0.08) {
    normalizedScore = 0.75;
    reason = `펀딩비 ${(fundingRate * 100).toFixed(3)}% - 롱 과열`;
  } else {
    normalizedScore = 0.9;
    reason = `펀딩비 ${(fundingRate * 100).toFixed(3)}% - 극단적 롱 과열, 조정 위험`;
  }

  return {
    name: 'fundingRate',
    nameKo: '펀딩비',
    value: fundingRate,
    normalizedScore,
    weight: 0,
    confidence: 1.0,
    reason,
  };
};

// ============================================
// Individual Analysis Functions
// ============================================

/**
 * Analyze MVRV (Market Value to Realized Value) ratio
 */
export const analyzeMVRVValuation = (
  mvrv: number,
  category: AssetCategory
): MetricAnalysis => {
  const thresholds = CATEGORY_VALUATION_THRESHOLDS[category];

  let normalizedScore: number;
  let reason: string;

  if (mvrv < thresholds.mvrvOversold) {
    normalizedScore = 0;
    reason = `MVRV ${mvrv.toFixed(2)} - 실현가 대비 극단적 저평가`;
  } else if (mvrv < 1.5) {
    normalizedScore =
      ((mvrv - thresholds.mvrvOversold) / (1.5 - thresholds.mvrvOversold)) *
      0.3;
    reason = `MVRV ${mvrv.toFixed(2)} - 저평가 구간`;
  } else if (mvrv < 2.5) {
    normalizedScore = 0.3 + ((mvrv - 1.5) / 1.0) * 0.3;
    reason = `MVRV ${mvrv.toFixed(2)} - 적정 가치 구간`;
  } else if (mvrv < thresholds.mvrvOverbought) {
    normalizedScore =
      0.6 +
      ((mvrv - 2.5) / (thresholds.mvrvOverbought - 2.5)) * 0.3;
    reason = `MVRV ${mvrv.toFixed(2)} - 고평가 주의`;
  } else {
    normalizedScore =
      0.9 +
      Math.min(0.1, ((mvrv - thresholds.mvrvOverbought) / 2) * 0.1);
    reason = `MVRV ${mvrv.toFixed(2)} - 극단적 고평가, 사이클 천장 신호`;
  }

  return {
    name: 'mvrv',
    nameKo: 'MVRV 비율',
    value: mvrv,
    normalizedScore: clamp01(normalizedScore),
    weight: 0,
    confidence: 1.0,
    reason,
  };
};

/**
 * Analyze NVT (Network Value to Transactions) ratio
 */
export const analyzeNVTValuation = (
  nvt: number,
  category: AssetCategory
): MetricAnalysis => {
  const thresholds = CATEGORY_VALUATION_THRESHOLDS[category];

  let normalizedScore: number;
  let reason: string;

  if (nvt < 45) {
    normalizedScore = (nvt / 45) * 0.2;
    reason = `NVT ${nvt.toFixed(1)} - 네트워크 활동 대비 저평가`;
  } else if (nvt < 65) {
    normalizedScore = 0.2 + ((nvt - 45) / 20) * 0.3;
    reason = `NVT ${nvt.toFixed(1)} - 적정 가치 구간`;
  } else if (nvt < thresholds.nvtOverbought) {
    normalizedScore =
      0.5 + ((nvt - 65) / (thresholds.nvtOverbought - 65)) * 0.35;
    reason = `NVT ${nvt.toFixed(1)} - 고평가 주의`;
  } else {
    normalizedScore =
      0.85 +
      Math.min(0.15, ((nvt - thresholds.nvtOverbought) / 30) * 0.15);
    reason = `NVT ${nvt.toFixed(1)} - 네트워크 활동 대비 극단적 고평가`;
  }

  return {
    name: 'nvt',
    nameKo: 'NVT 비율',
    value: nvt,
    normalizedScore: clamp01(normalizedScore),
    weight: 0,
    confidence: 1.0,
    reason,
  };
};

/**
 * Analyze price deviation from moving average
 */
export const analyzePriceVsMA = (
  currentPrice: number,
  ma: number,
  maType: '50' | '200',
  category: AssetCategory
): MetricAnalysis => {
  if (ma === 0) {
    return {
      name: `priceVsMa${maType}`,
      nameKo: `${maType}MA 대비`,
      value: 0,
      normalizedScore: 0.5,
      weight: 0,
      confidence: 0,
      reason: '데이터 없음',
    };
  }

  const deviation = ((currentPrice - ma) / ma) * 100;
  const thresholds = CATEGORY_VALUATION_THRESHOLDS[category];
  const maxDeviation = thresholds.ma200DeviationMax;

  let normalizedScore: number;
  let reason: string;

  if (deviation < -30) {
    normalizedScore = Math.max(0, (deviation + 50) / 20) * 0.1;
    reason = `${maType}MA 대비 ${deviation.toFixed(1)}% - 극단적 저평가`;
  } else if (deviation < -10) {
    normalizedScore = 0.1 + ((deviation + 30) / 20) * 0.2;
    reason = `${maType}MA 대비 ${deviation.toFixed(1)}% - 저평가 구간`;
  } else if (deviation < 30) {
    normalizedScore = 0.3 + ((deviation + 10) / 40) * 0.3;
    reason = `${maType}MA 대비 ${deviation.toFixed(1)}% - 적정 구간`;
  } else if (deviation < maxDeviation) {
    normalizedScore =
      0.6 + ((deviation - 30) / (maxDeviation - 30)) * 0.3;
    reason = `${maType}MA 대비 ${deviation.toFixed(1)}% - 과열 구간`;
  } else {
    normalizedScore =
      0.9 + Math.min(0.1, ((deviation - maxDeviation) / 50) * 0.1);
    reason = `${maType}MA 대비 ${deviation.toFixed(1)}% - 극단적 과열`;
  }

  return {
    name: `priceVsMa${maType}`,
    nameKo: `${maType}MA 대비`,
    value: deviation,
    normalizedScore: clamp01(normalizedScore),
    weight: 0,
    confidence: 1.0,
    reason,
  };
};

/**
 * Analyze exchange netflow (inflow vs outflow)
 * Positive = inflow = selling pressure = bearish
 * Negative = outflow = accumulation = bullish
 */
export const analyzeExchangeNetflowValuation = (
  netflow: number
): MetricAnalysis => {
  let normalizedScore: number;
  let reason: string;

  if (netflow < -10000) {
    normalizedScore = 0.1;
    reason = `대규모 거래소 유출 (${(netflow / 1000).toFixed(1)}K) - 강한 축적 신호`;
  } else if (netflow < -5000) {
    normalizedScore = 0.25;
    reason = `거래소 유출 (${(netflow / 1000).toFixed(1)}K) - 축적 진행`;
  } else if (netflow < 5000) {
    normalizedScore = 0.5;
    reason = `거래소 유출입 균형 (${(netflow / 1000).toFixed(1)}K)`;
  } else if (netflow < 10000) {
    normalizedScore = 0.75;
    reason = `거래소 유입 (${(netflow / 1000).toFixed(1)}K) - 매도 압력`;
  } else {
    normalizedScore = 0.9;
    reason = `대규모 거래소 유입 (${(netflow / 1000).toFixed(1)}K) - 강한 매도 압력`;
  }

  return {
    name: 'exchangeNetflow',
    nameKo: '거래소 순유입',
    value: netflow,
    normalizedScore,
    weight: 0,
    confidence: 1.0,
    reason,
  };
};

/**
 * Analyze Fear & Greed Index for valuation context
 */
export const analyzeFearGreedValuation = (value: number): MetricAnalysis => {
  const normalizedScore = value / 100;

  let reason: string;
  if (value <= 25) {
    reason = `Fear & Greed ${value} - 극단적 공포, 저평가 가능성`;
  } else if (value <= 45) {
    reason = `Fear & Greed ${value} - 공포 구간`;
  } else if (value <= 55) {
    reason = `Fear & Greed ${value} - 중립`;
  } else if (value <= 75) {
    reason = `Fear & Greed ${value} - 탐욕 구간, 주의`;
  } else {
    reason = `Fear & Greed ${value} - 극단적 탐욕, 고평가 위험`;
  }

  return {
    name: 'fearGreed',
    nameKo: 'Fear & Greed',
    value,
    normalizedScore,
    weight: 0,
    confidence: 1.0,
    reason,
  };
};

/**
 * Analyze Kimchi Premium for Korean market overheating
 */
export const analyzeKimchiPremiumValuation = (
  premium: number
): MetricAnalysis => {
  let normalizedScore: number;
  let reason: string;

  if (premium < -2) {
    normalizedScore = 0.1;
    reason = `역프리미엄 ${premium.toFixed(1)}% - 국내 저평가`;
  } else if (premium < 2) {
    normalizedScore = 0.4;
    reason = `프리미엄 ${premium.toFixed(1)}% - 정상 범위`;
  } else if (premium < 5) {
    normalizedScore = 0.6;
    reason = `프리미엄 ${premium.toFixed(1)}% - 약간의 과열`;
  } else if (premium < 10) {
    normalizedScore = 0.8;
    reason = `프리미엄 ${premium.toFixed(1)}% - 과열 신호`;
  } else {
    normalizedScore = 0.95;
    reason = `프리미엄 ${premium.toFixed(1)}% - 극단적 과열`;
  }

  return {
    name: 'kimchiPremium',
    nameKo: '김치 프리미엄',
    value: premium,
    normalizedScore,
    weight: 0,
    confidence: 1.0,
    reason,
  };
};

/**
 * Analyze active address ratio (current vs 30d average)
 */
export const analyzeActiveAddressRatio = (
  current: number,
  average30d: number
): MetricAnalysis => {
  if (average30d === 0) {
    return {
      name: 'activeAddressRatio',
      nameKo: '활성 주소 비율',
      value: 0,
      normalizedScore: 0.5,
      weight: 0,
      confidence: 0,
      reason: '데이터 없음',
    };
  }

  const ratio = (current / average30d) * 100;
  let normalizedScore: number;
  let reason: string;

  if (ratio < 70) {
    normalizedScore = 0.2;
    reason = `활성 주소 ${ratio.toFixed(0)}% (30일 평균 대비) - 관심 감소, 축적 기회`;
  } else if (ratio < 90) {
    normalizedScore = 0.35;
    reason = `활성 주소 ${ratio.toFixed(0)}% - 평균 이하`;
  } else if (ratio < 110) {
    normalizedScore = 0.5;
    reason = `활성 주소 ${ratio.toFixed(0)}% - 정상 범위`;
  } else if (ratio < 130) {
    normalizedScore = 0.65;
    reason = `활성 주소 ${ratio.toFixed(0)}% - 관심 증가`;
  } else {
    normalizedScore = 0.8;
    reason = `활성 주소 ${ratio.toFixed(0)}% - 급증, 과열 가능성`;
  }

  return {
    name: 'activeAddressRatio',
    nameKo: '활성 주소 비율',
    value: ratio,
    normalizedScore,
    weight: 0,
    confidence: 1.0,
    reason,
  };
};

/**
 * Analyze position within market cycle (for long-term assessment)
 */
export const analyzeCyclePosition = (
  currentPrice: number,
  ath: number,
  cycleLow: number
): MetricAnalysis => {
  if (ath === 0 || cycleLow === 0 || ath <= cycleLow) {
    return {
      name: 'cyclePosition',
      nameKo: '사이클 위치',
      value: 0,
      normalizedScore: 0.5,
      weight: 0,
      confidence: 0,
      reason: '데이터 없음',
    };
  }

  const cycleRange = ath - cycleLow;
  const positionPercent = ((currentPrice - cycleLow) / cycleRange) * 100;
  const normalizedScore = clamp01(positionPercent / 100);

  let reason: string;
  if (positionPercent < 20) {
    reason = `사이클 저점 대비 ${positionPercent.toFixed(0)}% - 초기 축적 구간`;
  } else if (positionPercent < 40) {
    reason = `사이클 저점 대비 ${positionPercent.toFixed(0)}% - 상승 초기`;
  } else if (positionPercent < 60) {
    reason = `사이클 저점 대비 ${positionPercent.toFixed(0)}% - 중간 구간`;
  } else if (positionPercent < 80) {
    reason = `사이클 저점 대비 ${positionPercent.toFixed(0)}% - 후기 상승`;
  } else {
    reason = `사이클 저점 대비 ${positionPercent.toFixed(0)}% - ATH 근접, 주의`;
  }

  return {
    name: 'cyclePosition',
    nameKo: '사이클 위치',
    value: positionPercent,
    normalizedScore,
    weight: 0,
    confidence: 0.8,
    reason,
  };
};

/**
 * Analyze price vs realized price ratio
 */
export const analyzeRealizedPriceRatio = (
  currentPrice: number,
  realizedPrice: number
): MetricAnalysis => {
  if (realizedPrice === 0) {
    return {
      name: 'realizedPriceRatio',
      nameKo: '실현가 비율',
      value: 0,
      normalizedScore: 0.5,
      weight: 0,
      confidence: 0,
      reason: '데이터 없음',
    };
  }

  const ratio = currentPrice / realizedPrice;
  let normalizedScore: number;
  let reason: string;

  if (ratio < 0.8) {
    normalizedScore = 0.05;
    reason = `실현가 대비 ${(ratio * 100).toFixed(0)}% - 극단적 저평가`;
  } else if (ratio < 1.0) {
    normalizedScore = 0.15;
    reason = `실현가 대비 ${(ratio * 100).toFixed(0)}% - 저평가`;
  } else if (ratio < 1.5) {
    normalizedScore = 0.35;
    reason = `실현가 대비 ${(ratio * 100).toFixed(0)}% - 적정 구간`;
  } else if (ratio < 2.5) {
    normalizedScore = 0.55;
    reason = `실현가 대비 ${(ratio * 100).toFixed(0)}% - 프리미엄`;
  } else if (ratio < 3.5) {
    normalizedScore = 0.75;
    reason = `실현가 대비 ${(ratio * 100).toFixed(0)}% - 고평가`;
  } else {
    normalizedScore = 0.9;
    reason = `실현가 대비 ${(ratio * 100).toFixed(0)}% - 극단적 고평가`;
  }

  return {
    name: 'realizedPriceRatio',
    nameKo: '실현가 비율',
    value: ratio,
    normalizedScore,
    weight: 0,
    confidence: 1.0,
    reason,
  };
};

// ============================================
// Composite Calculation Functions
// ============================================

/**
 * Calculate valuation assessment for a specific timeframe
 */
export const calculateTimeframeAssessment = (
  timeframe: ValuationTimeframe,
  input: ValuationInputData,
  category: AssetCategory
): TimeframeAssessment => {
  const weights = TIMEFRAME_WEIGHTS[timeframe];
  const metrics: MetricAnalysis[] = [];
  let totalWeight = 0;
  let weightedScore = 0;
  let weightedConfidence = 0;

  // MVRV
  if (weights.mvrv && input.mvrv !== undefined) {
    const analysis = analyzeMVRVValuation(input.mvrv, category);
    analysis.weight = weights.mvrv;
    metrics.push(analysis);
    weightedScore += analysis.normalizedScore * analysis.weight * analysis.confidence;
    weightedConfidence += analysis.weight * analysis.confidence;
    totalWeight += analysis.weight;
  }

  // NVT
  if (weights.nvt && input.nvt !== undefined) {
    const analysis = analyzeNVTValuation(input.nvt, category);
    analysis.weight = weights.nvt;
    metrics.push(analysis);
    weightedScore += analysis.normalizedScore * analysis.weight * analysis.confidence;
    weightedConfidence += analysis.weight * analysis.confidence;
    totalWeight += analysis.weight;
  }

  // Price vs MA50
  if (weights.priceVsMa50 && input.ma50) {
    const analysis = analyzePriceVsMA(input.currentPrice, input.ma50, '50', category);
    analysis.weight = weights.priceVsMa50;
    metrics.push(analysis);
    weightedScore += analysis.normalizedScore * analysis.weight * analysis.confidence;
    weightedConfidence += analysis.weight * analysis.confidence;
    totalWeight += analysis.weight;
  }

  // Price vs MA200
  if (weights.priceVsMa200 && input.ma200) {
    const analysis = analyzePriceVsMA(input.currentPrice, input.ma200, '200', category);
    analysis.weight = weights.priceVsMa200;
    metrics.push(analysis);
    weightedScore += analysis.normalizedScore * analysis.weight * analysis.confidence;
    weightedConfidence += analysis.weight * analysis.confidence;
    totalWeight += analysis.weight;
  }

  // Exchange Netflow
  if (weights.exchangeNetflow && input.exchangeNetflow !== undefined) {
    const analysis = analyzeExchangeNetflowValuation(input.exchangeNetflow);
    analysis.weight = weights.exchangeNetflow;
    metrics.push(analysis);
    weightedScore += analysis.normalizedScore * analysis.weight * analysis.confidence;
    weightedConfidence += analysis.weight * analysis.confidence;
    totalWeight += analysis.weight;
  }

  // Fear & Greed
  if (weights.fearGreed && input.fearGreed !== undefined) {
    const analysis = analyzeFearGreedValuation(input.fearGreed);
    analysis.weight = weights.fearGreed;
    metrics.push(analysis);
    weightedScore += analysis.normalizedScore * analysis.weight * analysis.confidence;
    weightedConfidence += analysis.weight * analysis.confidence;
    totalWeight += analysis.weight;
  }

  // Kimchi Premium
  if (weights.kimchiPremium && input.kimchiPremium !== undefined) {
    const analysis = analyzeKimchiPremiumValuation(input.kimchiPremium);
    analysis.weight = weights.kimchiPremium;
    metrics.push(analysis);
    weightedScore += analysis.normalizedScore * analysis.weight * analysis.confidence;
    weightedConfidence += analysis.weight * analysis.confidence;
    totalWeight += analysis.weight;
  }

  // Active Address Ratio
  if (weights.activeAddressRatio && input.activeAddresses && input.activeAddresses30dAvg) {
    const analysis = analyzeActiveAddressRatio(
      input.activeAddresses,
      input.activeAddresses30dAvg
    );
    analysis.weight = weights.activeAddressRatio;
    metrics.push(analysis);
    weightedScore += analysis.normalizedScore * analysis.weight * analysis.confidence;
    weightedConfidence += analysis.weight * analysis.confidence;
    totalWeight += analysis.weight;
  }

  // Cycle Position
  if (weights.cyclePosition && input.ath && input.cycleLow) {
    const analysis = analyzeCyclePosition(input.currentPrice, input.ath, input.cycleLow);
    analysis.weight = weights.cyclePosition;
    metrics.push(analysis);
    weightedScore += analysis.normalizedScore * analysis.weight * analysis.confidence;
    weightedConfidence += analysis.weight * analysis.confidence;
    totalWeight += analysis.weight;
  }

  // Realized Price Ratio
  if (weights.realizedPriceRatio && input.realizedPrice) {
    const analysis = analyzeRealizedPriceRatio(input.currentPrice, input.realizedPrice);
    analysis.weight = weights.realizedPriceRatio;
    metrics.push(analysis);
    weightedScore += analysis.normalizedScore * analysis.weight * analysis.confidence;
    weightedConfidence += analysis.weight * analysis.confidence;
    totalWeight += analysis.weight;
  }

  // Social Sentiment (from sentiment API)
  if (weights.socialSentiment && input.sentiment?.socialSentiment !== undefined) {
    const analysis = analyzeSocialSentimentValuation(input.sentiment.socialSentiment);
    analysis.weight = weights.socialSentiment;
    metrics.push(analysis);
    weightedScore += analysis.normalizedScore * analysis.weight * analysis.confidence;
    weightedConfidence += analysis.weight * analysis.confidence;
    totalWeight += analysis.weight;
  }

  // News Sentiment
  if (weights.newsSentiment && input.sentiment?.newsScore !== undefined) {
    const analysis = analyzeNewsSentimentValuation(input.sentiment.newsScore);
    analysis.weight = weights.newsSentiment;
    metrics.push(analysis);
    weightedScore += analysis.normalizedScore * analysis.weight * analysis.confidence;
    weightedConfidence += analysis.weight * analysis.confidence;
    totalWeight += analysis.weight;
  }

  // Funding Rate
  if (weights.fundingRate && input.sentiment?.fundingRate !== undefined) {
    const analysis = analyzeFundingRateValuation(input.sentiment.fundingRate);
    analysis.weight = weights.fundingRate;
    metrics.push(analysis);
    weightedScore += analysis.normalizedScore * analysis.weight * analysis.confidence;
    weightedConfidence += analysis.weight * analysis.confidence;
    totalWeight += analysis.weight;
  }

  // Calculate final scores
  const overvaluationScore = totalWeight > 0 ? weightedScore / totalWeight : 0.5;
  const confidence = totalWeight > 0 ? weightedConfidence / totalWeight : 0;
  const riskLevel = getValuationRiskLevel(overvaluationScore);

  return {
    timeframe,
    label: TIMEFRAME_LABELS[timeframe],
    overvaluationScore,
    riskLevel,
    metrics,
    confidence,
  };
};

/**
 * Extract key drivers from all timeframe assessments
 */
export const extractKeyDrivers = (
  shortTerm: TimeframeAssessment,
  mediumTerm: TimeframeAssessment,
  longTerm: TimeframeAssessment
): ValuationDriver[] => {
  const allMetrics: Array<MetricAnalysis & { timeframe: string }> = [
    ...shortTerm.metrics.map((m) => ({ ...m, timeframe: '단기' })),
    ...mediumTerm.metrics.map((m) => ({ ...m, timeframe: '중기' })),
    ...longTerm.metrics.map((m) => ({ ...m, timeframe: '장기' })),
  ];

  // Calculate contribution (deviation from neutral * weight)
  const withContribution = allMetrics.map((m) => ({
    ...m,
    contribution: Math.abs(m.normalizedScore - 0.5) * m.weight * m.confidence,
  }));

  // Sort by contribution and take top 5
  const sorted = withContribution.sort((a, b) => b.contribution - a.contribution);
  const top = sorted.slice(0, 5);

  return top.map((m) => ({
    metric: `${m.nameKo} (${m.timeframe})`,
    contribution: m.contribution,
    direction:
      m.normalizedScore < 0.4 ? 'bullish' : m.normalizedScore > 0.6 ? 'bearish' : 'neutral',
    reason: m.reason,
    severity: m.contribution > 0.15 ? 'high' : m.contribution > 0.08 ? 'medium' : 'low',
  }));
};

/**
 * Generate action recommendation based on valuation score
 */
const generateRecommendation = (
  score: number,
  drivers: ValuationDriver[]
): ValuationRiskResult['recommendation'] => {
  const highSeverityBearish = drivers.filter(
    (d) => d.direction === 'bearish' && d.severity === 'high'
  ).length;

  let action: ValuationRiskResult['recommendation']['action'];
  let reason: string;
  let urgency: 'low' | 'medium' | 'high';

  if (score < 0.25) {
    action = 'ACCUMULATE';
    reason = '저평가 구간 - 적극적 매수 기회';
    urgency = score < 0.15 ? 'high' : 'medium';
  } else if (score < 0.45) {
    action = 'ACCUMULATE';
    reason = '적정가 이하 - 점진적 매수 고려';
    urgency = 'low';
  } else if (score < 0.6) {
    action = 'HOLD';
    reason = '적정 가치 구간 - 현 포지션 유지';
    urgency = 'low';
  } else if (score < 0.75) {
    action = 'REDUCE';
    reason = '고평가 구간 - 일부 익절 권장';
    urgency = highSeverityBearish >= 2 ? 'high' : 'medium';
  } else {
    action = 'EXIT';
    reason = '극단적 고평가 - 대부분 포지션 정리 권장';
    urgency = 'high';
  }

  return { action, reason, urgency };
};

// ============================================
// Main Calculation Function
// ============================================

/**
 * Calculate comprehensive valuation risk for an asset
 */
export const calculateValuationRisk = (
  input: ValuationInputData
): ValuationRiskResult => {
  // Get asset category
  const category = getAssetCategory(input.symbol) as AssetCategory;

  // Calculate timeframe assessments
  const shortTerm = calculateTimeframeAssessment('short', input, category);
  const mediumTerm = calculateTimeframeAssessment('medium', input, category);
  const longTerm = calculateTimeframeAssessment('long', input, category);

  // Calculate composite score with timeframe weights
  const compositeScore =
    shortTerm.overvaluationScore * COMPOSITE_TIMEFRAME_WEIGHTS.short +
    mediumTerm.overvaluationScore * COMPOSITE_TIMEFRAME_WEIGHTS.medium +
    longTerm.overvaluationScore * COMPOSITE_TIMEFRAME_WEIGHTS.long;

  // Extract key drivers
  const keyDrivers = extractKeyDrivers(shortTerm, mediumTerm, longTerm);

  // Calculate confidence metrics
  const allMetrics = [
    ...shortTerm.metrics,
    ...mediumTerm.metrics,
    ...longTerm.metrics,
  ];
  const dataCompleteness =
    allMetrics.length > 0
      ? allMetrics.filter((m) => m.confidence > 0).length / allMetrics.length
      : 0;
  const overallConfidence =
    shortTerm.confidence * COMPOSITE_TIMEFRAME_WEIGHTS.short +
    mediumTerm.confidence * COMPOSITE_TIMEFRAME_WEIGHTS.medium +
    longTerm.confidence * COMPOSITE_TIMEFRAME_WEIGHTS.long;

  // Generate recommendation
  const recommendation = generateRecommendation(compositeScore, keyDrivers);

  return {
    symbol: input.symbol,
    timestamp: new Date(),
    compositeScore,
    riskLevel: getValuationRiskLevel(compositeScore),
    shortTerm,
    mediumTerm,
    longTerm,
    keyDrivers,
    confidence: {
      overall: overallConfidence,
      dataCompleteness,
      isEstimated: input.symbol !== 'BTC',
      estimationMethod: input.symbol !== 'BTC' ? 'BTC 상관관계 기반 추정' : undefined,
    },
    recommendation,
  };
};

// ============================================
// Altcoin Estimation Functions
// ============================================

/**
 * Estimate altcoin valuation metrics based on BTC correlation
 */
export const estimateAltcoinValuation = (
  symbol: string,
  btcData: ValuationInputData,
  altcoinPrice: number,
  altcoinMa200?: number
): ValuationInputData => {
  const category = getAssetCategory(symbol) as AssetCategory;
  const thresholds = CATEGORY_VALUATION_THRESHOLDS[category];
  const beta = thresholds.betaToBtc;

  // Estimate MVRV based on BTC MVRV adjusted by beta
  const estimatedMvrv =
    btcData.mvrv !== undefined
      ? adjustMetricByBeta(btcData.mvrv, beta, 0.5, 5.0)
      : undefined;

  // NVT estimation - altcoins typically have higher NVT
  const estimatedNvt =
    btcData.nvt !== undefined ? btcData.nvt * (1 + (beta - 1) * 0.3) : undefined;

  // Exchange netflow - scale by beta
  const estimatedNetflow =
    btcData.exchangeNetflow !== undefined
      ? btcData.exchangeNetflow * beta
      : undefined;

  return {
    symbol,
    currentPrice: altcoinPrice,
    mvrv: estimatedMvrv,
    nvt: estimatedNvt,
    exchangeNetflow: estimatedNetflow,
    ma200: altcoinMa200,
    fearGreed: btcData.fearGreed, // Same market sentiment
    kimchiPremium: btcData.kimchiPremium,
  };
};

/**
 * Get default valuation data for altcoins when BTC data unavailable
 */
export const getDefaultAltcoinValuation = (
  symbol: string,
  currentPrice: number,
  fearGreed?: number
): ValuationInputData => {
  return {
    symbol,
    currentPrice,
    fearGreed: fearGreed ?? 50,
  };
};
