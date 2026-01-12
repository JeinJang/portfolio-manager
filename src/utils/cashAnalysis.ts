import type {
  IndicatorAnalysis,
  CashRecommendation,
  RiskLevel,
  ActionType,
} from '../types';

// ============================================
// Indicator Weights
// ============================================

const WEIGHTS: Record<string, number> = {
  fearGreed: 0.20,
  mvrv: 0.15,
  kimchiPremium: 0.10,
  exchangeFlow: 0.15,
  dxy: 0.10,
  marketTrend: 0.15,
  volatility: 0.15,
};

// ============================================
// Fear & Greed Analysis
// ============================================

export const analyzeFearGreed = (value: number): IndicatorAnalysis => {
  if (value <= 25) {
    return {
      score: 20,
      action: 'REDUCE_CASH',
      reason: '극단적 공포 - 매수 기회',
      value,
    };
  }
  if (value <= 45) {
    return {
      score: 40,
      action: 'NEUTRAL',
      reason: '공포 구간 - 점진적 매수 고려',
      value,
    };
  }
  if (value <= 55) {
    return {
      score: 50,
      action: 'NEUTRAL',
      reason: '중립 구간 - 현금 유지',
      value,
    };
  }
  if (value <= 75) {
    return {
      score: 70,
      action: 'INCREASE_CASH',
      reason: '탐욕 구간 - 익절 고려',
      value,
    };
  }
  return {
    score: 90,
    action: 'MAX_CASH',
    reason: '극단적 탐욕 - 리스크 관리 필요',
    value,
  };
};

// ============================================
// MVRV Ratio Analysis
// ============================================

export const analyzeMVRV = (value: number): IndicatorAnalysis => {
  if (value < 1) {
    return {
      score: 10,
      action: 'REDUCE_CASH',
      reason: 'MVRV < 1 - 역사적 바닥',
      value,
    };
  }
  if (value < 2) {
    return {
      score: 30,
      action: 'REDUCE_CASH',
      reason: 'MVRV 저평가 구간',
      value,
    };
  }
  if (value < 3) {
    return {
      score: 50,
      action: 'NEUTRAL',
      reason: 'MVRV 적정 구간',
      value,
    };
  }
  if (value < 4) {
    return {
      score: 75,
      action: 'INCREASE_CASH',
      reason: 'MVRV 고평가 - 익절 고려',
      value,
    };
  }
  return {
    score: 95,
    action: 'MAX_CASH',
    reason: 'MVRV 극고평가 - 사이클 천장 신호',
    value,
  };
};

// ============================================
// Kimchi Premium Analysis
// ============================================

export const analyzeKimchiPremium = (value: number): IndicatorAnalysis => {
  if (value < -2) {
    return {
      score: 20,
      action: 'REDUCE_CASH',
      reason: '역프리미엄 - 국내 매수 기회',
      value,
    };
  }
  if (value < 2) {
    return {
      score: 50,
      action: 'NEUTRAL',
      reason: '프리미엄 정상 범위',
      value,
    };
  }
  if (value < 5) {
    return {
      score: 60,
      action: 'NEUTRAL',
      reason: '약간의 프리미엄',
      value,
    };
  }
  if (value < 10) {
    return {
      score: 80,
      action: 'INCREASE_CASH',
      reason: '과열 신호 - 주의',
      value,
    };
  }
  return {
    score: 95,
    action: 'MAX_CASH',
    reason: '극단적 과열 - 국내 매도 고려',
    value,
  };
};

// ============================================
// Exchange Flow Analysis
// ============================================

export const analyzeExchangeFlow = (netFlow: number): IndicatorAnalysis => {
  if (netFlow < -10000) {
    return {
      score: 20,
      action: 'REDUCE_CASH',
      reason: '대규모 거래소 유출 - 강한 축적',
      value: netFlow,
    };
  }
  if (netFlow < -5000) {
    return {
      score: 35,
      action: 'REDUCE_CASH',
      reason: '거래소 유출 - 축적 신호',
      value: netFlow,
    };
  }
  if (netFlow < 5000) {
    return {
      score: 50,
      action: 'NEUTRAL',
      reason: '유출입 균형',
      value: netFlow,
    };
  }
  if (netFlow < 10000) {
    return {
      score: 70,
      action: 'INCREASE_CASH',
      reason: '거래소 유입 - 매도 압력',
      value: netFlow,
    };
  }
  return {
    score: 90,
    action: 'MAX_CASH',
    reason: '대규모 거래소 유입 - 강한 매도 압력',
    value: netFlow,
  };
};

