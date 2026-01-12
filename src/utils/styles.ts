import type { ExchangeInfo, RiskLevel } from '../types';

// ============================================
// Color Palette
// ============================================

export const COLORS = {
  primary: '#00F5D4',
  secondary: '#7B61FF',
  accent: '#FF6B6B',
  warning: '#FFE66D',
  success: '#4ADE80',
  danger: '#EF4444',
  cash: '#60A5FA',

  dark: '#0A0A0F',
  darkAlt: '#12121A',
  card: '#1A1A25',
  cardHover: '#22222E',
  border: '#2A2A3A',

  text: '#E4E4E7',
  textMuted: '#71717A',
  textDark: '#18181B',
} as const;

// ============================================
// Chart Colors
// ============================================

export const CHART_COLORS: string[] = [
  '#00F5D4', // primary
  '#7B61FF', // secondary
  '#FF6B6B', // accent
  '#FFE66D', // warning
  '#4ADE80', // success
  '#60A5FA', // cash
  '#F472B6', // pink
  '#A78BFA', // purple light
  '#34D399', // emerald
  '#FBBF24', // amber
];

// ============================================
// Exchange Information
// ============================================

export const EXCHANGES: Record<string, ExchangeInfo> = {
  upbit: {
    name: 'Upbit',
    nameKo: '업비트',
    color: '#093687',
    fees: { maker: 0.05, taker: 0.05 },
    url: 'https://upbit.com',
  },
  bithumb: {
    name: 'Bithumb',
    nameKo: '빗썸',
    color: '#F37321',
    fees: { maker: 0.04, taker: 0.04 },
    url: 'https://bithumb.com',
  },
  binance: {
    name: 'Binance',
    nameKo: '바이낸스',
    color: '#F3BA2F',
    fees: { maker: 0.1, taker: 0.1 },
    url: 'https://binance.com',
  },
  coinbase: {
    name: 'Coinbase',
    nameKo: '코인베이스',
    color: '#0052FF',
    fees: { maker: 0.4, taker: 0.6 },
    url: 'https://coinbase.com',
  },
  stock_kr: {
    name: 'Korean Stock',
    nameKo: '국내증권',
    color: '#6B7280',
    fees: { maker: 0.015, taker: 0.015 },
    url: null,
  },
  stock_us: {
    name: 'US Stock',
    nameKo: '해외증권',
    color: '#3B82F6',
    fees: { maker: 0.25, taker: 0.25 },
    url: null,
  },
};

// ============================================
// Risk Level Colors
// ============================================

export const RISK_COLORS: Record<RiskLevel, string> = {
  AGGRESSIVE: '#EF4444',
  GROWTH: '#F59E0B',
  BALANCED: '#10B981',
  CAUTIOUS: '#3B82F6',
  DEFENSIVE: '#6366F1',
  PRESERVATION: '#8B5CF6',
};

// ============================================
// Fear & Greed Colors
// ============================================

export const FEAR_GREED_COLORS: Record<string, string> = {
  'Extreme Fear': '#EF4444',
  Fear: '#F97316',
  Neutral: '#EAB308',
  Greed: '#84CC16',
  'Extreme Greed': '#22C55E',
};

// ============================================
// Common Styles
// ============================================

export const commonStyles = {
  card: {
    background: COLORS.card,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 16,
    padding: 20,
  },
  cardHover: {
    background: COLORS.cardHover,
    borderColor: COLORS.primary,
    transform: 'translateY(-2px)',
    transition: 'all 0.2s ease',
  },
  button: {
    primary: {
      background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
      border: 'none',
      color: COLORS.dark,
      padding: '10px 20px',
      borderRadius: 8,
      fontWeight: 600,
      cursor: 'pointer',
    },
    secondary: {
      background: COLORS.border,
      border: 'none',
      color: COLORS.text,
      padding: '10px 20px',
      borderRadius: 8,
      cursor: 'pointer',
    },
  },
  input: {
    background: COLORS.darkAlt,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: '10px 12px',
    color: COLORS.text,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 14,
    outline: 'none',
  },
  badge: {
    padding: '3px 8px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
  },
  mono: {
    fontFamily: "'JetBrains Mono', monospace",
  },
} as const;

// ============================================
// Responsive Breakpoints
// ============================================

export const breakpoints = {
  mobile: '480px',
  tablet: '768px',
  laptop: '1024px',
  desktop: '1280px',
} as const;

// ============================================
// Utility Functions
// ============================================

export const formatNumber = (value: number, locale: string = 'ko-KR'): string => {
  return value.toLocaleString(locale);
};

export const formatCurrency = (
  value: number,
  currency: 'KRW' | 'USD' = 'KRW',
  exchangeRate: number = 1380
): string => {
  if (currency === 'USD') {
    return `$${(value / exchangeRate).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })}`;
  }
  return `₩${value.toLocaleString()}`;
};

export const formatPercent = (value: number, decimals: number = 1): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
};

export const getChangeColor = (value: number): string => {
  return value >= 0 ? COLORS.success : COLORS.danger;
};

// ============================================
// Crypto Symbol Icons (Emoji fallbacks)
// ============================================

export const CRYPTO_ICONS: Record<string, string> = {
  BTC: '₿',
  ETH: 'Ξ',
  XRP: '✕',
  SOL: '◎',
  DOGE: 'Ð',
  ADA: '₳',
  DOT: '●',
  AVAX: '🔺',
  MATIC: '⬡',
  LINK: '⬡',
  ATOM: '⚛',
  UNI: '🦄',
};

// ============================================
// Animation Keyframes CSS
// ============================================

export const animationCSS = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  input:focus {
    border-color: ${COLORS.primary} !important;
  }
`;
