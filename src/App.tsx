import React, { useState, useMemo, useCallback } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from "recharts";
import {
  useMarketData,
  useKimchiPremium,
  usePortfolioCalculation,
  useExchangeStatus,
  useBTCOnchain,
} from "./hooks/useMarketData";
import {
  useValuationRisk,
  usePortfolioValuationSummary,
} from "./hooks/useValuationRisk";
import type { ValuationRiskLevel } from "./utils/valuationRisk";
import { useRealPortfolio } from "./hooks/useExchangeBalances";
import {
  calculateRecommendedCashAllocation,
  INDICATOR_LABELS,
  generateAssetTargetRationale,
  getVolatilityAdjustedThreshold,
} from "./utils/cashAnalysis";
import {
  COLORS,
  CHART_COLORS,
  EXCHANGES,
  RISK_COLORS,
  FEAR_GREED_COLORS,
  formatCurrency,
  formatPercent,
  animationCSS,
} from "./utils/styles";
import { exchangeApi } from "./services/exchangeApi";
import type {
  Asset,
  CashHolding,
  TabType,
  TradeAction,
  ExchangeType,
} from "./types";

// ============================================
// Default Data
// ============================================

const DEFAULT_PORTFOLIO: Asset[] = [
  {
    id: "1",
    symbol: "BTC",
    name: "Bitcoin",
    type: "crypto",
    exchange: "upbit",
    amount: 0.5,
    avgPrice: 58000000,
  },
  {
    id: "2",
    symbol: "ETH",
    name: "Ethereum",
    type: "crypto",
    exchange: "upbit",
    amount: 5,
    avgPrice: 3036000,
  },
  {
    id: "3",
    symbol: "XRP",
    name: "Ripple",
    type: "crypto",
    exchange: "bithumb",
    amount: 5000,
    avgPrice: 850,
  },
  {
    id: "4",
    symbol: "SOL",
    name: "Solana",
    type: "crypto",
    exchange: "upbit",
    amount: 50,
    avgPrice: 110000,
  },
];

const DEFAULT_CASH: CashHolding[] = [
  { id: "krw", currency: "KRW", name: "원화", amount: 15000000, icon: "₩" },
  { id: "usd", currency: "USD", name: "달러", amount: 5000, icon: "$" },
  {
    id: "usdt",
    currency: "USDT",
    name: "테더",
    amount: 3000,
    exchange: "upbit",
    icon: "₮",
  },
];

const TARGET: Record<string, number> = {
  BTC: 20,
  ETH: 15,
  XRP: 5,
  SOL: 10,
  CASH: 50,
};

// ============================================
// Component Types
// ============================================

interface ExchangeBadgeProps {
  exchange: ExchangeType;
}

interface ModalProps {
  cash: CashHolding[];
  onSave: (cash: CashHolding[]) => void;
  onClose: () => void;
}

// ============================================
// Sub Components
// ============================================

const ExchangeBadge: React.FC<ExchangeBadgeProps> = ({ exchange }) => (
  <span
    style={{
      fontSize: 10,
      fontWeight: 600,
      padding: "2px 6px",
      borderRadius: 4,
      background: EXCHANGES[exchange]?.color || "#666",
      color: "#fff",
    }}
  >
    {EXCHANGES[exchange]?.nameKo || exchange}
  </span>
);

const CashModal: React.FC<ModalProps> = ({ cash, onSave, onClose }) => {
  const [amounts, setAmounts] = useState<Record<string, number>>(
    cash.reduce((acc, c) => ({ ...acc, [c.id]: c.amount }), {})
  );

  const handleSave = () => {
    onSave(cash.map((c) => ({ ...c, amount: amounts[c.id] || 0 })));
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          width: "90%",
          maxWidth: 400,
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <h3>현금 잔고 수정</h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: COLORS.textMuted,
              fontSize: 24,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
        {cash.map((c) => (
          <div key={c.id} style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, display: "block", marginBottom: 6 }}>
              {c.icon} {c.name}
            </label>
            <input
              type="number"
              value={amounts[c.id]}
              onChange={(e) =>
                setAmounts({
                  ...amounts,
                  [c.id]: parseFloat(e.target.value) || 0,
                })
              }
              style={{
                width: "100%",
                background: COLORS.darkAlt,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: 12,
                color: COLORS.text,
                fontFamily: "'JetBrains Mono'",
              }}
            />
          </div>
        ))}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: COLORS.border,
              border: "none",
              color: COLORS.text,
              padding: 12,
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
              border: "none",
              color: COLORS.dark,
              padding: 12,
              borderRadius: 8,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Main App Component
// ============================================

