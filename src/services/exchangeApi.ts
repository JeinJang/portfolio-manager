import axios from 'axios';
import type { ExchangeBalance, ExchangeOrder, TradeResult, ApiResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ============================================
// Upbit Private API (via Backend Proxy)
// ============================================

export const upbitApi = {
  // Get account balances
  getBalances: async (): Promise<ExchangeBalance[]> => {
    try {
      const response = await axios.get<ApiResponse<ExchangeBalance[]>>(
        `${API_BASE}/exchange/upbit/accounts`
      );
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Failed to fetch balances');
    } catch (error) {
      console.error('Upbit Get Balances Error:', error);
      throw error;
    }
  },

  // Get order history
  getOrders: async (market: string, state: 'wait' | 'done' | 'cancel' = 'wait'): Promise<ExchangeOrder[]> => {
    try {
      const response = await axios.get<ApiResponse<ExchangeOrder[]>>(
        `${API_BASE}/exchange/upbit/orders`,
        { params: { market, state } }
      );
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Failed to fetch orders');
    } catch (error) {
      console.error('Upbit Get Orders Error:', error);
      throw error;
    }
  },

  // Place market buy order
  marketBuy: async (market: string, krwAmount: number): Promise<TradeResult> => {
    try {
      const response = await axios.post<ApiResponse<ExchangeOrder>>(
        `${API_BASE}/exchange/upbit/order`,
        {
          market,
          side: 'bid',
          ord_type: 'price',
          price: krwAmount.toString(),
        }
      );
      if (response.data.success && response.data.data) {
        return { success: true, order: response.data.data };
      }
      return { success: false, error: response.data.error };
    } catch (error: any) {
      console.error('Upbit Market Buy Error:', error);
      return { success: false, error: error.message };
    }
  },

  // Place market sell order
  marketSell: async (market: string, volume: number): Promise<TradeResult> => {
    try {
      const response = await axios.post<ApiResponse<ExchangeOrder>>(
        `${API_BASE}/exchange/upbit/order`,
        {
          market,
          side: 'ask',
          ord_type: 'market',
          volume: volume.toString(),
        }
      );
      if (response.data.success && response.data.data) {
        return { success: true, order: response.data.data };
      }
      return { success: false, error: response.data.error };
    } catch (error: any) {
      console.error('Upbit Market Sell Error:', error);
      return { success: false, error: error.message };
    }
  },

  // Place limit order
  limitOrder: async (
    market: string,
    side: 'bid' | 'ask',
    price: number,
    volume: number
  ): Promise<TradeResult> => {
    try {
      const response = await axios.post<ApiResponse<ExchangeOrder>>(
        `${API_BASE}/exchange/upbit/order`,
        {
          market,
          side,
          ord_type: 'limit',
          price: price.toString(),
          volume: volume.toString(),
        }
      );
      if (response.data.success && response.data.data) {
        return { success: true, order: response.data.data };
      }
      return { success: false, error: response.data.error };
    } catch (error: any) {
      console.error('Upbit Limit Order Error:', error);
      return { success: false, error: error.message };
    }
  },

  // Cancel order
  cancelOrder: async (uuid: string): Promise<TradeResult> => {
    try {
      const response = await axios.delete<ApiResponse<ExchangeOrder>>(
        `${API_BASE}/exchange/upbit/order`,
        { params: { uuid } }
      );
      if (response.data.success && response.data.data) {
        return { success: true, order: response.data.data };
      }
      return { success: false, error: response.data.error };
    } catch (error: any) {
      console.error('Upbit Cancel Order Error:', error);
      return { success: false, error: error.message };
    }
  },
};

// ============================================
// Bithumb Private API (via Backend Proxy)
// ============================================

export const bithumbApi = {
  // Get account balances
  getBalances: async (): Promise<ExchangeBalance[]> => {
    try {
      const response = await axios.get<ApiResponse<ExchangeBalance[]>>(
        `${API_BASE}/exchange/bithumb/accounts`
      );
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Failed to fetch balances');
    } catch (error) {
      console.error('Bithumb Get Balances Error:', error);
      throw error;
    }
  },

  // Get order history
  getOrders: async (orderCurrency: string): Promise<ExchangeOrder[]> => {
    try {
      const response = await axios.get<ApiResponse<ExchangeOrder[]>>(
        `${API_BASE}/exchange/bithumb/orders`,
        { params: { order_currency: orderCurrency, payment_currency: 'KRW' } }
      );
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Failed to fetch orders');
    } catch (error) {
      console.error('Bithumb Get Orders Error:', error);
      throw error;
    }
  },

  // Place market buy order
  marketBuy: async (orderCurrency: string, units: number): Promise<TradeResult> => {
    try {
      const response = await axios.post<ApiResponse<ExchangeOrder>>(
        `${API_BASE}/exchange/bithumb/order`,
        {
          order_currency: orderCurrency,
          payment_currency: 'KRW',
          type: 'bid',
          units: units.toString(),
        }
      );
      if (response.data.success && response.data.data) {
        return { success: true, order: response.data.data };
      }
      return { success: false, error: response.data.error };
    } catch (error: any) {
      console.error('Bithumb Market Buy Error:', error);
      return { success: false, error: error.message };
    }
  },

  // Place market sell order
  marketSell: async (orderCurrency: string, units: number): Promise<TradeResult> => {
    try {
      const response = await axios.post<ApiResponse<ExchangeOrder>>(
        `${API_BASE}/exchange/bithumb/order`,
        {
          order_currency: orderCurrency,
          payment_currency: 'KRW',
          type: 'ask',
          units: units.toString(),
        }
      );
      if (response.data.success && response.data.data) {
        return { success: true, order: response.data.data };
      }
      return { success: false, error: response.data.error };
    } catch (error: any) {
      console.error('Bithumb Market Sell Error:', error);
      return { success: false, error: error.message };
    }
  },

  // Cancel order
  cancelOrder: async (orderId: string, orderCurrency: string): Promise<TradeResult> => {
    try {
      const response = await axios.delete<ApiResponse<ExchangeOrder>>(
        `${API_BASE}/exchange/bithumb/order`,
        { params: { order_id: orderId, order_currency: orderCurrency } }
      );
      if (response.data.success && response.data.data) {
        return { success: true, order: response.data.data };
      }
      return { success: false, error: response.data.error };
    } catch (error: any) {
      console.error('Bithumb Cancel Order Error:', error);
      return { success: false, error: error.message };
    }
  },
};

// ============================================
// Unified Exchange Interface
// ============================================

// 거래 API를 지원하는 거래소 타입 (현재 upbit, bithumb만 지원)
// 전체 ExchangeType은 types/index.ts에 정의됨
export type SupportedTradingExchange = 'upbit' | 'bithumb';

export const exchangeApi = {
  getBalances: async (exchange: SupportedTradingExchange): Promise<ExchangeBalance[]> => {
    if (exchange === 'upbit') return upbitApi.getBalances();
    if (exchange === 'bithumb') return bithumbApi.getBalances();
    throw new Error(`Unsupported exchange: ${exchange}`);
  },

  marketBuy: async (
    exchange: SupportedTradingExchange,
    symbol: string,
    amount: number
  ): Promise<TradeResult> => {
    if (exchange === 'upbit') {
      return upbitApi.marketBuy(`KRW-${symbol}`, amount);
    }
    if (exchange === 'bithumb') {
      return bithumbApi.marketBuy(symbol, amount);
    }
    return { success: false, error: `Unsupported exchange: ${exchange}` };
  },

  marketSell: async (
    exchange: SupportedTradingExchange,
    symbol: string,
    volume: number
  ): Promise<TradeResult> => {
    if (exchange === 'upbit') {
      return upbitApi.marketSell(`KRW-${symbol}`, volume);
    }
    if (exchange === 'bithumb') {
      return bithumbApi.marketSell(symbol, volume);
    }
    return { success: false, error: `Unsupported exchange: ${exchange}` };
  },
};

// ============================================
// Exchange API Status Check
// ============================================

export const checkExchangeConnection = async (): Promise<{
  upbit: boolean;
  bithumb: boolean;
}> => {
  const results = { upbit: false, bithumb: false };

  try {
    const upbitResponse = await axios.get<ApiResponse<{ connected: boolean }>>(
      `${API_BASE}/exchange/upbit/status`
    );
    results.upbit = upbitResponse.data.success && upbitResponse.data.data?.connected === true;
  } catch {
    results.upbit = false;
  }

  try {
    const bithumbResponse = await axios.get<ApiResponse<{ connected: boolean }>>(
      `${API_BASE}/exchange/bithumb/status`
    );
    results.bithumb = bithumbResponse.data.success && bithumbResponse.data.data?.connected === true;
  } catch {
    results.bithumb = false;
  }

  return results;
};
