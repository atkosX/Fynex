// Utility functions for Kite Connect API calls

export interface KiteProfile {
  user_id: string;
  user_name: string;
  email: string;
  user_type: string;
  broker: string;
}

export interface KiteHolding {
  tradingsymbol: string;
  exchange: string;
  isin: string;
  quantity: number;
  average_price: number;
  last_price: number;
  pnl: number;
  product: string;
}

export interface KitePosition {
  tradingsymbol: string;
  exchange: string;
  product: string;
  quantity: number;
  overnight_quantity: number;
  multiplier: number;
  average_price: number;
  last_price: number;
  pnl: number;
  m2m: number;
}

export interface KiteQuote {
  instrument_token: number;
  timestamp: string;
  last_price: number;
  last_quantity: number;
  last_trade_time: string;
  average_price: number;
  volume: number;
  buy_quantity: number;
  sell_quantity: number;
  ohlc: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
}

class KiteAPI {
  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('kite_access_token');
  }

  async getProfile(): Promise<KiteProfile | null> {
    const accessToken = this.getAccessToken();
    if (!accessToken) return null;

    try {
      const response = await fetch('/api/kite/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
      });

      const data = await response.json();
      return data.success ? data.profile : null;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  }

  async getHoldings(): Promise<KiteHolding[] | null> {
    const accessToken = this.getAccessToken();
    if (!accessToken) return null;

    try {
      const response = await fetch('/api/kite/holdings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
      });

      const data = await response.json();
      return data.success ? data.holdings : null;
    } catch (error) {
      console.error('Error fetching holdings:', error);
      return null;
    }
  }

  async getPositions(): Promise<{ net: KitePosition[]; day: KitePosition[] } | null> {
    const accessToken = this.getAccessToken();
    if (!accessToken) return null;

    try {
      const response = await fetch('/api/kite/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
      });

      const data = await response.json();
      return data.success ? data.positions : null;
    } catch (error) {
      console.error('Error fetching positions:', error);
      return null;
    }
  }

  async getQuotes(symbols: string[]): Promise<Record<string, KiteQuote> | null> {
    const accessToken = this.getAccessToken();
    if (!accessToken) return null;

    try {
      const response = await fetch('/api/kite/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, symbols }),
      });

      const data = await response.json();
      return data.success ? data.quotes : null;
    } catch (error) {
      console.error('Error fetching quotes:', error);
      return null;
    }
  }
}

export const kiteAPI = new KiteAPI();
