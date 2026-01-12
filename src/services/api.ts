import axios from "axios";
import type {
  PriceData,
  FearGreedData,
  OnchainData,
  ApiResponse,
  UpbitTickerResponse,
} from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

// ============================================
// Crypto Price APIs (Public - No API Key Required)
// ============================================

export const fetchUpbitPrices = async (
  symbols: string[]
): Promise<Record<string, PriceData> | null> => {
  try {
    if (symbols.length === 0) return {};

    const markets = symbols.map((s) => `KRW-${s}`).join(",");
    // 백엔드 프록시를 통해 호출 (CORS 우회)
    const response = await axios.get<UpbitTickerResponse[]>(
      `${API_BASE}/upbit/ticker`
    );

    return response.data.reduce((acc, item) => {
      const symbol = item.market.replace("KRW-", "");
      acc[symbol] = {
        price: item.trade_price,
        change24h: item.signed_change_rate * 100,
        volume24h: item.acc_trade_price_24h,
        high24h: item.high_price,
        low24h: item.low_price,
        timestamp: Date.now(),
      };
      return acc;
    }, {} as Record<string, PriceData>);
  } catch (error) {
    console.error("Upbit API Error:", error);
    return null;
  }
};

export const fetchBithumbPrices = async (
  symbols: string[]
): Promise<Record<string, PriceData> | null> => {
  try {
    if (symbols.length === 0) return {};

    // 백엔드 프록시를 통해 호출 (CORS 우회)
    const response = await axios.get<{
      status: string;
      data: Record<
        string,
        {
          closing_price: string;
          fluctate_rate_24H: string;
          acc_trade_value_24H: string;
          max_price: string;
          min_price: string;
        }
      >;
    }>(`${API_BASE}/bithumb/ticker?symbols=${symbols.join(",")}`);

    if (response.data.status === "0000") {
      const results: Record<string, PriceData> = {};
      for (const symbol of symbols) {
        const data = response.data.data[symbol];
        if (data) {
          results[symbol] = {
            price: parseFloat(data.closing_price),
            change24h: parseFloat(data.fluctate_rate_24H),
            volume24h: parseFloat(data.acc_trade_value_24H),
            high24h: parseFloat(data.max_price),
            low24h: parseFloat(data.min_price),
            timestamp: Date.now(),
          };
        }
      }
      return results;
    }
    return null;
  } catch (error) {
    console.error("Bithumb API Error:", error);
    return null;
  }
};