// ============================================
// 200 MA Trend Analysis
// ============================================

export const analyzeMarketTrend = (
  currentPrice: number,
  ma200: number
): IndicatorAnalysis => {
  if (ma200 === 0) {
    return { score: 50, action: 'NEUTRAL', reason: '데이터 없음', value: 0 };
  }

  const deviation = ((currentPrice - ma200) / ma200) * 100;

  if (deviation < -30) {
    return {
      score: 15,
      action: 'REDUCE_CASH',
      reason: '200MA 대비 -30% 이상 - 극단적 저평가',
      value: deviation,
    };
  }
  if (deviation < -10) {
    return {
      score: 30,
      action: 'REDUCE_CASH',
      reason: '200MA 아래 - 저평가 구간',
      value: deviation,
    };
  }
  if (deviation < 30) {
    return {
      score: 50,
      action: 'NEUTRAL',
      reason: '200MA 근처 - 적정 구간',
      value: deviation,
    };
  }
  if (deviation < 60) {
    return {
      score: 70,
      action: 'INCREASE_CASH',
      reason: '200MA 대비 과열',
      value: deviation,
    };
  }
  return {
    score: 90,
    action: 'MAX_CASH',
    reason: '200MA 대비 극단적 과열',
    value: deviation,
  };
};

// ============================================
// Volatility (VIX) Analysis
// ============================================

export const analyzeVolatility = (vix: number): IndicatorAnalysis => {
  if (vix < 15) {
    return {
      score: 40,
      action: 'NEUTRAL',
      reason: '낮은 변동성 - 안정적',
      value: vix,
    };
  }
  if (vix < 20) {
    return {
      score: 50,
      action: 'NEUTRAL',
      reason: '정상 변동성',
      value: vix,
    };
  }
  if (vix < 30) {
    return {
      score: 65,
      action: 'INCREASE_CASH',
      reason: '높은 변동성 - 주의',
      value: vix,
    };
  }
  if (vix < 40) {
    return {
      score: 80,
      action: 'INCREASE_CASH',
      reason: '매우 높은 변동성',
      value: vix,
    };
  }
  return {
    score: 90,
    action: 'MAX_CASH',
    reason: '극단적 변동성 - 리스크 관리 최우선',
    value: vix,
  };
};

// ============================================
// NVT Ratio Analysis
// ============================================

export const analyzeNVT = (nvt: number): IndicatorAnalysis => {
  if (nvt < 45) {
    return {
      score: 25,
      action: 'REDUCE_CASH',
      reason: 'NVT 저평가 - 네트워크 활동 대비 저가',
      value: nvt,
    };
  }
  if (nvt < 65) {
    return {
      score: 50,
      action: 'NEUTRAL',
      reason: 'NVT 적정 구간',
      value: nvt,
    };
  }
  if (nvt < 90) {
    return {
      score: 70,
      action: 'INCREASE_CASH',
      reason: 'NVT 고평가 - 주의',
      value: nvt,
    };
  }
  return {
    score: 85,
    action: 'MAX_CASH',
    reason: 'NVT 과열 - 네트워크 활동 대비 고가',
    value: nvt,
  };
};

// ============================================
// Active Addresses Analysis
// ============================================

export const analyzeActiveAddresses = (
  current: number,
  average30d: number
): IndicatorAnalysis => {
  if (average30d === 0) {
    return { score: 50, action: 'NEUTRAL', reason: '데이터 없음', value: 0 };
  }

  const ratio = (current / average30d) * 100;

  if (ratio > 130) {
    return {
      score: 70,
      action: 'INCREASE_CASH',
      reason: '활성 주소 급증 - 과열 가능성',
      value: ratio,
    };
  }
  if (ratio > 90) {
    return {
      score: 50,
      action: 'NEUTRAL',
      reason: '활성 주소 정상 범위',
      value: ratio,
    };
  }
  return {
    score: 35,
    action: 'REDUCE_CASH',
    reason: '활성 주소 감소 - 축적 기회',
    value: ratio,
  };
};

// ============================================
// Comprehensive Cash Allocation Calculator
// ============================================

