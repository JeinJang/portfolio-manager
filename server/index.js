import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "crypto-js";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// Upbit API Authentication
// ============================================

const createUpbitToken = (query = null) => {
  const accessKey = process.env.UPBIT_ACCESS_KEY;
  const secretKey = process.env.UPBIT_SECRET_KEY;

  if (!accessKey || !secretKey) {
    throw new Error("Upbit API keys not configured");
  }

  const payload = {
    access_key: accessKey,
    nonce: uuidv4(),
  };

  if (query) {
    const queryString = new URLSearchParams(query).toString();
    const hash = crypto.SHA512(queryString).toString(crypto.enc.Hex);
    payload.query_hash = hash;
    payload.query_hash_alg = "SHA512";
  }

  // Simple JWT-like token (for demo - in production use proper JWT library)
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );
  const signature = crypto
    .HmacSHA256(`${header}.${payloadBase64}`, secretKey)
    .toString(crypto.enc.Base64url);

  return `${header}.${payloadBase64}.${signature}`;
};

// ============================================
// Bithumb API Authentication
// ============================================

const createBithumbSignature = (endpoint, params = {}) => {
  const apiKey = process.env.BITHUMB_API_KEY;
  const secretKey = process.env.BITHUMB_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error("Bithumb API keys not configured");
  }

  const timestamp = Date.now();
  const queryString = new URLSearchParams({ ...params, endpoint }).toString();
  const hmacData = `${endpoint}\x00${queryString}\x00${timestamp}`;

  const signature = crypto
    .HmacSHA512(hmacData, secretKey)
    .toString(crypto.enc.Hex);

  return {
    "Api-Key": apiKey,
    "Api-Sign": Buffer.from(signature).toString("base64"),
    "Api-Nonce": timestamp.toString(),
  };
};

// ============================================
// Public Price API Routes (CORS Proxy)
// ============================================

