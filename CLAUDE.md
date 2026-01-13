# CLAUDE.md - AI Development Context

This file provides context for AI assistants working on this codebase.

## Project Overview

Portfolio Manager is a Korean cryptocurrency portfolio management application with:
- Multi-indicator market analysis (Fear & Greed, MVRV, Kimchi Premium, etc.)
- Dynamic cash allocation recommendations
- Volatility-adjusted rebalancing
- Exchange API integration (Upbit, Bithumb)

## Key Architecture

### Type System

**Exchange Types** (`src/types/index.ts`):
```typescript
// Full exchange type (includes future exchanges)
type ExchangeType = 'upbit' | 'bithumb' | 'binance' | 'coinbase' | 'stock_kr' | 'stock_us';

// Trading-supported exchanges only (src/services/exchangeApi.ts)
type SupportedTradingExchange = 'upbit' | 'bithumb';
```

**Asset Categories** (`src/utils/cashAnalysis.ts`):
- `core`: BTC, ETH - Institutional adoption, low volatility
- `major`: XRP, ADA, LINK - Verified projects
- `growth`: SOL, AVAX, DOT, MATIC - High potential
- `speculative`: DOGE, etc. - High risk

### Core Functions

**Volatility-Adjusted Thresholds** (`src/utils/cashAnalysis.ts:664-695`):
```typescript
getAssetCategory(symbol: string)       // Returns asset category
getVolatilityAdjustedThreshold(symbol) // Returns rebalancing threshold (1.5-3%)
```

Thresholds by category:
| Category | Threshold | Rationale |
|----------|-----------|-----------|
| Core | ±3.0% | Stable assets, wider tolerance |
| Major | ±2.5% | Verified projects |
| Growth | ±2.0% | Standard threshold |
| Speculative | ±1.5% | Tight control for high volatility |

**Type Guard Pattern** (`src/App.tsx:338-344`):
```typescript
const isSupportedExchange = (exchange: ExchangeType): exchange is SupportedExchange => {
  return SUPPORTED_EXCHANGES.includes(exchange as SupportedExchange);
};
```
Use this pattern before calling exchangeApi methods.

### File Structure

| File | Purpose |
|------|---------|
| `src/utils/cashAnalysis.ts` | Indicator analysis, cash allocation, asset categorization |
| `src/utils/valuationRisk.ts` | Multi-timeframe valuation risk assessment |
| `src/App.tsx` | Main component, rebalancing UI, trade execution |
| `src/hooks/useMarketData.ts` | Data fetching hooks, exchange status |
| `src/hooks/useValuationRisk.ts` | React hooks for valuation risk calculation |
| `src/services/exchangeApi.ts` | Upbit/Bithumb API wrapper |
| `src/types/index.ts` | TypeScript type definitions |

### Analysis Indicators

Weighted scoring system (`cashAnalysis.ts:12-20`):
- Fear & Greed: 20%
- MVRV: 15%
- Kimchi Premium: 10%
- Exchange Flow: 15%
- DXY: 10%
- Market Trend (200MA): 15%
- Volatility (VIX): 15%

Score maps to risk levels: AGGRESSIVE (10% cash) -> PRESERVATION (55% cash)

### Valuation Risk Analysis

Multi-timeframe overvaluation assessment (`src/utils/valuationRisk.ts`):

**9 Metrics:**
- MVRV, NVT, Price vs MA50/MA200, Exchange Netflow
- Fear & Greed, Kimchi Premium, Active Address Ratio
- Cycle Position, Realized Price Ratio

**Timeframe Weights:**
| Timeframe | Weight | Focus |
|-----------|--------|-------|
| Short (1-7d) | 20% | Momentum, sentiment |
| Medium (1-4w) | 35% | Technicals + fundamentals |
| Long (1-6mo) | 45% | Fundamentals, cycle position |

**Category Thresholds:**
| Category | MVRV Overbought | Beta to BTC |
|----------|-----------------|-------------|
| Core | 3.5 | 1.0 |
| Major | 3.0 | 1.3 |
| Growth | 2.5 | 1.6 |
| Speculative | 2.0 | 2.0 |

Risk levels: UNDERVALUED → FAIR_VALUE → ELEVATED → OVERVALUED → EXTREME

**React Hook** (`src/hooks/useValuationRisk.ts`):
```typescript
const { results, btcResult, getAssetRisk } = useValuationRisk(assets, onchainData, marketData);
const summary = usePortfolioValuationSummary(results, assets);
```

## Common Patterns

### Adding New Exchanges
1. Add to `ExchangeType` in `src/types/index.ts`
2. Add to `DEFAULT_EXCHANGE_STATUS` in `src/hooks/useMarketData.ts`
3. If trading supported, add to `SupportedTradingExchange` and implement in `exchangeApi.ts`

### Adding New Assets
1. Add to `ASSET_CHARACTERISTICS` in `src/utils/cashAnalysis.ts` (line 572)
2. Specify category, marketCapRank, volatility, adoption, useCase

### Modifying Thresholds
Edit `VOLATILITY_ADJUSTED_THRESHOLDS` in `src/utils/cashAnalysis.ts` (line 664)

## Build & Run

```bash
npm install          # Install dependencies
npm run dev          # Development server
npm run build        # Production build
npm run server       # Backend API proxy
```

## Recent Changes

### 2025-01-13: Valuation Risk Module & UI
- Added `src/utils/valuationRisk.ts` - Multi-timeframe valuation risk assessment
- Added `src/hooks/useValuationRisk.ts` - React hooks for integration
- 9 metrics: MVRV, NVT, MA deviation, exchange flow, sentiment, premium, active addresses, cycle position, realized price
- Category-based thresholds with BTC correlation estimation for altcoins
- Risk levels: UNDERVALUED → FAIR_VALUE → ELEVATED → OVERVALUED → EXTREME
- **UI Integration** (App.tsx +730 lines):
  - Added "밸류에이션" tab to navigation
  - Portfolio composite score gauge (SVG arc with gradient)
  - Risk distribution visualization (5 risk level bars)
  - Timeframe cards (short/medium/long-term breakdown)
  - Key drivers panel (top 5 factors with direction indicators)
  - AI recommendation box (action + urgency)
  - Asset valuation table (per-asset risk breakdown)
  - Hooks wired at app level (lines 338-358)

### 2025-01-12: Volatility-Adjusted Rebalancing
- Added `getVolatilityAdjustedThreshold()` function
- Dynamic thresholds based on asset category
- Fixed ExchangeType build errors with proper type guards
- Renamed conflicting `ExchangeType` to `SupportedTradingExchange` in exchangeApi.ts