interface IndicatorInputs {
  fearGreed?: number;
  mvrv?: number;
  kimchiPremium?: number;
  exchangeFlow?: number;
  currentPrice?: number;
  ma200?: number;
  vix?: number;
  nvt?: number;
  activeAddresses?: number;
  activeAddresses30dAvg?: number;
}

export const calculateRecommendedCashAllocation = (
  indicators: IndicatorInputs
): CashRecommendation => {
  const analyses: Record<string, IndicatorAnalysis> = {
    fearGreed: analyzeFearGreed(indicators.fearGreed ?? 50),
    mvrv: analyzeMVRV(indicators.mvrv ?? 2),
    kimchiPremium: analyzeKimchiPremium(indicators.kimchiPremium ?? 0),
    exchangeFlow: analyzeExchangeFlow(indicators.exchangeFlow ?? 0),
    marketTrend: analyzeMarketTrend(
      indicators.currentPrice ?? 0,
      indicators.ma200 ?? indicators.currentPrice ?? 0
    ),
    volatility: analyzeVolatility(indicators.vix ?? 20),
  };

  // Add NVT if available
  if (indicators.nvt !== undefined) {
    analyses.nvt = analyzeNVT(indicators.nvt);
  }

  // Calculate weighted average score
  let totalScore = 0;
  let totalWeight = 0;

  Object.keys(WEIGHTS).forEach((key) => {
    if (analyses[key]) {
      totalScore += analyses[key].score * WEIGHTS[key];
      totalWeight += WEIGHTS[key];
    }
  });

  const finalScore = totalWeight > 0 ? totalScore / totalWeight : 50;

  // Convert score to cash allocation
  let recommendedCash: number;
  let riskLevel: RiskLevel;
  let strategy: string;

  if (finalScore <= 25) {
    recommendedCash = 10;
    riskLevel = 'AGGRESSIVE';
    strategy = '공격적 투자 - 현금 최소화, 적극 매수';
  } else if (finalScore <= 40) {
    recommendedCash = 20;
    riskLevel = 'GROWTH';
    strategy = '성장 투자 - 점진적 매수, 기회 포착';
  } else if (finalScore <= 55) {
    recommendedCash = 25;
    riskLevel = 'BALANCED';
    strategy = '균형 투자 - 현 포지션 유지';
  } else if (finalScore <= 70) {
    recommendedCash = 35;
    riskLevel = 'CAUTIOUS';
    strategy = '신중 투자 - 익절 고려, 현금 확보';
  } else if (finalScore <= 85) {
    recommendedCash = 45;
    riskLevel = 'DEFENSIVE';
    strategy = '방어적 투자 - 리스크 축소, 현금 비중 확대';
  } else {
    recommendedCash = 55;
    riskLevel = 'PRESERVATION';
    strategy = '자산 보존 - 최대 현금 비중, 시장 관망';
  }

  return {
    score: Math.round(finalScore),
    recommendedCash,
    riskLevel,
    strategy,
    analyses,
    breakdown: Object.entries(analyses).map(([key, value]) => ({
      indicator: key,
      score: value.score,
      weight: WEIGHTS[key] || 0,
      contribution: value.score * (WEIGHTS[key] || 0),
      action: value.action,
      reason: value.reason,
    })),
  };
};

// ============================================
// Rebalancing Actions Generator
// ============================================

interface RebalanceInput {
  currentCash: number;
  totalValue: number;
  recommendedCashPercent: number;
}

interface RebalanceResult {
  currentCashPercent: number;
  recommendedCashPercent: number;
  difference: number;
  actions: {
    type: 'INCREASE_CASH' | 'DECREASE_CASH' | 'HOLD';
    amount: number;
    description: string;
    suggestion: string;
  }[];
}

export const generateRebalanceActions = ({
  currentCash,
  totalValue,
  recommendedCashPercent,
}: RebalanceInput): RebalanceResult => {
  const currentCashPercent = (currentCash / totalValue) * 100;
  const cashDiff = recommendedCashPercent - currentCashPercent;
  const cashValueChange = (cashDiff / 100) * totalValue;

  const actions: RebalanceResult['actions'] = [];

  if (Math.abs(cashDiff) > 2) {
    if (cashDiff > 0) {
      actions.push({
        type: 'INCREASE_CASH',
        amount: cashValueChange,
        description: `현금 비중을 ${currentCashPercent.toFixed(1)}%에서 ${recommendedCashPercent}%로 증가`,
        suggestion: '수익률 높은 자산부터 일부 익절 권장',
      });
    } else {
      actions.push({
        type: 'DECREASE_CASH',
        amount: Math.abs(cashValueChange),
        description: `현금 비중을 ${currentCashPercent.toFixed(1)}%에서 ${recommendedCashPercent}%로 감소`,
        suggestion: '저평가된 자산 매수 권장',
      });
    }
  } else {
    actions.push({
      type: 'HOLD',
      amount: 0,
      description: '현금 비중 적정',
      suggestion: '현재 포지션 유지',
    });
  }

  return {
    currentCashPercent,
    recommendedCashPercent,
    difference: cashDiff,
    actions,
  };
};

