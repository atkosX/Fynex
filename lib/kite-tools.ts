import { KiteConnect } from 'kiteconnect';

export interface PortfolioSummary {
  holdings: {
    total_value: number;
    total_pnl: number;
    count: number;
    items: Array<{
      symbol: string;
      quantity: number;
      avg_price: number;
      last_price: number;
      pnl: number;
      pnl_percent: number;
    }>;
  };
  positions: {
    net_pnl: number;
    day_pnl: number;
    count: number;
    items: Array<{
      symbol: string;
      quantity: number;
      avg_price: number;
      last_price: number;
      pnl: number;
      product: string;
    }>;
  };
}

/**
 * Fetch portfolio details from Kite Connect API
 * This is a server-side function that requires an access token
 */
export async function getKitePortfolioDetails(accessToken: string): Promise<PortfolioSummary> {
  const apiKey = process.env.NEXT_PUBLIC_KITE_API_KEY;
  
  if (!apiKey) {
    throw new Error('Kite API key not configured');
  }

  const kc = new KiteConnect({
    api_key: apiKey,
    access_token: accessToken,
  });

  try {
    // Fetch holdings and positions in parallel
    const [holdings, positions] = await Promise.all([
      kc.getHoldings(),
      kc.getPositions(),
    ]);

    // Process holdings
    const holdingsData = holdings.map((h: any) => ({
      symbol: h.tradingsymbol,
      quantity: h.quantity,
      avg_price: h.average_price,
      last_price: h.last_price,
      pnl: h.pnl,
      pnl_percent: h.average_price > 0 
        ? ((h.last_price - h.average_price) / h.average_price) * 100 
        : 0,
    }));

    const totalHoldingsValue = holdingsData.reduce(
      (sum, h) => sum + h.last_price * h.quantity,
      0
    );
    const totalHoldingsPnl = holdingsData.reduce((sum, h) => sum + h.pnl, 0);

    // Process positions
    const netPositions = positions.net || [];
    const positionsData = netPositions
      .filter((p: any) => p.quantity !== 0)
      .map((p: any) => ({
        symbol: p.tradingsymbol,
        quantity: p.quantity,
        avg_price: p.average_price,
        last_price: p.last_price,
        pnl: p.pnl,
        product: p.product,
      }));

    const netPnl = netPositions.reduce((sum: number, p: any) => sum + (p.pnl || 0), 0);
    const dayPositions = positions.day || [];
    const dayPnl = dayPositions.reduce((sum: number, p: any) => sum + (p.pnl || 0), 0);

    return {
      holdings: {
        total_value: totalHoldingsValue,
        total_pnl: totalHoldingsPnl,
        count: holdingsData.length,
        items: holdingsData,
      },
      positions: {
        net_pnl: netPnl,
        day_pnl: dayPnl,
        count: positionsData.length,
        items: positionsData,
      },
    };
  } catch (error: any) {
    console.error('Error fetching Kite portfolio:', error);
    throw new Error(`Failed to fetch portfolio: ${error.message}`);
  }
}

/**
 * Format portfolio summary for LLM consumption
 */
export function formatPortfolioForLLM(portfolio: PortfolioSummary): string {
  const { holdings, positions } = portfolio;

  let summary = `# Portfolio Summary\n\n`;

  // Holdings section
  summary += `## Holdings (${holdings.count} stocks)\n`;
  summary += `- Total Value: ₹${holdings.total_value.toFixed(2)}\n`;
  summary += `- Total P&L: ₹${holdings.total_pnl.toFixed(2)}\n\n`;

  if (holdings.items.length > 0) {
    summary += `### Top Holdings:\n`;
    holdings.items
      .sort((a, b) => b.last_price * b.quantity - a.last_price * a.quantity)
      .slice(0, 10)
      .forEach((h) => {
        const value = h.last_price * h.quantity;
        summary += `- **${h.symbol}**: ${h.quantity} shares @ ₹${h.last_price.toFixed(2)} `;
        summary += `(Avg: ₹${h.avg_price.toFixed(2)}, `;
        summary += `P&L: ₹${h.pnl.toFixed(2)} / ${h.pnl_percent.toFixed(2)}%)\n`;
      });
  }

  // Positions section
  summary += `\n## Active Positions (${positions.count})\n`;
  summary += `- Net P&L: ₹${positions.net_pnl.toFixed(2)}\n`;
  summary += `- Day P&L: ₹${positions.day_pnl.toFixed(2)}\n\n`;

  if (positions.items.length > 0) {
    summary += `### Current Positions:\n`;
    positions.items.forEach((p) => {
      summary += `- **${p.symbol}** (${p.product}): ${p.quantity} @ ₹${p.last_price.toFixed(2)} `;
      summary += `(Avg: ₹${p.avg_price.toFixed(2)}, P&L: ₹${p.pnl.toFixed(2)})\n`;
    });
  }

  return summary;
}
