# Kite Connect Integration

This project integrates with Zerodha Kite Connect API for trading and market data.

## Setup

### 1. Create a Kite Connect App

1. Go to [https://developers.kite.trade/](https://developers.kite.trade/)
2. Sign in with your Zerodha account
3. Create a new app
4. Note down your **API Key** and **API Secret**
5. Set the redirect URL to: `http://localhost:3000/api/kite/callback` (for development)

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_KITE_API_KEY=your_api_key_here
KITE_API_SECRET=your_api_secret_here
```

### 3. Run the Application

```bash
bun dev
```

## Features Implemented

### Authentication
- ✅ OAuth 2.0 login flow
- ✅ Access token storage in localStorage
- ✅ Automatic token persistence across sessions
- ✅ User profile display

### API Endpoints

#### `/api/kite/callback` (GET)
Handles OAuth callback and exchanges request token for access token.

#### `/api/kite/profile` (POST)
Fetches user profile information.

**Request:**
```json
{
  "accessToken": "your_access_token"
}
```

**Response:**
```json
{
  "success": true,
  "profile": {
    "user_id": "XX1234",
    "user_name": "John Doe",
    "email": "john@example.com",
    "user_type": "individual",
    "broker": "ZERODHA"
  }
}
```

#### `/api/kite/holdings` (POST)
Fetches user's holdings.

**Request:**
```json
{
  "accessToken": "your_access_token"
}
```

**Response:**
```json
{
  "success": true,
  "holdings": [
    {
      "tradingsymbol": "RELIANCE",
      "exchange": "NSE",
      "quantity": 10,
      "average_price": 2500.50,
      "last_price": 2600.00,
      "pnl": 995.00
    }
  ]
}
```

#### `/api/kite/positions` (POST)
Fetches user's open positions.

**Request:**
```json
{
  "accessToken": "your_access_token"
}
```

**Response:**
```json
{
  "success": true,
  "positions": {
    "net": [...],
    "day": [...]
  }
}
```

#### `/api/kite/quotes` (POST)
Fetches live quotes for given symbols.

**Request:**
```json
{
  "accessToken": "your_access_token",
  "symbols": ["NSE:RELIANCE", "NSE:INFY"]
}
```

**Response:**
```json
{
  "success": true,
  "quotes": {
    "NSE:RELIANCE": {
      "last_price": 2600.50,
      "ohlc": {
        "open": 2580.00,
        "high": 2610.00,
        "low": 2575.00,
        "close": 2595.00
      },
      "volume": 1234567
    }
  }
}
```

## Frontend Utility

Use the `kiteAPI` utility for making API calls:

```typescript
import { kiteAPI } from '@/lib/kite-api';

// Get user profile
const profile = await kiteAPI.getProfile();

// Get holdings
const holdings = await kiteAPI.getHoldings();

// Get positions
const positions = await kiteAPI.getPositions();

// Get quotes
const quotes = await kiteAPI.getQuotes(['NSE:RELIANCE', 'NSE:INFY']);
```

## Security Notes

⚠️ **Important Security Considerations:**

1. **Access Token Storage**: Currently, access tokens are stored in localStorage. For production:
   - Use secure HTTP-only cookies
   - Implement server-side session management
   - Consider using a database to store tokens

2. **API Secret**: Never expose your API secret in client-side code. It should only be used in server-side API routes.

3. **Token Expiration**: Kite access tokens expire daily at 6:00 AM IST. Implement token refresh logic.

4. **Rate Limiting**: Kite API has rate limits. Implement proper error handling and retry logic.

## Next Steps

- [ ] Implement order placement
- [ ] Add WebSocket for real-time market data
- [ ] Create portfolio analytics dashboard
- [ ] Add historical data charts
- [ ] Implement basket orders
- [ ] Add GTT (Good Till Triggered) orders

## Resources

- [Kite Connect Documentation](https://kite.trade/docs/connect/v3/)
- [Kite Connect Node.js Library](https://github.com/zerodha/kiteconnectjs)
- [API Rate Limits](https://kite.trade/docs/connect/v3/exceptions/#api-rate-limit)