// ============================================
// Indicator Labels (Korean)
// ============================================

export const INDICATOR_LABELS: Record<string, string> = {
  fearGreed: 'Fear & Greed',
  mvrv: 'MVRV Ratio',
  kimchiPremium: '김치 프리미엄',
  exchangeFlow: '거래소 유출입',
  marketTrend: '200MA 대비',
  volatility: 'VIX 변동성',
  nvt: 'NVT Ratio',
  activeAddresses: '활성 주소',
};

// ============================================
// Asset Target Allocation Rationale
// ============================================

export interface AssetTargetRationale {
  symbol: string;
  targetPercent: number;
  category: 'core' | 'major' | 'growth' | 'speculative';
  rationale: string;
  factors: {
    factor: string;
    impact: 'positive' | 'neutral' | 'negative';
    description: string;
  }[];
}

// 자산별 특성 정보
const ASSET_CHARACTERISTICS: Record<string, {
  category: 'core' | 'major' | 'growth' | 'speculative';
  marketCapRank: number;
  volatility: 'low' | 'medium' | 'high' | 'very_high';
  adoption: 'institutional' | 'retail' | 'emerging';
  useCase: string;
}> = {
  BTC: {
    category: 'core',
    marketCapRank: 1,
    volatility: 'medium',
    adoption: 'institutional',
    useCase: '가치 저장, 디지털 금',
  },
  ETH: {
    category: 'core',
    marketCapRank: 2,
    volatility: 'medium',
    adoption: 'institutional',
    useCase: '스마트 컨트랙트 플랫폼',
  },
  XRP: {
    category: 'major',
    marketCapRank: 5,
    volatility: 'high',
    adoption: 'institutional',
    useCase: '국제 송금, 결제',
  },
  SOL: {
    category: 'growth',
    marketCapRank: 6,
    volatility: 'high',
    adoption: 'retail',
    useCase: '고속 스마트 컨트랙트',
  },
  DOGE: {
    category: 'speculative',
    marketCapRank: 10,
    volatility: 'very_high',
    adoption: 'retail',
    useCase: '밈 코인, 커뮤니티',
  },
  ADA: {
    category: 'major',
    marketCapRank: 8,
    volatility: 'high',
    adoption: 'retail',
    useCase: '학술 기반 스마트 컨트랙트',
  },
  AVAX: {
    category: 'growth',
    marketCapRank: 12,
    volatility: 'high',
    adoption: 'retail',
    useCase: '서브넷 확장성',
  },
  DOT: {
    category: 'growth',
    marketCapRank: 15,
    volatility: 'high',
    adoption: 'retail',
    useCase: '크로스체인 상호운용성',
  },
  MATIC: {
    category: 'growth',
    marketCapRank: 14,
    volatility: 'high',
    adoption: 'retail',
    useCase: '이더리움 L2 스케일링',
  },
  LINK: {
    category: 'major',
    marketCapRank: 13,
    volatility: 'high',
    adoption: 'institutional',
    useCase: '오라클 데이터 피드',
  },
};

// 카테고리별 기본 비중 범위
const CATEGORY_ALLOCATION: Record<string, { min: number; max: number; description: string }> = {
  core: { min: 15, max: 30, description: '핵심 자산 - 포트폴리오의 기반, 안정성 제공' },
  major: { min: 5, max: 15, description: '주요 자산 - 검증된 프로젝트, 중간 비중' },
  growth: { min: 3, max: 10, description: '성장 자산 - 높은 성장 잠재력, 리스크 관리 필요' },
  speculative: { min: 1, max: 5, description: '투기 자산 - 고위험 고수익, 최소 비중' },
};

