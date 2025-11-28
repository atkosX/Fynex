import { NextRequest, NextResponse } from 'next/server';
import { KiteConnect } from 'kiteconnect';

export async function POST(request: NextRequest) {
  try {
    const { accessToken, symbols } = await request.json();

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 400 }
      );
    }

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json(
        { error: 'Symbols array is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.NEXT_PUBLIC_KITE_API_KEY!;
    const kc = new KiteConnect({
      api_key: apiKey,
      access_token: accessToken,
    });

    // Get quotes for the given symbols
    const quotes = await kc.getQuote(symbols);

    return NextResponse.json({
      success: true,
      quotes,
    });
  } catch (error: any) {
    console.error('Error fetching quotes:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch quotes' },
      { status: 500 }
    );
  }
}
