import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import * as api from "../services/api";
import type {
  PriceData,
  FearGreedData,
  OnchainData,
  MarketData,
} from "../types";

// ============================================
// Rate Limiting Constants
// ============================================

const UPBIT_MIN_INTERVAL = 1000; // 업비트 API 최소 요청 간격 (1초)
const DEFAULT_REFRESH_INTERVAL = 60000; // 기본 갱신 주기 (1분)
const KIMCHI_REFRESH_INTERVAL = 120000; // 김프 갱신 주기 (2분)
const ONCHAIN_REFRESH_INTERVAL = 100000; // 온체인 갱신 주기 (5분)

// ============================================
// Crypto Prices Hook
// ============================================

export const useCryptoPrices = (
  symbols: string[],
  exchange: "upbit" | "bithumb" = "upbit",
  refreshInterval: number = DEFAULT_REFRESH_INTERVAL
) => {
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const lastFetchRef = useRef<number>(0);

  const fetchPrices = useCallback(async () => {
    // Rate limiting
    const now = Date.now();
    if (now - lastFetchRef.current < UPBIT_MIN_INTERVAL) {
      return;
    }
    lastFetchRef.current = now;

    try {
      let data: Record<string, PriceData> | null;

      if (exchange === "upbit") {
        data = await api.fetchUpbitPrices(symbols);
      } else {
        data = await api.fetchBithumbPrices(symbols);
      }

      if (data) {
        setPrices(data);
        setLastUpdated(new Date());
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch prices");
    } finally {
      setLoading(false);
    }
  }, [symbols, exchange]);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchPrices, refreshInterval]);

  return { prices, loading, error, lastUpdated, refetch: fetchPrices };
};

// ============================================
// Fear & Greed Index Hook
// ============================================

export const useFearGreedIndex = (refreshInterval: number = 200000) => {
  const [data, setData] = useState<FearGreedData>({
    value: 50,
    classification: "Neutral",
    timestamp: "",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const result = await api.fetchFearGreedIndex();
      setData(result);
      setLoading(false);
    };

    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  return { ...data, loading };
};

// ============================================
// Exchange Rate Hook
// ============================================

export const useExchangeRate = (refreshInterval: number = 3200000) => {
  const [rate, setRate] = useState(1380);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const result = await api.fetchExchangeRate();
      setRate(result);
      setLoading(false);
    };

    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  return { rate, loading };
};

// ============================================
// Kimchi Premium Hook
// ============================================

const SYMBOL_TO_GECKO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  XRP: "ripple",
  SOL: "solana",
  DOGE: "dogecoin",
  ADA: "cardano",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  MATIC: "matic-network",
  LINK: "chainlink",
};