// 카테고리별 리밸런싱 임계값 (변동성 기반)
// - core: 안정적인 자산이므로 더 넓은 허용 범위 (3%)
// - major: 검증된 프로젝트로 중간 허용 범위 (2.5%)
// - growth: 성장 자산으로 기본 허용 범위 (2%)
// - speculative: 고변동성 자산이므로 더 엄격한 관리 (1.5%)
const VOLATILITY_ADJUSTED_THRESHOLDS: Record<string, number> = {
  core: 3.0,
  major: 2.5,
  growth: 2.0,
  speculative: 1.5,
};

/**
 * 자산의 카테고리를 반환합니다.
 * @param symbol 자산 심볼 (예: 'BTC', 'ETH')
 * @returns 자산 카테고리 ('core' | 'major' | 'growth' | 'speculative')
 */
export const getAssetCategory = (symbol: string): 'core' | 'major' | 'growth' | 'speculative' => {
  const characteristics = ASSET_CHARACTERISTICS[symbol];
  return characteristics?.category || 'speculative';
};

/**
 * 변동성 조정 리밸런싱 임계값을 반환합니다.
 * 자산 카테고리에 따라 다른 임계값을 적용하여 불필요한 거래를 줄입니다.
 * - Core 자산 (BTC, ETH): ±3% - 안정적이므로 넓은 허용 범위
 * - Major 자산 (XRP, ADA, LINK): ±2.5% - 검증된 프로젝트
 * - Growth 자산 (SOL, AVAX, DOT, MATIC): ±2% - 기본 허용 범위
 * - Speculative 자산 (DOGE 등): ±1.5% - 고변동성으로 엄격한 관리
 *
 * @param symbol 자산 심볼 (예: 'BTC', 'ETH')
 * @returns 리밸런싱 임계값 (퍼센트)
 */
export const getVolatilityAdjustedThreshold = (symbol: string): number => {
  const category = getAssetCategory(symbol);
  return VOLATILITY_ADJUSTED_THRESHOLDS[category] || 2.0;
};

export const generateAssetTargetRationale = (
  symbol: string,
  targetPercent: number,
  riskLevel: RiskLevel,
  marketConditions?: {
    fearGreed?: number;
    mvrv?: number;
    kimchiPremium?: number;
  }
): AssetTargetRationale => {
  const characteristics = ASSET_CHARACTERISTICS[symbol] || {
    category: 'speculative' as const,
    marketCapRank: 100,
    volatility: 'high' as const,
    adoption: 'retail' as const,
    useCase: '알 수 없음',
  };

  const categoryInfo = CATEGORY_ALLOCATION[characteristics.category];
  const factors: AssetTargetRationale['factors'] = [];

  // 1. 시가총액 순위 기반 분석
  if (characteristics.marketCapRank <= 2) {
    factors.push({
      factor: '시가총액 순위',
      impact: 'positive',
      description: `시총 ${characteristics.marketCapRank}위 - 시장 지배력과 유동성이 높아 안정적`,
    });
  } else if (characteristics.marketCapRank <= 10) {
    factors.push({
      factor: '시가총액 순위',
      impact: 'neutral',
      description: `시총 ${characteristics.marketCapRank}위 - 검증된 프로젝트이나 변동성 존재`,
    });
  } else {
    factors.push({
      factor: '시가총액 순위',
      impact: 'negative',
      description: `시총 ${characteristics.marketCapRank}위 - 상대적으로 낮은 유동성, 변동성 주의`,
    });
  }

  // 2. 변동성 분석
  const volatilityImpact = {
    low: { impact: 'positive' as const, desc: '낮은 변동성으로 안정적인 수익 기대' },
    medium: { impact: 'neutral' as const, desc: '적정 수준의 변동성' },
    high: { impact: 'negative' as const, desc: '높은 변동성으로 리스크 관리 필요' },
    very_high: { impact: 'negative' as const, desc: '매우 높은 변동성, 소량 투자 권장' },
  };
  factors.push({
    factor: '변동성',
    impact: volatilityImpact[characteristics.volatility].impact,
    description: volatilityImpact[characteristics.volatility].desc,
  });

  // 3. 기관 채택도
  if (characteristics.adoption === 'institutional') {
    factors.push({
      factor: '기관 채택',
      impact: 'positive',
      description: '기관 투자자 참여로 가격 지지력 확보',
    });
  } else if (characteristics.adoption === 'retail') {
    factors.push({
      factor: '기관 채택',
      impact: 'neutral',
      description: '개인 투자자 중심, 변동성 높음',
    });
  }

  // 4. 리스크 레벨에 따른 조정
  const riskAdjustment = {
    AGGRESSIVE: '공격적 투자 환경으로 성장 자산 비중 확대 가능',
    GROWTH: '성장 투자 환경으로 균형잡힌 비중 유지',
    BALANCED: '균형 투자 환경으로 핵심 자산 중심 배분',
    CAUTIOUS: '신중 투자 환경으로 안전 자산 비중 확대',
    DEFENSIVE: '방어적 환경으로 핵심 자산 집중, 리스크 자산 축소',
    PRESERVATION: '자산 보존 환경으로 최소 리스크 노출',
  };
  factors.push({
    factor: '시장 환경',
    impact: riskLevel === 'AGGRESSIVE' || riskLevel === 'GROWTH' ? 'positive' :
            riskLevel === 'BALANCED' ? 'neutral' : 'negative',
    description: riskAdjustment[riskLevel],
  });

  // 5. 사용처/유틸리티
  factors.push({
    factor: '유틸리티',
    impact: 'neutral',
    description: characteristics.useCase,
  });

  // 근거 문장 생성
  const categoryKo = {
    core: '핵심',
    major: '주요',
    growth: '성장',
    speculative: '투기',
  };

  const rationale = `${symbol}은(는) ${categoryKo[characteristics.category]} 자산으로 분류되며, ` +
    `시가총액 ${characteristics.marketCapRank}위의 ${characteristics.useCase} 프로젝트입니다. ` +
    `${categoryInfo.description}에 해당하여 권장 비중 범위는 ${categoryInfo.min}~${categoryInfo.max}%입니다. ` +
    `현재 ${riskLevel} 시장 환경을 고려하여 목표 비중 ${targetPercent}%를 설정했습니다.`;

  return {
    symbol,
    targetPercent,
    category: characteristics.category,
    rationale,
    factors,
  };
};

