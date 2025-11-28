import { NextRequest, NextResponse } from 'next/server';
import { KiteConnect } from 'kiteconnect';

export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json();

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.NEXT_PUBLIC_KITE_API_KEY!;
    const kc = new KiteConnect({
      api_key: apiKey,
      access_token: accessToken,
    });

    // Get holdings
    const holdings = await kc.getHoldings();

    return NextResponse.json({
      success: true,
      holdings,
    });
  } catch (error: any) {
    console.error('Error fetching holdings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch holdings' },
      { status: 500 }
    );
  }
}