// CoinGecko - Global USD Prices
export const fetchGlobalPrices = async (
  ids: string[]
): Promise<Record<string, { usd: number; usd_24h_change: number }> | null> => {
  try {
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price`,
      {
        params: {
          ids: ids.join(","),
          vs_currencies: "usd",
          include_24hr_change: true,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("CoinGecko API Error:", error);
    return null;
  }
};

// ============================================
// Macro Indicator APIs
// ============================================

export const fetchFearGreedIndex = async (): Promise<FearGreedData> => {
  try {
    const response = await axios.get("https://api.alternative.me/fng/?limit=1");
    const data = response.data.data[0];
    const value = parseInt(data.value);

    let classification: FearGreedData["classification"] = "Neutral";
    if (value <= 25) classification = "Extreme Fear";
    else if (value <= 45) classification = "Fear";
    else if (value <= 55) classification = "Neutral";
    else if (value <= 75) classification = "Greed";
    else classification = "Extreme Greed";

    return {
      value,
      classification,
      timestamp: data.timestamp,
    };
  } catch (error) {
    console.error("Fear & Greed API Error:", error);
    return { value: 50, classification: "Neutral", timestamp: "" };
  }
};

export const fetchExchangeRate = async (): Promise<number> => {
  try {
    const response = await axios.get(
      "https://api.exchangerate-api.com/v4/latest/USD"
    );
    return response.data.rates.KRW;
  } catch (error) {
    console.error("Exchange Rate API Error:", error);
    return 1380;
  }
};

// ============================================
// Onchain Data APIs (Real Data Sources)
// ============================================

// Blockchain.info - BTC Basic Onchain Data
export const fetchBTCBasicOnchain =
  async (): Promise<Partial<OnchainData> | null> => {
    try {
      const [statsResponse, difficultyResponse, txCountResponse] =
        await Promise.all([
          axios.get("https://api.blockchain.info/stats"),
          axios.get("https://api.blockchain.info/q/getdifficulty"),
          axios.get("https://api.blockchain.info/q/24hrtransactioncount"),
        ]);

      return {
        hashRate: parseFloat((statsResponse.data.hash_rate / 1e18).toFixed(2)),
        difficulty: parseFloat(
          (parseFloat(difficultyResponse.data) / 1e12).toFixed(2)
        ),
        txCount24h: parseInt(txCountResponse.data),
        circulatingSupply: statsResponse.data.totalbc / 1e8,
        totalSupply: 21000000,
      };
    } catch (error) {
      console.error("BTC Onchain API Error:", error);
      return null;
    }
  };

// Mempool.space - Additional BTC Data
export const fetchMempoolData = async (): Promise<{
  feeRates: { fastestFee: number; halfHourFee: number; hourFee: number };
  mempoolSize: number;
} | null> => {
  try {
    const [feesResponse, mempoolResponse] = await Promise.all([
      axios.get("https://mempool.space/api/v1/fees/recommended"),
      axios.get("https://mempool.space/api/mempool"),
    ]);

    return {
      feeRates: feesResponse.data,
      mempoolSize: mempoolResponse.data.count,
    };
  } catch (error) {
    console.error("Mempool API Error:", error);
    return null;
  }
};

// CoinMetrics - Free Community API
export const fetchCoinMetricsData = async (
  asset: string = "btc"
): Promise<{
  nvt: number;
  activeAddresses: number;
} | null> => {
  try {
    const response = await axios.get(
      `https://community-api.coinmetrics.io/v4/timeseries/asset-metrics`,
      {
        params: {
          assets: asset,
          metrics: "NVTAdj,AdrActCnt",
          frequency: "1d",
          page_size: 1,
          sort: "time",
          sort_ascending: false,
        },
      }
    );

    if (response.data.data && response.data.data.length > 0) {
      const latest = response.data.data[0];
      return {
        nvt: parseFloat(latest.NVTAdj) || 0,
        activeAddresses: parseInt(latest.AdrActCnt) || 0,
      };
    }
    return null;
  } catch (error) {
    console.error("CoinMetrics API Error:", error);
    return null;
  }
};

// Glassnode Free Metrics (via Backend Proxy)
export const fetchGlassnodeData = async (): Promise<{
  mvrv: number;
  exchangeNetflow: number;
  exchangeReserve: number;
  realizedPrice: number;
} | null> => {
  try {
    const response = await axios.get<
      ApiResponse<{
        mvrv: number;
        exchangeNetflow: number;
        exchangeReserve: number;
        realizedPrice: number;
      }>
    >(`${API_BASE}/onchain/glassnode`);

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    return null;
  } catch (error) {
    console.error("Glassnode API Error:", error);
    return null;
  }
};

// CryptoQuant (via Backend Proxy)
export const fetchCryptoQuantData = async (): Promise<{
  exchangeReserve: number;
  exchangeNetflow: number;
  fundFlowRatio: number;
} | null> => {
  try {
    const response = await axios.get<
      ApiResponse<{
        exchangeReserve: number;
        exchangeNetflow: number;
        fundFlowRatio: number;
      }>
    >(`${API_BASE}/onchain/cryptoquant`);

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    return null;
  } catch (error) {
    console.error("CryptoQuant API Error:", error);
    return null;
  }
};

// ============================================
// Stock Market Data
// ============================================