// 기본 목표 비중 계산
export const calculateDynamicTargets = (
  symbols: string[],
  riskLevel: RiskLevel,
  cashPercent: number
): Record<string, number> => {
  const targets: Record<string, number> = { CASH: cashPercent };
  const remainingPercent = 100 - cashPercent;

  // 각 심볼별 가중치 계산
  const weights: Record<string, number> = {};
  let totalWeight = 0;

  symbols.forEach(symbol => {
    const char = ASSET_CHARACTERISTICS[symbol];
    if (!char) {
      weights[symbol] = 1;
      totalWeight += 1;
      return;
    }

    // 카테고리별 기본 가중치
    const categoryWeight = {
      core: 4,
      major: 2,
      growth: 1.5,
      speculative: 0.5,
    };

    // 시총 순위 기반 가중치 (순위가 높을수록 높은 가중치)
    const rankWeight = Math.max(1, 5 - Math.log10(char.marketCapRank));

    // 리스크 레벨에 따른 조정
    const riskMultiplier = {
      AGGRESSIVE: { core: 0.8, major: 1.2, growth: 1.5, speculative: 1.3 },
      GROWTH: { core: 0.9, major: 1.1, growth: 1.3, speculative: 1.1 },
      BALANCED: { core: 1, major: 1, growth: 1, speculative: 1 },
      CAUTIOUS: { core: 1.2, major: 1, growth: 0.8, speculative: 0.6 },
      DEFENSIVE: { core: 1.4, major: 0.9, growth: 0.6, speculative: 0.4 },
      PRESERVATION: { core: 1.6, major: 0.8, growth: 0.4, speculative: 0.2 },
    };

    const weight = categoryWeight[char.category] * rankWeight *
                   riskMultiplier[riskLevel][char.category];
    weights[symbol] = weight;
    totalWeight += weight;
  });

  // 비중 배분
  symbols.forEach(symbol => {
    const char = ASSET_CHARACTERISTICS[symbol];
    const category = char?.category || 'speculative';
    const categoryLimits = CATEGORY_ALLOCATION[category];

    let allocatedPercent = (weights[symbol] / totalWeight) * remainingPercent;

    // 카테고리별 최소/최대 비중 제한 적용
    allocatedPercent = Math.max(categoryLimits.min, Math.min(categoryLimits.max, allocatedPercent));

    targets[symbol] = Math.round(allocatedPercent);
  });

  return targets;
};