export const useKimchiPremium = (
  symbols: string[],
  refreshInterval: number = KIMCHI_REFRESH_INTERVAL
) => {
  const [premiums, setPremiums] = useState<Record<string, number>>({});
  const [avgPremium, setAvgPremium] = useState(0);
  const [loading, setLoading] = useState(true);
  const lastFetchRef = useRef<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      // Rate limiting
      const now = Date.now();
      if (now - lastFetchRef.current < UPBIT_MIN_INTERVAL * 2) {
        return;
      }
      lastFetchRef.current = now;

      try {
        const geckoIds = symbols
          .map((s) => SYMBOL_TO_GECKO_ID[s])
          .filter(Boolean);

        // Fetch sequentially to avoid rate limits
        const upbitPrices = await api.fetchUpbitPrices(symbols);
        await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms delay
        const globalPrices = await api.fetchGlobalPrices(geckoIds);
        const exchangeRate = await api.fetchExchangeRate();

        if (upbitPrices && globalPrices && exchangeRate) {
          const newPremiums: Record<string, number> = {};
          let totalPremium = 0;
          let count = 0;

          symbols.forEach((symbol) => {
            const geckoId = SYMBOL_TO_GECKO_ID[symbol];
            if (upbitPrices[symbol] && globalPrices[geckoId]) {
              const krwPrice = upbitPrices[symbol].price;
              const usdPrice = globalPrices[geckoId].usd;
              const premium = api.calculateKimchiPremium(
                krwPrice,
                usdPrice,
                exchangeRate
              );
              newPremiums[symbol] = premium;
              totalPremium += premium;
              count++;
            }
          });

          setPremiums(newPremiums);
          setAvgPremium(count > 0 ? totalPremium / count : 0);
        }
      } catch (err) {
        console.error("Kimchi Premium Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [symbols, refreshInterval]);

  return { premiums, avgPremium, loading };
};

// ============================================
// BTC Onchain Data Hook
// ============================================

export const useBTCOnchain = (
  refreshInterval: number = ONCHAIN_REFRESH_INTERVAL
) => {
  const [data, setData] = useState<OnchainData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const result = await api.fetchAllOnchainData();
      if (result) {
        setData(result);
      }
      setLoading(false);
    };

    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  return { data, loading };
};

// ============================================
// Comprehensive Market Data Hook
// ============================================

export const useMarketData = (
  refreshInterval: number = DEFAULT_REFRESH_INTERVAL,
  symbols: string[] = ["BTC", "ETH", "XRP", "SOL"]
) => {
  const [data, setData] = useState<Omit<MarketData, "lastUpdated">>({
    prices: {},
    globalPrices: {},
    fearGreed: { value: 50, classification: "Neutral", timestamp: "" },
    exchangeRate: 1380,
    onchain: null,
    macro: null,
    kimchiPremiums: {},
    avgKimchiPremium: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const lastFetchRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);

  const fetchAllData = useCallback(async () => {
    // Prevent concurrent fetches and rate limiting
    if (isFetchingRef.current) return;

    const now = Date.now();
    if (now - lastFetchRef.current < UPBIT_MIN_INTERVAL * 3) {
      return;
    }

    isFetchingRef.current = true;
    lastFetchRef.current = now;

    try {
      const result = await api.fetchAllMarketData(symbols);

      setData({
        prices: result.prices,
        globalPrices: result.globalPrices,
        fearGreed: result.fearGreed,
        exchangeRate: result.exchangeRate,
        onchain: result.onchain,
        macro: null,
        kimchiPremiums: result.kimchiPremiums,
        avgKimchiPremium: result.avgKimchiPremium,
      });
      setLastUpdated(result.lastUpdated);
    } catch (err) {
      console.error("Market Data Error:", err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [symbols]);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchAllData, refreshInterval]);

  return { data, loading, lastUpdated, refetch: fetchAllData };
};

// ============================================
// Portfolio Local Storage Hook
// ============================================

import type { Asset, CashHolding } from "../types";

export const usePortfolioStorage = (key: string = "portfolio") => {
  const [portfolio, setPortfolio] = useState<Asset[]>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(portfolio));
  }, [key, portfolio]);

  const addAsset = useCallback((asset: Omit<Asset, "id">) => {
    setPortfolio((prev) => [...prev, { ...asset, id: crypto.randomUUID() }]);
  }, []);

  const updateAsset = useCallback((id: string, updates: Partial<Asset>) => {
    setPortfolio((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
  }, []);

  const removeAsset = useCallback((id: string) => {
    setPortfolio((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { portfolio, setPortfolio, addAsset, updateAsset, removeAsset };
};

// ============================================
// Cash Storage Hook
// ============================================

const DEFAULT_CASH: CashHolding[] = [
  { id: "krw", currency: "KRW", name: "원화", amount: 0, icon: "₩" },
  { id: "usd", currency: "USD", name: "달러", amount: 0, icon: "$" },
  { id: "usdt", currency: "USDT", name: "테더", amount: 0, icon: "₮" },
];

export const useCashStorage = (key: string = "cash") => {
  const [cash, setCash] = useState<CashHolding[]>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : DEFAULT_CASH;
    } catch {
      return DEFAULT_CASH;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(cash));
  }, [key, cash]);

  const updateCash = useCallback((id: string, amount: number) => {
    setCash((prev) => prev.map((c) => (c.id === id ? { ...c, amount } : c)));
  }, []);

  return { cash, setCash, updateCash };
};

// ============================================
// Exchange Connection Status Hook
// ============================================

import { checkExchangeConnection } from "../services/exchangeApi";

export const useExchangeStatus = (refreshInterval: number = 120000) => {
  const [status, setStatus] = useState<{ upbit: boolean; bithumb: boolean }>({
    upbit: false,
    bithumb: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const result = await checkExchangeConnection();
        setStatus(result);
      } catch {
        setStatus({ upbit: false, bithumb: false });
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  return { status, loading };
};

// ============================================
// Combined Portfolio Calculation Hook
// ============================================

export const usePortfolioCalculation = (
  assets: Asset[],
  cash: CashHolding[],
  prices: Record<string, PriceData>,
  exchangeRate: number
) => {
  return useMemo(() => {
    // Calculate total cash in KRW
    const totalCash = cash.reduce((sum, c) => {
      if (c.currency === "KRW") return sum + c.amount;
      return sum + c.amount * exchangeRate;
    }, 0);

    // Enrich assets with current prices
    const enrichedAssets = assets.map((asset) => {
      const priceData = prices[asset.symbol];
      // asset에 이미 currentPrice가 있으면 사용, 없으면 prices에서 가져옴
      // 둘 다 없으면 0 (avgPrice로 fallback하지 않음)
      const currentPrice = asset.currentPrice || priceData?.price || 0;
      const change24h = asset.change24h ?? priceData?.change24h ?? 0;
      const value = asset.amount * currentPrice;
      // avgPrice가 0이면 수익률 계산 불가
      const pnl =
        asset.avgPrice > 0
          ? ((currentPrice - asset.avgPrice) / asset.avgPrice) * 100
          : 0;
      const pnlValue =
        asset.avgPrice > 0 ? (currentPrice - asset.avgPrice) * asset.amount : 0;

      return {
        ...asset,
        currentPrice,
        change24h,
        value,
        pnl,
        pnlValue,
      };
    });

    // Calculate totals
    const totalCrypto = enrichedAssets.reduce(
      (sum, a) => sum + (a.value || 0),
      0
    );
    const totalValue = totalCrypto + totalCash;
    const totalPnl = enrichedAssets.reduce(
      (sum, a) => sum + (a.pnlValue || 0),
      0
    );

    // Add allocation percentages
    const assetsWithAllocation = enrichedAssets.map((asset) => ({
      ...asset,
      allocation: totalValue > 0 ? ((asset.value || 0) / totalValue) * 100 : 0,
    }));

    return {
      assets: assetsWithAllocation,
      totalValue,
      totalCash,
      totalCrypto,
      cashAllocation: totalValue > 0 ? (totalCash / totalValue) * 100 : 0,
      totalPnl,
    };
  }, [assets, cash, prices, exchangeRate]);
};