export const fetchStockIndices = async (): Promise<{
  sp500: number;
  nasdaq: number;
  vix: number;
} | null> => {
  try {
    const response = await axios.get<
      ApiResponse<{
        sp500: number;
        nasdaq: number;
        vix: number;
      }>
    >(`${API_BASE}/market/indices`);

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    return null;
  } catch (error) {
    console.error("Stock Indices API Error:", error);
    return null;
  }
};

// ============================================
// Aggregated Data Fetchers
// ============================================

export const fetchAllOnchainData = async (): Promise<OnchainData | null> => {
  try {
    const [basicOnchain, coinMetrics, glassnodeData] = await Promise.all([
      fetchBTCBasicOnchain(),
      fetchCoinMetricsData(),
      fetchGlassnodeData(),
    ]);

    if (!basicOnchain) return null;

    return {
      hashRate: basicOnchain.hashRate || 0,
      difficulty: basicOnchain.difficulty || 0,
      txCount24h: basicOnchain.txCount24h || 0,
      circulatingSupply: basicOnchain.circulatingSupply || 0,
      totalSupply: basicOnchain.totalSupply || 21000000,
      activeAddresses: coinMetrics?.activeAddresses || 0,
      nvt: coinMetrics?.nvt || 0,
      mvrv: glassnodeData?.mvrv || 1.8,
      realizedPrice: glassnodeData?.realizedPrice || 0,
      exchangeNetflow: glassnodeData?.exchangeNetflow || 0,
      exchangeReserve: glassnodeData?.exchangeReserve || 0,
    };
  } catch (error) {
    console.error("Aggregated Onchain Data Error:", error);
    return null;
  }
};

export const fetchAllMarketData = async (
  symbols: string[] = ["BTC", "ETH", "XRP", "SOL"]
) => {
  const symbolToGeckoId: Record<string, string> = {
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

  const geckoIds = symbols.map((s) => symbolToGeckoId[s]).filter(Boolean);

  const [fearGreed, exchangeRate, upbitPrices, globalPrices, onchain] =
    await Promise.all([
      fetchFearGreedIndex(),
      fetchExchangeRate(),
      fetchUpbitPrices(symbols),
      fetchGlobalPrices(geckoIds),
      fetchAllOnchainData(),
    ]);

  // Calculate Kimchi Premium
  const kimchiPremiums: Record<string, number> = {};
  let totalPremium = 0;
  let count = 0;

  if (upbitPrices && globalPrices && exchangeRate) {
    symbols.forEach((symbol) => {
      const geckoId = symbolToGeckoId[symbol];
      if (upbitPrices[symbol] && globalPrices[geckoId]) {
        const krwPrice = upbitPrices[symbol].price;
        const usdPrice = globalPrices[geckoId].usd;
        const premium = calculateKimchiPremium(
          krwPrice,
          usdPrice,
          exchangeRate
        );
        kimchiPremiums[symbol] = premium;
        totalPremium += premium;
        count++;
      }
    });
  }

  return {
    prices: upbitPrices || {},
    globalPrices: globalPrices || {},
    fearGreed,
    exchangeRate,
    onchain,
    kimchiPremiums,
    avgKimchiPremium: count > 0 ? totalPremium / count : 0,
    lastUpdated: new Date(),
  };
};

// ============================================
// Utility Functions
// ============================================

export const calculateKimchiPremium = (
  krwPrice: number,
  usdPrice: number,
  exchangeRate: number
): number => {
  const krwEquivalent = usdPrice * exchangeRate;
  return ((krwPrice - krwEquivalent) / krwEquivalent) * 100;
};

// Symbol to CoinGecko ID mapping
export const SYMBOL_TO_GECKO_ID: Record<string, string> = {
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
  ATOM: "cosmos",
  UNI: "uniswap",
  AAVE: "aave",
  SNX: "synthetix-network-token",
  COMP: "compound-governance-token",
};