export default function App() {
  const [tab, setTab] = useState<TabType>("overview");
  const [showModal, setShowModal] = useState(false);
  const [currency, setCurrency] = useState<"KRW" | "USD">("KRW");
  const [executing, setExecuting] = useState(false);
  const [manualCash, setManualCash] = useState<CashHolding[] | null>(null);

  // Real portfolio from exchange APIs
  const {
    assets: realAssets,
    cash: realCash,
    symbols: portfolioSymbols,
    loading: portfolioLoading,
    error: portfolioError,
    lastUpdated: portfolioUpdated,
  } = useRealPortfolio(100000);

  // Use real assets or fallback to defaults
  const assets = realAssets.length > 0 ? realAssets : DEFAULT_PORTFOLIO;
  const cashHoldings =
    manualCash || (realCash.length > 0 ? realCash : DEFAULT_CASH);

  // Dynamic symbols based on actual holdings
  const marketSymbols =
    portfolioSymbols.length > 0
      ? portfolioSymbols
      : ["BTC", "ETH", "XRP", "SOL"];

  // Market data hooks with dynamic symbols
  const {
    data: market,
    loading: marketLoading,
    lastUpdated,
  } = useMarketData(60000, marketSymbols);
  const { premiums: kimchi, avgPremium } = useKimchiPremium(
    marketSymbols,
    120000
  );
  const { data: onchainData } = useBTCOnchain(100000);
  const { status: exchangeStatus } = useExchangeStatus(120000);

  const loading = portfolioLoading || marketLoading;

  // Calculate portfolio metrics
  const rate = market.exchangeRate || 1380;
  const calc = usePortfolioCalculation(
    assets,
    cashHoldings,
    market.prices,
    rate
  );

  // Analysis with real onchain data
  const analysis = useMemo(
    () =>
      calculateRecommendedCashAllocation({
        fearGreed: market.fearGreed?.value || 50,
        mvrv: onchainData?.mvrv || market.onchain?.mvrv || 1.8,
        kimchiPremium: avgPremium,
        exchangeFlow:
          onchainData?.exchangeNetflow || market.onchain?.exchangeNetflow || 0,
        vix: 20,
        nvt: onchainData?.nvt,
      }),
    [market.fearGreed, onchainData, market.onchain, avgPremium]
  );

  // Valuation risk analysis
  const valuationMarketData = useMemo(
    () => ({
      fearGreed: market.fearGreed?.value,
      kimchiPremium: avgPremium,
      prices: Object.fromEntries(
        Object.entries(market.prices).map(([k, v]) => [k, { price: v.price }])
      ),
    }),
    [market.fearGreed, avgPremium, market.prices]
  );

  const {
    results: valuationResults,
    btcResult: btcValuation,
    loading: valuationLoading,
  } = useValuationRisk(calc.assets, onchainData, valuationMarketData);

  const portfolioValuation = usePortfolioValuationSummary(
    valuationResults,
    calc.assets
  );

  // Format helper
  const fmt = useCallback(
    (v: number) => formatCurrency(v, currency, rate),
    [currency, rate]
  );

  // 지원되는 거래소 타입 (API 거래 가능)
  const SUPPORTED_EXCHANGES = ['upbit', 'bithumb'] as const;
  type SupportedExchange = typeof SUPPORTED_EXCHANGES[number];

  const isSupportedExchange = (exchange: ExchangeType): exchange is SupportedExchange => {
    return SUPPORTED_EXCHANGES.includes(exchange as SupportedExchange);
  };

  // Execute rebalancing
  const handleExecuteRebalance = async (
    action: TradeAction,
    symbol: string,
    exchange: ExchangeType,
    amount: number
  ) => {
    if (!isSupportedExchange(exchange)) {
      alert(`${EXCHANGES[exchange]?.nameKo || exchange}는 아직 자동 거래를 지원하지 않습니다.`);
      return;
    }

    if (!exchangeStatus[exchange]) {
      alert(
        `${EXCHANGES[exchange]?.nameKo} API 연결이 필요합니다.\n.env 파일에 API 키를 설정해주세요.`
      );
      return;
    }

    setExecuting(true);
    try {
      let result;
      if (action === "BUY") {
        result = await exchangeApi.marketBuy(exchange, symbol, amount);
      } else if (action === "SELL") {
        result = await exchangeApi.marketSell(exchange, symbol, amount);
      }

      if (result?.success) {
        alert(`${action} ${symbol} 주문이 실행되었습니다.`);
      } else {
        alert(`주문 실패: ${result?.error || "Unknown error"}`);
      }
    } catch (error) {
      alert(`주문 실행 중 오류가 발생했습니다.`);
    } finally {
      setExecuting(false);
    }
  };

  // ============================================
  // Overview Tab
  // ============================================

  const Overview = () => {
    const pieData = [
      ...calc.assets.map((a) => ({ name: a.symbol, value: a.value || 0 })),
      { name: "현금", value: calc.totalCash },
    ];

    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Total Portfolio */}
        <div
          style={{
            gridColumn: "1/-1",
            background: `linear-gradient(135deg, ${COLORS.card}, ${COLORS.darkAlt})`,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: COLORS.textMuted,
                textTransform: "uppercase",
              }}
            >
              총 포트폴리오
            </span>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() =>
                  setCurrency((c) => (c === "KRW" ? "USD" : "KRW"))
                }
                style={{
                  background: COLORS.border,
                  border: "none",
                  color: COLORS.text,
                  padding: "6px 12px",
                  borderRadius: 6,
                  fontFamily: "'JetBrains Mono'",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {currency}
              </button>
              <span
                style={{
                  background: "rgba(74,222,128,0.15)",
                  color: COLORS.success,
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: 11,
                }}
              >
                ● 실시간
              </span>
            </div>
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 700,
              fontFamily: "'JetBrains Mono'",
            }}
          >
            {fmt(calc.totalValue)}
          </div>
          <div
            style={{
              fontSize: 16,
              color: calc.totalPnl >= 0 ? COLORS.success : COLORS.danger,
              marginTop: 4,
            }}
          >
            {formatPercent(
              (calc.totalPnl / (calc.totalCrypto - calc.totalPnl)) * 100
            )}{" "}
            ({fmt(calc.totalPnl)})
          </div>
          <div
            style={{
              display: "flex",
              height: 10,
              borderRadius: 5,
              overflow: "hidden",
              background: COLORS.border,
              marginTop: 20,
            }}
          >
            <div
              style={{
                width: `${(calc.totalCrypto / calc.totalValue) * 100}%`,
                background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.secondary})`,
              }}
            />
            <div
              style={{
                width: `${calc.cashAllocation}%`,
                background: `linear-gradient(90deg, ${COLORS.cash}, #3B82F6)`,
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              gap: 20,
              marginTop: 8,
              fontSize: 11,
              color: COLORS.textMuted,
            }}
          >
            <span>
              크립토 {((calc.totalCrypto / calc.totalValue) * 100).toFixed(1)}%
            </span>
            <span>현금 {calc.cashAllocation.toFixed(1)}%</span>
          </div>
          {(lastUpdated || portfolioUpdated) && (
            <div
              style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 12 }}
            >
              업데이트:{" "}
              {(lastUpdated || portfolioUpdated)?.toLocaleTimeString()}
            </div>
          )}
          {portfolioError && (
            <div style={{ fontSize: 11, color: COLORS.warning, marginTop: 8 }}>
              ⚠️ {portfolioError}
            </div>
          )}
        </div>

        {/* Cash Panel */}
        <div
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            padding: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 13, color: COLORS.textMuted }}>
              💵 현금
            </span>
            <button
              onClick={() => setShowModal(true)}
              style={{
                background: COLORS.border,
                border: "none",
                color: COLORS.text,
                padding: "6px 12px",
                borderRadius: 6,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              수정
            </button>
          </div>
          <div
            style={{
              textAlign: "center",
              padding: "12px 0",
              borderBottom: `1px solid ${COLORS.border}`,
              marginBottom: 12,
            }}
          >
            <span
              style={{
                fontSize: 24,
                fontWeight: 700,
                fontFamily: "'JetBrains Mono'",
                color: COLORS.cash,
              }}
            >
              {fmt(calc.totalCash)}
            </span>
            <span
              style={{
                display: "block",
                marginTop: 6,
                background: "rgba(96,165,250,0.15)",
                color: COLORS.cash,
                padding: "4px 10px",
                borderRadius: 20,
                fontSize: 11,
              }}
            >
              {calc.cashAllocation.toFixed(1)}%
            </span>
          </div>
          {cashHoldings.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 10px",
                background: COLORS.darkAlt,
                borderRadius: 8,
                marginBottom: 6,
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span>{c.icon}</span>
                <span style={{ fontSize: 13 }}>{c.name}</span>
                {c.exchange && <ExchangeBadge exchange={c.exchange} />}
              </div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono'",
                  fontSize: 13,
                  textAlign: "right",
                }}
              >
                {c.icon}
                {c.amount.toLocaleString()}
                {c.currency !== "KRW" && (
                  <span
                    style={{
                      display: "block",
                      fontSize: 11,
                      color: COLORS.textMuted,
                    }}
                  >
                    ≈₩{(c.amount * rate).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          ))}
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 8,
              background: `${RISK_COLORS[analysis.riskLevel]}15`,
              border: `1px solid ${RISK_COLORS[analysis.riskLevel]}40`,
            }}
          >
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>
              AI 추천 현금 비중
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 4,
              }}
            >
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  fontFamily: "'JetBrains Mono'",
                  color: RISK_COLORS[analysis.riskLevel],
                }}
              >
                {analysis.recommendedCash}%
              </span>
              <span
                style={{
                  fontSize: 10,
                  padding: "3px 8px",
                  borderRadius: 4,
                  background: `${RISK_COLORS[analysis.riskLevel]}30`,
                  color: RISK_COLORS[analysis.riskLevel],
                }}
              >
                {analysis.riskLevel}
              </span>
            </div>
          </div>
        </div>

        {/* Pie Chart */}
        <div
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            padding: 20,
          }}
        >
          <span style={{ fontSize: 13, color: COLORS.textMuted }}>
            자산 배분
          </span>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                itemStyle={{
                  color: COLORS.textMuted,
                }}
                contentStyle={{
                  background: COLORS.card,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 8,
                }}
                formatter={(v: number) => [fmt(v), ""]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {pieData.map((p, i) => (
              <div
                key={p.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: CHART_COLORS[i % CHART_COLORS.length],
                  }}
                />
                {p.name}{" "}
                <span style={{ color: COLORS.textMuted }}>
                  {((p.value / calc.totalValue) * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Assets Table */}
        <div
          style={{
            gridColumn: "1/-1",
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            padding: 20,
          }}
        >
          <span style={{ fontSize: 13, color: COLORS.textMuted }}>
            보유 자산
          </span>
          <div style={{ marginTop: 12, overflowX: "auto" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "1.8fr 0.8fr 0.8fr 1fr 1fr 1fr 0.8fr 0.6fr",
                gap: 8,
                padding: "8px 12px",
                borderBottom: `1px solid ${COLORS.border}`,
                fontSize: 11,
                color: COLORS.textMuted,
                minWidth: 800,
              }}
            >
              <span>자산</span>
              <span>거래소</span>
              <span>보유량</span>
              <span>매수평균가</span>
              <span>현재가</span>
              <span>평가금액</span>
              <span>수익률</span>
              <span>24H</span>
            </div>
            {calc.assets.map((a, i) => (
              <div
                key={a.id}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1.8fr 0.8fr 0.8fr 1fr 1fr 1fr 0.8fr 0.6fr",
                  gap: 8,
                  padding: "12px",
                  alignItems: "center",
                  fontSize: 13,
                  borderBottom: `1px solid ${COLORS.border}22`,
                  minWidth: 800,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: CHART_COLORS[i % CHART_COLORS.length],
                    }}
                  />
                  <span
                    style={{ fontWeight: 600, fontFamily: "'JetBrains Mono'" }}
                  >
                    {a.symbol}
                  </span>
                  <span style={{ color: COLORS.textMuted, fontSize: 11 }}>
                    {a.name}
                  </span>
                </div>
                <ExchangeBadge exchange={a.exchange} />
                <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 12 }}>
                  {a.amount.toLocaleString(undefined, {
                    maximumFractionDigits: 8,
                  })}
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono'",
                    fontSize: 12,
                    color: COLORS.textMuted,
                  }}
                >
                  {fmt(a.avgPrice)}
                </span>
                <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 12 }}>
                  {fmt(a.currentPrice || 0)}
                </span>
                <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 12 }}>
                  {fmt(a.value || 0)}
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono'",
                    fontSize: 12,
                    color: (a.pnl || 0) >= 0 ? COLORS.success : COLORS.danger,
                  }}
                >
                  {formatPercent(a.pnl || 0)}
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono'",
                    color:
                      (a.change24h || 0) >= 0 ? COLORS.success : COLORS.danger,
                    fontSize: 12,
                  }}
                >
                  {formatPercent(a.change24h || 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ============================================
  // Macro Tab
  // ============================================

  const Macro = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {/* Fear & Greed */}
      <div
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: 20,
        }}
      >
        <h3 style={{ fontSize: 15, marginBottom: 16 }}>Fear & Greed Index</h3>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <svg viewBox="0 0 100 60" style={{ width: 150, height: 90 }}>
            <defs>
              <linearGradient id="fg" x1="0%" y1="0%" x2="100%">
                <stop offset="0%" stopColor="#EF4444" />
                <stop offset="50%" stopColor="#EAB308" />
                <stop offset="100%" stopColor="#22C55E" />
              </linearGradient>
            </defs>
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              fill="none"
              stroke={COLORS.border}
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              fill="none"
              stroke="url(#fg)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${(market.fearGreed?.value || 50) * 1.26} 126`}
            />
            <text
              x="50"
              y="40"
              textAnchor="middle"
              fill={COLORS.text}
              fontSize="20"
              fontWeight="bold"
            >
              {market.fearGreed?.value || 50}
            </text>
            <text
              x="50"
              y="55"
              textAnchor="middle"
              fill={COLORS.textMuted}
              fontSize="8"
            >
              {market.fearGreed?.classification || "Neutral"}
            </text>
          </svg>
          <div
            style={{
              marginTop: 12,
              padding: "8px 16px",
              borderRadius: 8,
              background: `${
                FEAR_GREED_COLORS[
                  market.fearGreed?.classification || "Neutral"
                ] || COLORS.warning
              }22`,
              color:
                FEAR_GREED_COLORS[
                  market.fearGreed?.classification || "Neutral"
                ] || COLORS.warning,
              fontSize: 13,
            }}
          >
            {market.fearGreed?.classification || "Neutral"}
          </div>
        </div>
      </div>

      {/* Exchange Rate & Kimchi */}
      <div
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: 20,
        }}
      >
        <h3 style={{ fontSize: 15, marginBottom: 16 }}>환율 & 김치 프리미엄</h3>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <div
            style={{
              background: COLORS.darkAlt,
              padding: 14,
              borderRadius: 10,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: COLORS.textMuted,
                display: "block",
              }}
            >
              USD/KRW
            </span>
            <span
              style={{
                fontSize: 20,
                fontWeight: 600,
                fontFamily: "'JetBrains Mono'",
              }}
            >
              ₩{rate.toLocaleString()}
            </span>
          </div>
          <div
            style={{
              background: COLORS.darkAlt,
              padding: 14,
              borderRadius: 10,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: COLORS.textMuted,
                display: "block",
              }}
            >
              평균 김프
            </span>
            <span
              style={{
                fontSize: 20,
                fontWeight: 600,
                fontFamily: "'JetBrains Mono'",
                color: avgPremium > 0 ? COLORS.success : COLORS.danger,
              }}
            >
              {formatPercent(avgPremium, 2)}
            </span>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>
            코인별 김프
          </span>
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}
          >
            {Object.entries(kimchi).map(([s, p]) => (
              <div
                key={s}
                style={{
                  padding: "6px 12px",
                  background: COLORS.darkAlt,
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >
                <span style={{ marginRight: 8 }}>{s}</span>
                <span
                  style={{
                    color: p > 0 ? COLORS.success : COLORS.danger,
                    fontFamily: "'JetBrains Mono'",
                  }}
                >
                  {formatPercent(p, 2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BTC Onchain */}
      <div
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: 20,
        }}
      >
        <h3 style={{ fontSize: 15, marginBottom: 16 }}>
          <span
            style={{
              background: "linear-gradient(135deg, #F7931A, #FFAB00)",
              padding: "3px 8px",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              color: COLORS.dark,
              marginRight: 8,
            }}
          >
            BTC
          </span>
          온체인 지표
        </h3>
        {onchainData ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { l: "해시레이트", v: `${onchainData.hashRate} EH/s` },
              { l: "난이도", v: `${onchainData.difficulty}T` },
              { l: "24h TX", v: onchainData.txCount24h?.toLocaleString() },
              { l: "MVRV", v: onchainData.mvrv?.toFixed(2) },
              { l: "NVT", v: onchainData.nvt?.toFixed(1) },
              {
                l: "활성 주소",
                v: onchainData.activeAddresses?.toLocaleString(),
              },
            ].map((m) => (
              <div
                key={m.l}
                style={{
                  padding: 12,
                  background: COLORS.darkAlt,
                  borderRadius: 8,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: 13 }}>{m.l}</span>
                <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 13 }}>
                  {m.v || "N/A"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: 20,
              color: COLORS.textMuted,
            }}
          >
            로딩 중...
          </div>
        )}
      </div>

      {/* AI Cash Strategy */}
      <div
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: 20,
        }}
      >
        <h3 style={{ fontSize: 15, marginBottom: 16 }}>AI 현금 전략</h3>
        <div
          style={{
            textAlign: "center",
            padding: 16,
            borderRadius: 12,
            background: `${RISK_COLORS[analysis.riskLevel]}15`,
            border: `1px solid ${RISK_COLORS[analysis.riskLevel]}40`,
          }}
        >
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>
            추천 현금 비중
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 700,
              fontFamily: "'JetBrains Mono'",
              color: RISK_COLORS[analysis.riskLevel],
            }}
          >
            {analysis.recommendedCash}%
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              padding: "6px 12px",
              borderRadius: 6,
              background: `${RISK_COLORS[analysis.riskLevel]}20`,
              color: RISK_COLORS[analysis.riskLevel],
              display: "inline-block",
            }}
          >
            {analysis.riskLevel}
          </div>
          <p style={{ marginTop: 12, fontSize: 13, color: COLORS.textMuted }}>
            {analysis.strategy}
          </p>
        </div>
        <div style={{ marginTop: 16 }}>
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>
            분석 근거
          </span>
          {analysis.breakdown.slice(0, 6).map((b) => (
            <div
              key={b.indicator}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 0",
                borderBottom: `1px solid ${COLORS.border}22`,
                fontSize: 12,
              }}
            >
              <span>{INDICATOR_LABELS[b.indicator] || b.indicator}</span>
              <span
                style={{
                  color:
                    b.score < 40
                      ? COLORS.success
                      : b.score > 60
                      ? COLORS.danger
                      : COLORS.warning,
                  fontFamily: "'JetBrains Mono'",
                }}
              >
                {b.score}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Exchange Status */}
      <div
        style={{
          gridColumn: "1/-1",
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: 20,
        }}
      >
        <h3 style={{ fontSize: 15, marginBottom: 16 }}>거래소 API 연결 상태</h3>
        <div style={{ display: "flex", gap: 20 }}>
          {["upbit", "bithumb"].map((ex) => (
            <div
              key={ex}
              style={{
                flex: 1,
                padding: 16,
                background: COLORS.darkAlt,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: exchangeStatus[ex as keyof typeof exchangeStatus]
                    ? COLORS.success
                    : COLORS.danger,
                }}
              />
              <div>
                <div style={{ fontWeight: 600 }}>{EXCHANGES[ex]?.nameKo}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>
                  {exchangeStatus[ex as keyof typeof exchangeStatus]
                    ? "연결됨"
                    : "API 키 필요"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ============================================
  // Valuation Risk Tab
  // ============================================

  const VALUATION_RISK_COLORS: Record<ValuationRiskLevel, string> = {
    UNDERVALUED: "#4ADE80",
    FAIR_VALUE: "#60A5FA",
    ELEVATED: "#FBBF24",
    OVERVALUED: "#F97316",
    EXTREME: "#EF4444",
  };

  const RISK_LEVEL_LABELS_KO: Record<ValuationRiskLevel, string> = {
    UNDERVALUED: "저평가",
    FAIR_VALUE: "적정가",
    ELEVATED: "고평가 주의",
    OVERVALUED: "고평가",
    EXTREME: "극단적 고평가",
  };

  const ACTION_LABELS_KO: Record<string, string> = {
    ACCUMULATE: "매수 기회",
    HOLD: "보유 유지",
    REDUCE: "일부 익절",
    EXIT: "포지션 정리",
  };

  const ACTION_ICONS: Record<string, string> = {
    ACCUMULATE: "📈",
    HOLD: "⏸️",
    REDUCE: "📉",
    EXIT: "🚨",
  };

  const Valuation = () => {
    if (valuationLoading || !btcValuation) {
      return (
        <div
          style={{
            textAlign: "center",
            padding: 40,
            color: COLORS.textMuted,
          }}
        >
          밸류에이션 데이터 로딩 중...
        </div>
      );
    }

    const getScoreColor = (score: number) => {
      if (score < 0.3) return COLORS.success;
      if (score < 0.5) return COLORS.cash;
      if (score < 0.7) return COLORS.warning;
      return COLORS.danger;
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Composite Score Card */}
        <div
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 20,
            }}
          >
            <div>
              <h3 style={{ fontSize: 15, marginBottom: 4 }}>
                포트폴리오 밸류에이션 리스크
              </h3>
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>
                다중 시간대 기반 고평가 위험 분석
              </span>
            </div>
            <div
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: `${
                  VALUATION_RISK_COLORS[portfolioValuation.weightedScore < 0.3 ? "UNDERVALUED" : portfolioValuation.weightedScore < 0.5 ? "FAIR_VALUE" : portfolioValuation.weightedScore < 0.7 ? "ELEVATED" : portfolioValuation.weightedScore < 0.85 ? "OVERVALUED" : "EXTREME"]
                }20`,
                color:
                  VALUATION_RISK_COLORS[portfolioValuation.weightedScore < 0.3 ? "UNDERVALUED" : portfolioValuation.weightedScore < 0.5 ? "FAIR_VALUE" : portfolioValuation.weightedScore < 0.7 ? "ELEVATED" : portfolioValuation.weightedScore < 0.85 ? "OVERVALUED" : "EXTREME"],
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              신뢰도: {(portfolioValuation.avgConfidence * 100).toFixed(0)}%
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 32,
            }}
          >
            {/* Score Gauge */}
            <div style={{ textAlign: "center", minWidth: 140 }}>
              <svg viewBox="0 0 100 60" style={{ width: 140, height: 84 }}>
                <defs>
                  <linearGradient id="valGrad" x1="0%" y1="0%" x2="100%">
                    <stop offset="0%" stopColor="#4ADE80" />
                    <stop offset="40%" stopColor="#60A5FA" />
                    <stop offset="60%" stopColor="#FBBF24" />
                    <stop offset="80%" stopColor="#F97316" />
                    <stop offset="100%" stopColor="#EF4444" />
                  </linearGradient>
                </defs>
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke={COLORS.border}
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke="url(#valGrad)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${portfolioValuation.weightedScore * 126} 126`}
                />
                <text
                  x="50"
                  y="38"
                  textAnchor="middle"
                  fill={COLORS.text}
                  fontSize="18"
                  fontWeight="bold"
                  fontFamily="'JetBrains Mono'"
                >
                  {(portfolioValuation.weightedScore * 100).toFixed(0)}
                </text>
                <text
                  x="50"
                  y="52"
                  textAnchor="middle"
                  fill={COLORS.textMuted}
                  fontSize="7"
                >
                  OVERVALUATION SCORE
                </text>
              </svg>
              <div
                style={{
                  marginTop: 8,
                  padding: "6px 16px",
                  borderRadius: 20,
                  background: `${getScoreColor(portfolioValuation.weightedScore)}20`,
                  color: getScoreColor(portfolioValuation.weightedScore),
                  fontSize: 12,
                  fontWeight: 600,
                  display: "inline-block",
                }}
              >
                {RISK_LEVEL_LABELS_KO[portfolioValuation.weightedScore < 0.3 ? "UNDERVALUED" : portfolioValuation.weightedScore < 0.5 ? "FAIR_VALUE" : portfolioValuation.weightedScore < 0.7 ? "ELEVATED" : portfolioValuation.weightedScore < 0.85 ? "OVERVALUED" : "EXTREME"]}
              </div>
            </div>

            {/* Risk Distribution */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 11,
                  color: COLORS.textMuted,
                  marginBottom: 12,
                }}
              >
                자산별 리스크 분포
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(
                  [
                    "UNDERVALUED",
                    "FAIR_VALUE",
                    "ELEVATED",
                    "OVERVALUED",
                    "EXTREME",
                  ] as ValuationRiskLevel[]
                ).map((level) => (
                  <div
                    key={level}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: VALUATION_RISK_COLORS[level],
                      }}
                    />
                    <span style={{ fontSize: 11, width: 80 }}>
                      {RISK_LEVEL_LABELS_KO[level]}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 6,
                        background: COLORS.border,
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${portfolioValuation.riskDistribution[level] || 0}%`,
                          height: "100%",
                          background: VALUATION_RISK_COLORS[level],
                          borderRadius: 3,
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "'JetBrains Mono'",
                        width: 40,
                        textAlign: "right",
                      }}
                    >
                      {(portfolioValuation.riskDistribution[level] || 0).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Timeframe Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }}
        >
          {btcValuation &&
            (
              [
                { key: "shortTerm", data: btcValuation.shortTerm },
                { key: "mediumTerm", data: btcValuation.mediumTerm },
                { key: "longTerm", data: btcValuation.longTerm },
              ] as const
            ).map(({ key, data }) => (
              <div
                key={key}
                style={{
                  background: COLORS.card,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 16,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <h4 style={{ fontSize: 13, margin: 0 }}>{data.label}</h4>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "3px 8px",
                      borderRadius: 4,
                      background: `${VALUATION_RISK_COLORS[data.riskLevel]}30`,
                      color: VALUATION_RISK_COLORS[data.riskLevel],
                      fontWeight: 600,
                    }}
                  >
                    {RISK_LEVEL_LABELS_KO[data.riskLevel]}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    fontFamily: "'JetBrains Mono'",
                    color: VALUATION_RISK_COLORS[data.riskLevel],
                    marginBottom: 12,
                  }}
                >
                  {(data.overvaluationScore * 100).toFixed(0)}
                </div>
                <div
                  style={{
                    height: 6,
                    background: COLORS.border,
                    borderRadius: 3,
                    overflow: "hidden",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      width: `${data.overvaluationScore * 100}%`,
                      height: "100%",
                      background: VALUATION_RISK_COLORS[data.riskLevel],
                      borderRadius: 3,
                    }}
                  />
                </div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>
                  신뢰도: {(data.confidence * 100).toFixed(0)}%
                </div>
              </div>
            ))}
        </div>

        {/* Key Drivers & Recommendation */}
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          {/* Key Drivers */}
          <div
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 16,
              padding: 20,
            }}
          >
            <h4 style={{ fontSize: 13, marginBottom: 16 }}>핵심 영향 요인</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {btcValuation?.keyDrivers.slice(0, 5).map((driver, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: COLORS.darkAlt,
                    borderRadius: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      width: 20,
                    }}
                  >
                    {driver.direction === "bullish"
                      ? "🟢"
                      : driver.direction === "bearish"
                        ? "🔴"
                        : "🟡"}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>
                      {driver.metric}
                    </div>
                    <div style={{ fontSize: 10, color: COLORS.textMuted }}>
                      {driver.reason}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background:
                        driver.severity === "high"
                          ? `${COLORS.danger}30`
                          : driver.severity === "medium"
                            ? `${COLORS.warning}30`
                            : `${COLORS.success}30`,
                      color:
                        driver.severity === "high"
                          ? COLORS.danger
                          : driver.severity === "medium"
                            ? COLORS.warning
                            : COLORS.success,
                      fontWeight: 600,
                    }}
                  >
                    {driver.severity === "high"
                      ? "높음"
                      : driver.severity === "medium"
                        ? "중간"
                        : "낮음"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendation */}
          <div
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 16,
              padding: 20,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h4 style={{ fontSize: 13, marginBottom: 16 }}>AI 추천</h4>
            <div
              style={{
                flex: 1,
                padding: 20,
                borderRadius: 12,
                background: `${
                  btcValuation?.recommendation.action === "ACCUMULATE"
                    ? COLORS.success
                    : btcValuation?.recommendation.action === "HOLD"
                      ? COLORS.cash
                      : btcValuation?.recommendation.action === "REDUCE"
                        ? COLORS.warning
                        : COLORS.danger
                }15`,
                border: `1px solid ${
                  btcValuation?.recommendation.action === "ACCUMULATE"
                    ? COLORS.success
                    : btcValuation?.recommendation.action === "HOLD"
                      ? COLORS.cash
                      : btcValuation?.recommendation.action === "REDUCE"
                        ? COLORS.warning
                        : COLORS.danger
                }40`,
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>
                {ACTION_ICONS[btcValuation?.recommendation.action || "HOLD"]}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  marginBottom: 8,
                  color:
                    btcValuation?.recommendation.action === "ACCUMULATE"
                      ? COLORS.success
                      : btcValuation?.recommendation.action === "HOLD"
                        ? COLORS.cash
                        : btcValuation?.recommendation.action === "REDUCE"
                          ? COLORS.warning
                          : COLORS.danger,
                }}
              >
                {ACTION_LABELS_KO[btcValuation?.recommendation.action || "HOLD"]}
              </div>
              <div style={{ fontSize: 13, color: COLORS.textMuted }}>
                {btcValuation?.recommendation.reason}
              </div>
              <div
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  padding: "4px 10px",
                  borderRadius: 20,
                  background:
                    btcValuation?.recommendation.urgency === "high"
                      ? `${COLORS.danger}20`
                      : btcValuation?.recommendation.urgency === "medium"
                        ? `${COLORS.warning}20`
                        : `${COLORS.success}20`,
                  color:
                    btcValuation?.recommendation.urgency === "high"
                      ? COLORS.danger
                      : btcValuation?.recommendation.urgency === "medium"
                        ? COLORS.warning
                        : COLORS.success,
                }}
              >
                긴급도:{" "}
                {btcValuation?.recommendation.urgency === "high"
                  ? "높음"
                  : btcValuation?.recommendation.urgency === "medium"
                    ? "중간"
                    : "낮음"}
              </div>
            </div>
          </div>
        </div>

        {/* Asset Valuation Table */}
        <div
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            padding: 20,
          }}
        >
          <h4 style={{ fontSize: 13, marginBottom: 16 }}>자산별 밸류에이션</h4>
          <div style={{ overflowX: "auto" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr",
                gap: 1,
                minWidth: 600,
              }}
            >
              {/* Header */}
              {["자산", "현재가", "리스크 레벨", "점수", "신뢰도", "추천"].map(
                (h) => (
                  <div
                    key={h}
                    style={{
                      padding: "12px 14px",
                      fontSize: 11,
                      color: COLORS.textMuted,
                      borderBottom: `1px solid ${COLORS.border}`,
                      fontWeight: 500,
                    }}
                  >
                    {h}
                  </div>
                )
              )}
              {/* Rows */}
              {calc.assets.map((asset) => {
                const result = valuationResults[asset.symbol];
                if (!result) return null;
                return (
                  <React.Fragment key={asset.id}>
                    <div
                      style={{
                        padding: "14px",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{asset.symbol}</span>
                      <span style={{ fontSize: 11, color: COLORS.textMuted }}>
                        {asset.name}
                      </span>
                    </div>
                    <div
                      style={{
                        padding: "14px",
                        fontFamily: "'JetBrains Mono'",
                        fontSize: 13,
                      }}
                    >
                      {fmt(asset.currentPrice || 0)}
                    </div>
                    <div style={{ padding: "14px" }}>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "3px 8px",
                          borderRadius: 4,
                          background: `${VALUATION_RISK_COLORS[result.riskLevel]}30`,
                          color: VALUATION_RISK_COLORS[result.riskLevel],
                          fontWeight: 600,
                        }}
                      >
                        {RISK_LEVEL_LABELS_KO[result.riskLevel]}
                      </span>
                    </div>
                    <div
                      style={{
                        padding: "14px",
                        fontFamily: "'JetBrains Mono'",
                        fontSize: 13,
                        color: VALUATION_RISK_COLORS[result.riskLevel],
                      }}
                    >
                      {(result.compositeScore * 100).toFixed(0)}
                    </div>
                    <div style={{ padding: "14px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <div
                          style={{
                            width: 40,
                            height: 4,
                            background: COLORS.border,
                            borderRadius: 2,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${result.confidence.overall * 100}%`,
                              height: "100%",
                              background: COLORS.primary,
                              borderRadius: 2,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: "'JetBrains Mono'",
                          }}
                        >
                          {(result.confidence.overall * 100).toFixed(0)}%
                        </span>
                        {result.confidence.isEstimated && (
                          <span
                            style={{
                              fontSize: 9,
                              color: COLORS.textMuted,
                              background: COLORS.darkAlt,
                              padding: "2px 4px",
                              borderRadius: 3,
                            }}
                          >
                            추정
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ padding: "14px" }}>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "3px 8px",
                          borderRadius: 4,
                          background:
                            result.recommendation.action === "ACCUMULATE"
                              ? `${COLORS.success}20`
                              : result.recommendation.action === "HOLD"
                                ? `${COLORS.cash}20`
                                : result.recommendation.action === "REDUCE"
                                  ? `${COLORS.warning}20`
                                  : `${COLORS.danger}20`,
                          color:
                            result.recommendation.action === "ACCUMULATE"
                              ? COLORS.success
                              : result.recommendation.action === "HOLD"
                                ? COLORS.cash
                                : result.recommendation.action === "REDUCE"
                                  ? COLORS.warning
                                  : COLORS.danger,
                          fontWeight: 600,
                        }}
                      >
                        {ACTION_LABELS_KO[result.recommendation.action]}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* Info Guide */}
        <div
          style={{
            padding: 14,
            background: COLORS.darkAlt,
            borderRadius: 10,
            display: "flex",
            gap: 20,
            fontSize: 11,
            color: COLORS.textMuted,
          }}
        >
          <div>
            <strong style={{ color: COLORS.text }}>점수 해석:</strong> 0-30
            저평가 | 30-50 적정 | 50-70 주의 | 70-85 고평가 | 85+ 극단적 고평가
          </div>
          <div>
            <strong style={{ color: COLORS.text }}>시간대:</strong> 단기 20% +
            중기 35% + 장기 45% = 종합 점수
          </div>
        </div>
      </div>
    );
  };

  // ============================================
  // Rebalance Tab
  // ============================================

  const Rebalance = () => {
    const actions = calc.assets.map((a) => {
      const t = TARGET[a.symbol] || 0;
      const d = t - (a.allocation || 0);
      const threshold = getVolatilityAdjustedThreshold(a.symbol);
      return {
        ...a,
        target: t,
        diff: d,
        threshold,
        val: (d / 100) * calc.totalValue,
        amt: ((d / 100) * calc.totalValue) / (a.currentPrice || 1),
        action: (d > threshold ? "BUY" : d < -threshold ? "SELL" : "HOLD") as TradeAction,
      };
    });

    const allData = [
      ...actions.map((a) => ({
        symbol: a.symbol,
        alloc: a.allocation || 0,
        target: a.target,
      })),
      {
        symbol: "CASH",
        alloc: calc.cashAllocation,
        target: analysis.recommendedCash,
      },
    ];

    const cashDiff = analysis.recommendedCash - calc.cashAllocation;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3>리밸런싱</h3>
          <button
            onClick={() => {
              const hasConnectedExchange =
                exchangeStatus.upbit || exchangeStatus.bithumb;
              if (!hasConnectedExchange) {
                alert(
                  "거래소 API 연결이 필요합니다.\n\n.env 파일에 API 키를 설정해주세요:\n- UPBIT_ACCESS_KEY\n- UPBIT_SECRET_KEY\n- BITHUMB_API_KEY\n- BITHUMB_SECRET_KEY"
                );
              } else {
                alert(
                  "자동 리밸런싱 실행 준비 완료.\n각 종목별로 매수/매도 버튼을 클릭하세요."
                );
              }
            }}
            disabled={executing}
            style={{
              background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
              border: "none",
              color: COLORS.dark,
              padding: "12px 24px",
              borderRadius: 8,
              fontWeight: 600,
              cursor: executing ? "not-allowed" : "pointer",
              opacity: executing ? 0.7 : 1,
            }}
          >
            {executing ? "실행 중..." : "실행"}
          </button>
        </div>

        {/* Cash Status */}
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            background:
              cashDiff > 5
                ? "rgba(239,68,68,0.1)"
                : cashDiff < -5
                ? "rgba(96,165,250,0.1)"
                : "rgba(74,222,128,0.1)",
            border: `1px solid ${
              cashDiff > 5
                ? "rgba(239,68,68,0.3)"
                : cashDiff < -5
                ? "rgba(96,165,250,0.3)"
                : "rgba(74,222,128,0.3)"
            }`,
          }}
        >
          <div style={{ display: "flex", gap: 14 }}>
            <span style={{ fontSize: 24 }}>
              {cashDiff > 5 ? "⚠️" : cashDiff < -5 ? "💰" : "✅"}
            </span>
            <div>
              <strong>
                {cashDiff > 5
                  ? "현금 부족"
                  : cashDiff < -5
                  ? "현금 초과 - 투자 기회"
                  : "현금 적정"}
              </strong>
              <p style={{ fontSize: 13, color: COLORS.textMuted }}>
                현재 {calc.cashAllocation.toFixed(1)}% → 추천{" "}
                {analysis.recommendedCash}% ({cashDiff > 0 ? "+" : ""}
                {cashDiff.toFixed(1)}%)
              </p>
            </div>
          </div>
        </div>

        {/* Bar Chart */}
        <div
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            padding: 20,
          }}
        >
          <span style={{ fontSize: 13, color: COLORS.textMuted }}>
            현재 vs 목표
          </span>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={allData} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" domain={[0, 60]} />
              <YAxis type="category" dataKey="symbol" width={50} />
              <Tooltip
                contentStyle={{
                  background: COLORS.card,
                  border: `1px solid ${COLORS.border}`,
                }}
                formatter={(v: number) => [`${v.toFixed(1)}%`]}
              />
              <Legend />
              <Bar
                dataKey="alloc"
                name="현재"
                fill={COLORS.secondary}
                radius={[0, 4, 4, 0]}
              />
              <Bar
                dataKey="target"
                name="목표"
                fill={COLORS.primary}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Trade Actions */}
        <div
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            padding: 20,
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: COLORS.textMuted,
              display: "block",
              marginBottom: 14,
            }}
          >
            필요 거래
          </span>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            {actions.map((a, i) => (
              <div
                key={a.id}
                style={{
                  background: COLORS.darkAlt,
                  borderRadius: 10,
                  padding: 14,
                  border: `1px solid ${
                    a.action === "BUY"
                      ? "rgba(74,222,128,0.3)"
                      : a.action === "SELL"
                      ? "rgba(239,68,68,0.3)"
                      : "transparent"
                  }`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{ display: "flex", gap: 6, alignItems: "center" }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontFamily: "'JetBrains Mono'",
                        paddingLeft: 6,
                        borderLeft: `3px solid ${
                          CHART_COLORS[i % CHART_COLORS.length]
                        }`,
                      }}
                    >
                      {a.symbol}
                    </span>
                    <ExchangeBadge exchange={a.exchange} />
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "3px 6px",
                      borderRadius: 4,
                      background:
                        a.action === "BUY"
                          ? "rgba(74,222,128,0.15)"
                          : a.action === "SELL"
                          ? "rgba(239,68,68,0.15)"
                          : "rgba(113,113,122,0.15)",
                      color:
                        a.action === "BUY"
                          ? COLORS.success
                          : a.action === "SELL"
                          ? COLORS.danger
                          : COLORS.textMuted,
                    }}
                  >
                    {a.action}
                  </span>
                </div>
                <div style={{ fontSize: 12 }}>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span>현재</span>
                    <span>{(a.allocation || 0).toFixed(1)}%</span>
                  </div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span>목표</span>
                    <span>{a.target}%</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "6px 0",
                      borderTop: `1px solid ${COLORS.border}`,
                      borderBottom: `1px solid ${COLORS.border}`,
                      margin: "4px 0",
                    }}
                  >
                    <span>조정</span>
                    <span
                      style={{
                        color: a.diff >= 0 ? COLORS.success : COLORS.danger,
                      }}
                    >
                      {formatPercent(a.diff)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      color: COLORS.textMuted,
                    }}
                    title={`±${a.threshold}% 초과 시 리밸런싱 트리거`}
                  >
                    <span>임계값</span>
                    <span>±{a.threshold}%</span>
                  </div>
                  {a.action !== "HOLD" && (
                    <>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>{a.action === "BUY" ? "매수" : "매도"}</span>
                        <span style={{ fontFamily: "'JetBrains Mono'" }}>
                          {Math.abs(a.amt).toFixed(4)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>금액</span>
                        <span style={{ fontFamily: "'JetBrains Mono'" }}>
                          {fmt(Math.abs(a.val))}
                        </span>
                      </div>
                      {isSupportedExchange(a.exchange) && exchangeStatus[a.exchange] && (
                        <button
                          onClick={() =>
                            handleExecuteRebalance(
                              a.action,
                              a.symbol,
                              a.exchange,
                              Math.abs(a.action === "BUY" ? a.val : a.amt)
                            )
                          }
                          disabled={executing}
                          style={{
                            marginTop: 8,
                            width: "100%",
                            padding: "8px",
                            border: "none",
                            borderRadius: 6,
                            background:
                              a.action === "BUY"
                                ? COLORS.success
                                : COLORS.danger,
                            color: "#fff",
                            fontWeight: 600,
                            fontSize: 12,
                            cursor: executing ? "not-allowed" : "pointer",
                            opacity: executing ? 0.7 : 1,
                          }}
                        >
                          {a.action === "BUY" ? "매수 실행" : "매도 실행"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Analysis Breakdown - 판단 근거 */}
        <div
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            padding: 20,
          }}
        >
          <h4 style={{ fontSize: 14, marginBottom: 14 }}>리밸런싱 판단 근거</h4>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              marginBottom: 20,
            }}
          >
            {/* AI 추천 현금 비중 */}
            <div
              style={{
                background: `${RISK_COLORS[analysis.riskLevel]}15`,
                border: `1px solid ${RISK_COLORS[analysis.riskLevel]}40`,
                borderRadius: 10,
                padding: 16,
              }}
            >
              <div style={{ fontSize: 11, color: COLORS.textMuted }}>
                AI 추천 현금 비중
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  marginTop: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    fontFamily: "'JetBrains Mono'",
                    color: RISK_COLORS[analysis.riskLevel],
                  }}
                >
                  {analysis.recommendedCash}%
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: `${RISK_COLORS[analysis.riskLevel]}30`,
                    color: RISK_COLORS[analysis.riskLevel],
                  }}
                >
                  {analysis.riskLevel}
                </span>
              </div>
            </div>

            {/* 전략 요약 */}
            <div
              style={{
                background: COLORS.darkAlt,
                borderRadius: 10,
                padding: 16,
              }}
            >
              <div style={{ fontSize: 11, color: COLORS.textMuted }}>
                전략 요약
              </div>
              <p
                style={{
                  fontSize: 13,
                  marginTop: 8,
                  lineHeight: 1.5,
                  color: COLORS.text,
                }}
              >
                {analysis.strategy}
              </p>
            </div>
          </div>

          {/* 지표별 점수 */}
          <div style={{ marginTop: 16 }}>
            <span
              style={{
                fontSize: 12,
                color: COLORS.textMuted,
                display: "block",
                marginBottom: 12,
              }}
            >
              지표별 분석
            </span>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: 10,
              }}
            >
              {analysis.breakdown.map((b) => (
                <div
                  key={b.indicator}
                  style={{
                    background: COLORS.darkAlt,
                    borderRadius: 8,
                    padding: "12px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 12 }}>
                    {INDICATOR_LABELS[b.indicator] || b.indicator}
                  </span>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 6,
                        background: COLORS.border,
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${b.score}%`,
                          height: "100%",
                          background:
                            b.score < 40
                              ? COLORS.success
                              : b.score > 60
                              ? COLORS.danger
                              : COLORS.warning,
                          borderRadius: 3,
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono'",
                        fontSize: 12,
                        fontWeight: 600,
                        color:
                          b.score < 40
                            ? COLORS.success
                            : b.score > 60
                            ? COLORS.danger
                            : COLORS.warning,
                        minWidth: 24,
                        textAlign: "right",
                      }}
                    >
                      {b.score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 점수 해석 가이드 */}
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: COLORS.darkAlt,
              borderRadius: 8,
              display: "flex",
              gap: 16,
              fontSize: 11,
              color: COLORS.textMuted,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: COLORS.success,
                }}
              />
              0-40: 매수 적기
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: COLORS.warning,
                }}
              />
              40-60: 중립
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: COLORS.danger,
                }}
              />
              60+: 현금 확보
            </div>
          </div>

          {/* 개별 종목 분석 */}
          <div style={{ marginTop: 20 }}>
            <span
              style={{
                fontSize: 12,
                color: COLORS.textMuted,
                display: "block",
                marginBottom: 12,
              }}
            >
              개별 종목 리밸런싱 근거
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {actions.map((a) => {
                const isOverweight = a.diff < -2;
                const isUnderweight = a.diff > 2;

                return (
                  <div
                    key={a.id}
                    style={{
                      background: COLORS.darkAlt,
                      borderRadius: 10,
                      padding: 14,
                      borderLeft: `4px solid ${
                        isOverweight
                          ? COLORS.danger
                          : isUnderweight
                          ? COLORS.success
                          : COLORS.textMuted
                      }`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            fontFamily: "'JetBrains Mono'",
                          }}
                        >
                          {a.symbol}
                        </span>
                        <span style={{ fontSize: 12, color: COLORS.textMuted }}>
                          {a.name}
                        </span>
                        <ExchangeBadge exchange={a.exchange} />
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "4px 10px",
                          borderRadius: 6,
                          background: isOverweight
                            ? "rgba(239,68,68,0.15)"
                            : isUnderweight
                            ? "rgba(74,222,128,0.15)"
                            : "rgba(113,113,122,0.15)",
                          color: isOverweight
                            ? COLORS.danger
                            : isUnderweight
                            ? COLORS.success
                            : COLORS.textMuted,
                        }}
                      >
                        {isOverweight
                          ? "비중 초과"
                          : isUnderweight
                          ? "비중 부족"
                          : "적정"}
                      </span>
                    </div>

                    {/* 비중 비교 바 */}
                    <div style={{ marginBottom: 12 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 11,
                          color: COLORS.textMuted,
                          marginBottom: 4,
                        }}
                      >
                        <span>현재 {(a.allocation || 0).toFixed(1)}%</span>
                        <span>목표 {a.target}%</span>
                      </div>
                      <div
                        style={{
                          position: "relative",
                          height: 8,
                          background: COLORS.border,
                          borderRadius: 4,
                        }}
                      >
                        {/* 목표 위치 마커 */}
                        <div
                          style={{
                            position: "absolute",
                            left: `${Math.min(a.target, 100)}%`,
                            top: -2,
                            width: 2,
                            height: 12,
                            background: COLORS.primary,
                            borderRadius: 1,
                            zIndex: 2,
                          }}
                        />
                        {/* 현재 비중 바 */}
                        <div
                          style={{
                            width: `${Math.min(a.allocation || 0, 100)}%`,
                            height: "100%",
                            background: isOverweight
                              ? COLORS.danger
                              : isUnderweight
                              ? COLORS.success
                              : COLORS.secondary,
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </div>

                    {/* 목표 비중 설정 근거 */}
                    {(() => {
                      const rationale = generateAssetTargetRationale(
                        a.symbol,
                        a.target,
                        analysis.riskLevel
                      );
                      const categoryColors: Record<string, string> = {
                        core: COLORS.primary,
                        major: COLORS.secondary,
                        growth: COLORS.warning,
                        speculative: COLORS.danger,
                      };
                      const categoryNames: Record<string, string> = {
                        core: "핵심",
                        major: "주요",
                        growth: "성장",
                        speculative: "투기",
                      };
                      return (
                        <div
                          style={{
                            background: `${COLORS.card}80`,
                            borderRadius: 8,
                            padding: 12,
                            marginBottom: 10,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 8,
                            }}
                          >
                            <span style={{ fontSize: 11, color: COLORS.textMuted }}>
                              목표 비중 {a.target}% 설정 근거
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: `${categoryColors[rationale.category]}20`,
                                color: categoryColors[rationale.category],
                                fontWeight: 600,
                              }}
                            >
                              {categoryNames[rationale.category]} 자산
                            </span>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                            {rationale.factors.map((f, idx) => (
                              <div
                                key={idx}
                                style={{
                                  fontSize: 10,
                                  padding: "4px 8px",
                                  borderRadius: 4,
                                  background: f.impact === "positive" ? "rgba(74,222,128,0.15)" : f.impact === "negative" ? "rgba(239,68,68,0.15)" : "rgba(113,113,122,0.15)",
                                  color: f.impact === "positive" ? COLORS.success : f.impact === "negative" ? COLORS.danger : COLORS.textMuted,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <span>{f.impact === "positive" ? "▲" : f.impact === "negative" ? "▼" : "●"}</span>
                                <span style={{ fontWeight: 500 }}>{f.factor}</span>
                              </div>
                            ))}
                          </div>
                          <p style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5, margin: 0 }}>
                            {rationale.rationale}
                          </p>
                        </div>
                      );
                    })()}

                    {/* 리밸런싱 판단 */}
                    <div
                      style={{
                        fontSize: 12,
                        color: COLORS.text,
                        lineHeight: 1.6,
                        padding: 10,
                        background: isOverweight ? "rgba(239,68,68,0.1)" : isUnderweight ? "rgba(74,222,128,0.1)" : COLORS.darkAlt,
                        borderRadius: 6,
                        border: `1px solid ${isOverweight ? "rgba(239,68,68,0.2)" : isUnderweight ? "rgba(74,222,128,0.2)" : COLORS.border}`,
                      }}
                    >
                      {isOverweight ? (
                        <>
                          <strong style={{ color: COLORS.danger }}>▼ {Math.abs(a.diff).toFixed(1)}%p 초과</strong>{" "}
                          - 목표 대비 과다 보유 중입니다. <span style={{ color: COLORS.danger }}>{Math.abs(a.amt).toFixed(4)} {a.symbol}</span>{" "}({fmt(Math.abs(a.val))}) 매도를 권장합니다.
                        </>
                      ) : isUnderweight ? (
                        <>
                          <strong style={{ color: COLORS.success }}>▲ {Math.abs(a.diff).toFixed(1)}%p 부족</strong>{" "}
                          - 목표 대비 보유량이 부족합니다. <span style={{ color: COLORS.success }}>{Math.abs(a.amt).toFixed(4)} {a.symbol}</span>{" "}({fmt(Math.abs(a.val))}) 매수를 권장합니다.
                        </>
                      ) : (
                        <>
                          <strong style={{ color: COLORS.textMuted }}>● 적정 비중</strong>{" "}
                          - 현재 비중이 목표와 ±2%p 이내로 적정합니다.
                        </>
                      )}
                    </div>

                    {/* 추가 정보 */}
                    {a.action !== "HOLD" && (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 1fr",
                          gap: 10,
                          marginTop: 10,
                          fontSize: 11,
                        }}
                      >
                        <div
                          style={{
                            background: COLORS.card,
                            padding: 8,
                            borderRadius: 6,
                          }}
                        >
                          <span style={{ color: COLORS.textMuted }}>
                            현재 평가금액
                          </span>
                          <div
                            style={{
                              fontFamily: "'JetBrains Mono'",
                              marginTop: 2,
                            }}
                          >
                            {fmt(a.value || 0)}
                          </div>
                        </div>
                        <div
                          style={{
                            background: COLORS.card,
                            padding: 8,
                            borderRadius: 6,
                          }}
                        >
                          <span style={{ color: COLORS.textMuted }}>
                            조정 금액
                          </span>
                          <div
                            style={{
                              fontFamily: "'JetBrains Mono'",
                              marginTop: 2,
                              color:
                                a.action === "BUY"
                                  ? COLORS.success
                                  : COLORS.danger,
                            }}
                          >
                            {a.action === "BUY" ? "+" : "-"}
                            {fmt(Math.abs(a.val))}
                          </div>
                        </div>
                        <div
                          style={{
                            background: COLORS.card,
                            padding: 8,
                            borderRadius: 6,
                          }}
                        >
                          <span style={{ color: COLORS.textMuted }}>
                            조정 후 비중
                          </span>
                          <div
                            style={{
                              fontFamily: "'JetBrains Mono'",
                              marginTop: 2,
                            }}
                          >
                            {a.target}%
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Exchange Guide */}
        <div
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            padding: 20,
          }}
        >
          <h4 style={{ fontSize: 14, marginBottom: 14 }}>거래소별 가이드</h4>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            {(["upbit", "bithumb"] as const).map((ex) => (
              <div
                key={ex}
                style={{
                  background: COLORS.darkAlt,
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <ExchangeBadge exchange={ex} />
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: exchangeStatus[ex]
                        ? COLORS.success
                        : COLORS.danger,
                    }}
                  />
                </div>
                <ul style={{ listStyle: "none", marginTop: 10, fontSize: 12 }}>
                  {actions
                    .filter((r) => r.exchange === ex && r.action !== "HOLD")
                    .map((r) => (
                      <li
                        key={r.id}
                        style={{ marginBottom: 6, display: "flex", gap: 8 }}
                      >
                        <span
                          style={{
                            background:
                              r.action === "BUY"
                                ? "rgba(74,222,128,0.15)"
                                : "rgba(239,68,68,0.15)",
                            color:
                              r.action === "BUY"
                                ? COLORS.success
                                : COLORS.danger,
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 10,
                          }}
                        >
                          {r.action}
                        </span>
                        <span>{r.symbol}</span>
                        <span style={{ color: COLORS.textMuted }}>
                          {Math.abs(r.amt).toFixed(4)}
                        </span>
                      </li>
                    ))}
                  {!actions.filter(
                    (r) => r.exchange === ex && r.action !== "HOLD"
                  ).length && (
                    <li style={{ color: COLORS.textMuted }}>조정 없음</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div
      style={{
        fontFamily: "'Noto Sans KR', sans-serif",
        background: COLORS.dark,
        minHeight: "100vh",
        color: COLORS.text,
      }}
    >
      <style>{animationCSS}</style>

      {/* Header */}
      <header
        style={{
          background: `linear-gradient(180deg, ${COLORS.darkAlt}, ${COLORS.dark})`,
          borderBottom: `1px solid ${COLORS.border}`,
          padding: "14px 32px",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 14,
                color: COLORS.dark,
              }}
            >
              PM
            </div>
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.secondary})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Portfolio Manager
            </span>
          </div>
          <nav
            style={{
              display: "flex",
              gap: 4,
              background: COLORS.card,
              padding: 4,
              borderRadius: 8,
            }}
          >
            {[
              ["overview", "개요"],
              ["macro", "시장분석"],
              ["valuation", "밸류에이션"],
              ["rebalance", "리밸런싱"],
            ].map(([k, v]) => (
              <button
                key={k}
                onClick={() => setTab(k as TabType)}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  background:
                    tab === k
                      ? `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`
                      : "transparent",
                  color: tab === k ? COLORS.dark : COLORS.textMuted,
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 500,
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                {v}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 32px" }}>
        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: COLORS.textMuted,
            }}
          >
            시장 데이터 로딩 중...
          </div>
        ) : (
          <>
            {tab === "overview" && <Overview />}
            {tab === "macro" && <Macro />}
            {tab === "valuation" && <Valuation />}
            {tab === "rebalance" && <Rebalance />}
          </>
        )}
      </main>

      {/* Modal */}
      {showModal && (
        <CashModal
          cash={cashHoldings}
          onSave={setManualCash}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