// Upbit public ticker (no auth required)
app.get("/api/upbit/ticker", async (req, res) => {
  try {
    const response = await axios.get(
      `https://api.upbit.com/v1/ticker/all?quote_currencies=KRW`
    );

    res.json(response.data);
  } catch (error) {
    console.error("Upbit ticker error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bithumb public ticker (no auth required)
app.get("/api/bithumb/ticker", async (req, res) => {
  try {
    const { symbols } = req.query;
    if (!symbols) {
      return res
        .status(400)
        .json({ success: false, error: "symbols parameter required" });
    }

    // Bithumb ALL ticker endpoint
    const response = await axios.get(
      "https://api.bithumb.com/public/ticker/ALL_KRW"
    );

    if (response.data.status === "0000") {
      // Filter only requested symbols
      const symbolList = symbols.split(",");
      const filteredData = {};
      for (const symbol of symbolList) {
        if (response.data.data[symbol]) {
          filteredData[symbol] = response.data.data[symbol];
        }
      }

      res.json({
        status: "0000",
        data: filteredData,
      });
    } else {
      res.json(response.data);
    }
  } catch (error) {
    console.error("Bithumb ticker error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Upbit API Routes
// ============================================

// Check connection status
app.get("/api/exchange/upbit/status", async (req, res) => {
  try {
    if (!process.env.UPBIT_ACCESS_KEY || !process.env.UPBIT_SECRET_KEY) {
      return res.json({
        success: true,
        data: { connected: false },
        timestamp: Date.now(),
      });
    }

    const token = createUpbitToken();
    const response = await axios.get("https://api.upbit.com/v1/accounts", {
      headers: { Authorization: `Bearer ${token}` },
    });

    res.json({
      success: true,
      data: { connected: true, accountCount: response.data.length },
      timestamp: Date.now(),
    });
  } catch (error) {
    res.json({
      success: true,
      data: { connected: false, error: error.message },
      timestamp: Date.now(),
    });
  }
});

// Get account balances
app.get("/api/exchange/upbit/accounts", async (req, res) => {
  try {
    const token = createUpbitToken();
    const response = await axios.get("https://api.upbit.com/v1/accounts", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const balances = response.data.map((account) => ({
      currency: account.currency,
      balance: parseFloat(account.balance),
      locked: parseFloat(account.locked),
      avgBuyPrice: parseFloat(account.avg_buy_price),
    }));

    res.json({ success: true, data: balances, timestamp: Date.now() });
  } catch (error) {
    console.error(
      "Upbit accounts error:",
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message,
      timestamp: Date.now(),
    });
  }
});

// Get orders
app.get("/api/exchange/upbit/orders", async (req, res) => {
  try {
    const { market, state = "wait" } = req.query;
    const params = { market, state };

    const token = createUpbitToken(params);
    const response = await axios.get("https://api.upbit.com/v1/orders", {
      headers: { Authorization: `Bearer ${token}` },
      params,
    });

    const orders = response.data.map((order) => ({
      uuid: order.uuid,
      side: order.side,
      ordType: order.ord_type,
      price: parseFloat(order.price || 0),
      volume: parseFloat(order.volume),
      remainingVolume: parseFloat(order.remaining_volume),
      state: order.state,
      market: order.market,
      createdAt: order.created_at,
    }));

    res.json({ success: true, data: orders, timestamp: Date.now() });
  } catch (error) {
    console.error("Upbit orders error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message,
      timestamp: Date.now(),
    });
  }
});

// Place order
app.post("/api/exchange/upbit/order", async (req, res) => {
  try {
    const { market, side, ord_type, price, volume } = req.body;
    const params = { market, side, ord_type };

    if (price) params.price = price;
    if (volume) params.volume = volume;

    const token = createUpbitToken(params);
    const response = await axios.post(
      "https://api.upbit.com/v1/orders",
      params,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json({
      success: true,
      data: {
        uuid: response.data.uuid,
        side: response.data.side,
        ordType: response.data.ord_type,
        price: parseFloat(response.data.price || 0),
        volume: parseFloat(response.data.volume),
        remainingVolume: parseFloat(response.data.remaining_volume),
        state: response.data.state,
        market: response.data.market,
        createdAt: response.data.created_at,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Upbit order error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message,
      timestamp: Date.now(),
    });
  }
});

// Cancel order
app.delete("/api/exchange/upbit/order", async (req, res) => {
  try {
    const { uuid } = req.query;
    const params = { uuid };

    const token = createUpbitToken(params);
    const response = await axios.delete("https://api.upbit.com/v1/order", {
      headers: { Authorization: `Bearer ${token}` },
      params,
    });

    res.json({ success: true, data: response.data, timestamp: Date.now() });
  } catch (error) {
    console.error("Upbit cancel error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message,
      timestamp: Date.now(),
    });
  }
});

// ============================================
// Bithumb API Routes
// ============================================

// Check connection status
app.get("/api/exchange/bithumb/status", async (req, res) => {
  try {
    if (!process.env.BITHUMB_API_KEY || !process.env.BITHUMB_SECRET_KEY) {
      return res.json({
        success: true,
        data: { connected: false },
        timestamp: Date.now(),
      });
    }

    const endpoint = "/info/balance";
    const params = { currency: "BTC" };
    const headers = createBithumbSignature(endpoint, params);

    const response = await axios.post(
      `https://api.bithumb.com${endpoint}`,
      new URLSearchParams(params),
      {
        headers: {
          ...headers,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    res.json({
      success: true,
      data: { connected: response.data.status === "0000" },
      timestamp: Date.now(),
    });
  } catch (error) {
    res.json({
      success: true,
      data: { connected: false, error: error.message },
      timestamp: Date.now(),
    });
  }
});

// Get account balances
app.get("/api/exchange/bithumb/accounts", async (req, res) => {
  try {
    const endpoint = "/info/balance";
    const params = { currency: "ALL" };
    const headers = createBithumbSignature(endpoint, params);

    const response = await axios.post(
      `https://api.bithumb.com${endpoint}`,
      new URLSearchParams(params),
      {
        headers: {
          ...headers,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    if (response.data.status !== "0000") {
      throw new Error(response.data.message);
    }

    const data = response.data.data;
    const balances = [];

    // Parse Bithumb balance format
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith("available_") && parseFloat(value) > 0) {
        const currency = key.replace("available_", "").toUpperCase();
        balances.push({
          currency,
          balance: parseFloat(value),
          locked: parseFloat(data[`in_use_${currency.toLowerCase()}`] || 0),
          avgBuyPrice: 0, // Bithumb doesn't provide this directly
        });
      }
    }

    res.json({ success: true, data: balances, timestamp: Date.now() });
  } catch (error) {
    console.error(
      "Bithumb accounts error:",
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now(),
    });
  }
});

// Place order
app.post("/api/exchange/bithumb/order", async (req, res) => {
  try {
    const { order_currency, payment_currency, type, units, price } = req.body;
    const endpoint = "/trade/place";
    const params = {
      order_currency,
      payment_currency: payment_currency || "KRW",
      type, // bid or ask
      units,
    };

    if (price) params.price = price;

    const headers = createBithumbSignature(endpoint, params);

    const response = await axios.post(
      `https://api.bithumb.com${endpoint}`,
      new URLSearchParams(params),
      {
        headers: {
          ...headers,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    if (response.data.status !== "0000") {
      throw new Error(response.data.message);
    }

    res.json({
      success: true,
      data: {
        uuid: response.data.order_id,
        side: type,
        market: `${order_currency}_${payment_currency}`,
        state: "wait",
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error(
      "Bithumb order error:",
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now(),
    });
  }
});

// Cancel order
app.delete("/api/exchange/bithumb/order", async (req, res) => {
  try {
    const { order_id, order_currency } = req.query;
    const endpoint = "/trade/cancel";
    const params = {
      type: "bid", // or ask - needs to be provided
      order_id,
      order_currency,
      payment_currency: "KRW",
    };

    const headers = createBithumbSignature(endpoint, params);

    const response = await axios.post(
      `https://api.bithumb.com${endpoint}`,
      new URLSearchParams(params),
      {
        headers: {
          ...headers,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    if (response.data.status !== "0000") {
      throw new Error(response.data.message);
    }

    res.json({ success: true, data: response.data, timestamp: Date.now() });
  } catch (error) {
    console.error(
      "Bithumb cancel error:",
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now(),
    });
  }
});

// ============================================
// Onchain Data Routes (with API Key Protection)
// ============================================

// Glassnode API proxy
app.get("/api/onchain/glassnode", async (req, res) => {
  try {
    const apiKey = process.env.GLASSNODE_API_KEY;

    if (!apiKey) {
      // Return mock data if no API key
      return res.json({
        success: true,
        data: {
          mvrv: 1.8 + (Math.random() - 0.5) * 0.4,
          exchangeNetflow: Math.random() * 20000 - 10000,
          exchangeReserve: 2400000 + Math.random() * 100000,
          realizedPrice: 30000 + Math.random() * 5000,
        },
        timestamp: Date.now(),
        note: "Mock data - Add GLASSNODE_API_KEY for real data",
      });
    }

    const [mvrvRes, netflowRes, reserveRes] = await Promise.all([
      axios.get("https://api.glassnode.com/v1/metrics/market/mvrv", {
        params: { a: "BTC", api_key: apiKey },
      }),
      axios.get(
        "https://api.glassnode.com/v1/metrics/transactions/transfers_volume_exchanges_net",
        {
          params: { a: "BTC", api_key: apiKey },
        }
      ),
      axios.get(
        "https://api.glassnode.com/v1/metrics/distribution/balance_exchanges",
        {
          params: { a: "BTC", api_key: apiKey },
        }
      ),
    ]);

    res.json({
      success: true,
      data: {
        mvrv: mvrvRes.data[mvrvRes.data.length - 1]?.v || 0,
        exchangeNetflow: netflowRes.data[netflowRes.data.length - 1]?.v || 0,
        exchangeReserve: reserveRes.data[reserveRes.data.length - 1]?.v || 0,
        realizedPrice: 0, // Need separate API call
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Glassnode API error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now(),
    });
  }
});

// CryptoQuant API proxy
app.get("/api/onchain/cryptoquant", async (req, res) => {
  try {
    const apiKey = process.env.CRYPTOQUANT_API_KEY;

    if (!apiKey) {
      // Return mock data if no API key
      return res.json({
        success: true,
        data: {
          exchangeReserve: 2400000 + Math.random() * 100000,
          exchangeNetflow: Math.random() * 10000 - 5000,
          fundFlowRatio: 0.3 + Math.random() * 0.4,
        },
        timestamp: Date.now(),
        note: "Mock data - Add CRYPTOQUANT_API_KEY for real data",
      });
    }

    const response = await axios.get(
      "https://api.cryptoquant.com/v1/btc/exchange-flows/reserve",
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    res.json({
      success: true,
      data: response.data,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("CryptoQuant API error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now(),
    });
  }
});

// ============================================
// Market Indices Routes
// ============================================

app.get("/api/market/indices", async (req, res) => {
  try {
    // Using Alpha Vantage or Yahoo Finance for stock indices
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

    if (!apiKey) {
      // Return mock data if no API key
      return res.json({
        success: true,
        data: {
          sp500: 4500 + Math.random() * 200,
          nasdaq: 14000 + Math.random() * 500,
          vix: 15 + Math.random() * 10,
        },
        timestamp: Date.now(),
        note: "Mock data - Add ALPHA_VANTAGE_API_KEY for real data",
      });
    }

    // Fetch real data from Alpha Vantage
    const [sp500Res, vixRes] = await Promise.all([
      axios.get(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=SPY&apikey=${apiKey}`
      ),
      axios.get(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VIX&apikey=${apiKey}`
      ),
    ]);

    res.json({
      success: true,
      data: {
        sp500:
          parseFloat(sp500Res.data["Global Quote"]?.["05. price"] || 0) * 10, // SPY to S&P500 approx
        nasdaq: 0, // Need separate symbol
        vix: parseFloat(vixRes.data["Global Quote"]?.["05. price"] || 20),
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Market indices error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now(),
    });
  }
});

// ============================================
// Health Check
// ============================================

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: Date.now(),
    env: {
      upbitConfigured: !!(
        process.env.UPBIT_ACCESS_KEY && process.env.UPBIT_SECRET_KEY
      ),
      bithumbConfigured: !!(
        process.env.BITHUMB_API_KEY && process.env.BITHUMB_SECRET_KEY
      ),
      glassnodeConfigured: !!process.env.GLASSNODE_API_KEY,
      cryptoquantConfigured: !!process.env.CRYPTOQUANT_API_KEY,
    },
  });
});

// ============================================
// Start Server
// ============================================

app.listen(PORT, () => {
  console.log(`Portfolio Manager API Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
