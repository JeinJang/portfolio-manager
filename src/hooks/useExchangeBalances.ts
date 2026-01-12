import { useState, useEffect, useCallback, useRef } from "react";
import { upbitApi, bithumbApi } from "../services/exchangeApi";
import { fetchUpbitPrices, fetchBithumbPrices } from "../services/api";
import type { Asset, CashHolding } from "../types";

// ============================================
// Crypto Name Mapping
// ============================================

const CRYPTO_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  XRP: "Ripple",
  SOL: "Solana",
  DOGE: "Dogecoin",
  ADA: "Cardano",
  AVAX: "Avalanche",
  DOT: "Polkadot",
  MATIC: "Polygon",
  LINK: "Chainlink",
  ATOM: "Cosmos",
  UNI: "Uniswap",
  AAVE: "Aave",
  ETC: "Ethereum Classic",
  BCH: "Bitcoin Cash",
  LTC: "Litecoin",
  TRX: "Tron",
  XLM: "Stellar",
  NEAR: "NEAR Protocol",
  APT: "Aptos",
  ARB: "Arbitrum",
  OP: "Optimism",
  SUI: "Sui",
  SEI: "Sei",
  SAND: "The Sandbox",
  MANA: "Decentraland",
  AXS: "Axie Infinity",
  IMX: "Immutable X",
  SHIB: "Shiba Inu",
  PEPE: "Pepe",
};

// ============================================
// useExchangeBalances Hook
// ============================================

export const useExchangeBalances = (refreshInterval: number = 100000) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [cash, setCash] = useState<CashHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isFetchingRef = useRef(false);

  const fetchBalances = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const newAssets: Asset[] = [];
      const newCash: CashHolding[] = [];

      // Fetch Upbit balances
      try {
        const upbitBalances = await upbitApi.getBalances();

        for (const balance of upbitBalances) {
          const totalBalance = balance.balance + balance.locked;
          if (totalBalance <= 0) continue;

          if (balance.currency === "KRW") {
            newCash.push({
              id: "upbit-krw",
              currency: "KRW",
              name: "원화 (업비트)",
              amount: totalBalance,
              icon: "₩",
              exchange: "upbit",
            });
          } else {
            newAssets.push({
              id: `upbit-${balance.currency}`,
              symbol: balance.currency,
              name: CRYPTO_NAMES[balance.currency] || balance.currency,
              type: "crypto",
              exchange: "upbit",
              amount: totalBalance,
              avgPrice: balance.avgBuyPrice || 0,
            });
          }
        }
      } catch (err) {
        console.log("Upbit not connected or error:", err);
      }

      // Fetch Bithumb balances
      try {
        const bithumbBalances = await bithumbApi.getBalances();

        for (const balance of bithumbBalances) {
          const totalBalance = balance.balance + balance.locked;
          if (totalBalance <= 0) continue;

          if (balance.currency === "KRW") {
            newCash.push({
              id: "bithumb-krw",
              currency: "KRW",
              name: "원화 (빗썸)",
              amount: totalBalance,
              icon: "₩",
              exchange: "bithumb",
            });
          } else {
            // Check if already exists from Upbit
            const existingIndex = newAssets.findIndex(
              (a) => a.symbol === balance.currency && a.exchange === "bithumb"
            );

            if (existingIndex === -1) {
              newAssets.push({
                id: `bithumb-${balance.currency}`,
                symbol: balance.currency,
                name: CRYPTO_NAMES[balance.currency] || balance.currency,
                type: "crypto",
                exchange: "bithumb",
                amount: totalBalance,
                avgPrice: balance.avgBuyPrice || 0,
              });
            }
          }
        }
      } catch (err) {
        console.log("Bithumb not connected or error:", err);
      }

      // If no exchange connected, return empty
      if (newAssets.length === 0 && newCash.length === 0) {
        setError(
          "거래소 API가 연결되지 않았습니다. .env 파일에 API 키를 설정해주세요."
        );
      } else {
        setError(null);
      }

      setAssets(newAssets);
      setCash(newCash);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch balances");
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchBalances();
    const interval = setInterval(fetchBalances, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchBalances, refreshInterval]);

  return { assets, cash, loading, error, lastUpdated, refetch: fetchBalances };
};

// ============================================
// useRealPortfolio Hook - Combined with prices
// ============================================

export const useRealPortfolio = (refreshInterval: number = 100000) => {
  const {
    assets,
    cash,
    loading: balanceLoading,
    error,
    lastUpdated,
    refetch,
  } = useExchangeBalances(refreshInterval);
  const [enrichedAssets, setEnrichedAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch current prices for assets - 각 거래소별로 가격 조회
  useEffect(() => {
    const fetchPrices = async () => {
      if (assets.length === 0) {
        setEnrichedAssets([]);
        setLoading(balanceLoading);
        return;
      }

      try {
        // 거래소별로 심볼 분류
        const upbitSymbols = [
          ...new Set(
            assets.filter((a) => a.exchange === "upbit").map((a) => a.symbol)
          ),
        ];
        const bithumbSymbols = [
          ...new Set(
            assets.filter((a) => a.exchange === "bithumb").map((a) => a.symbol)
          ),
        ];

        console.log(upbitSymbols);
        // 거래소별로 가격 조회 (병렬)
        const [upbitPrices, bithumbPrices] = await Promise.all([
          upbitSymbols.length > 0 ? fetchUpbitPrices(upbitSymbols) : null,
          bithumbSymbols.length > 0 ? fetchBithumbPrices(bithumbSymbols) : null,
        ]);

        // 각 자산에 해당 거래소 가격 적용
        const updated = assets.map((asset) => {
          let priceData = null;

          if (asset.exchange === "upbit" && upbitPrices) {
            priceData = upbitPrices[asset.symbol];
          } else if (asset.exchange === "bithumb" && bithumbPrices) {
            priceData = bithumbPrices[asset.symbol];
          }

          return {
            ...asset,
            currentPrice: priceData?.price || 0,
            change24h: priceData?.change24h || 0,
          };
        });

        setEnrichedAssets(updated);
      } catch (err) {
        console.error("Failed to fetch prices:", err);
        const updated = assets.map((asset) => ({
          ...asset,
          currentPrice: 0,
          change24h: 0,
        }));
        setEnrichedAssets(updated);
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
  }, [assets, balanceLoading]);

  // Get symbols for market data hook
  const symbols = [...new Set(enrichedAssets.map((a) => a.symbol))];

  return {
    assets: enrichedAssets,
    cash,
    symbols,
    loading: loading || balanceLoading,
    error,
    lastUpdated,
    refetch,
  };
};
