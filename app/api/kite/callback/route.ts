import { NextRequest, NextResponse } from 'next/server';
import { KiteConnect } from 'kiteconnect';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const requestToken = searchParams.get('request_token');
  const status = searchParams.get('status');

  // Check if user denied access
  if (status === 'error' || !requestToken) {
    return NextResponse.redirect(new URL('/?error=access_denied', request.url));
  }

  try {
    const apiKey = process.env.NEXT_PUBLIC_KITE_API_KEY;
    const apiSecret = process.env.KITE_API_SECRET;

    console.log('Debug - Auth Attempt:', {
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length,
      hasApiSecret: !!apiSecret,
      apiSecretLength: apiSecret?.length,
      requestTokenLength: requestToken?.length
    });

    if (!apiKey || !apiSecret) {
      throw new Error('Missing API Key or API Secret in environment variables');
    }

    const kc = new KiteConnect({
      api_key: apiKey,
    });

    // Generate session (exchange request token for access token)
    const session = await kc.generateSession(requestToken, apiSecret);

    // Store the access token securely (in a real app, use a database or secure session)
    // For now, we'll redirect with the token in the URL (NOT recommended for production)
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('kite_token', session.access_token);
    redirectUrl.searchParams.set('user_id', session.user_id);

    return NextResponse.redirect(redirectUrl);
  } catch (error: any) {
    console.error('Kite authentication error:', error);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }
}
