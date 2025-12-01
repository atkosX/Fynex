"use client";

import { Thread } from "@/components/assistant-ui/thread";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useDataStreamRuntime } from "@assistant-ui/react-data-stream";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { TrendingUpIcon, CheckCircle2Icon, UserIcon } from "lucide-react";

export default function Home() {
  const [isKiteConnected, setIsKiteConnected] = useState(false);
  const [kiteAccessToken, setKiteAccessToken] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Setup assistant-ui runtime with data stream protocol
  const runtime = useDataStreamRuntime({
    api: "/api/chat",
    body: {
      kiteAccessToken: kiteAccessToken,
    },
    onResponse: (response) => {
      console.log('Data stream response received:', response.status);
    },
    onFinish: (message) => {
      console.log('Message completed:', message);
    },
    onError: (error) => {
      console.error('Data stream error:', error);
    },
  });

  // Check for access token in URL params (from OAuth callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('kite_token');
    const userId = params.get('user_id');
    const error = params.get('error');

    if (error) {
      alert(`Kite authentication error: ${error}`);
      // Clean up URL
      window.history.replaceState({}, '', '/');
      return;
    }

    if (token && userId) {
      // Store token in localStorage
      localStorage.setItem('kite_access_token', token);
      localStorage.setItem('kite_user_id', userId);
      setKiteAccessToken(token);
      setIsKiteConnected(true);

      // Clean up URL
      window.history.replaceState({}, '', '/');

      // Fetch user profile
      fetchUserProfile(token);
    } else {
      // Check if token exists in localStorage
      const storedToken = localStorage.getItem('kite_access_token');
      if (storedToken) {
        setKiteAccessToken(storedToken);
        setIsKiteConnected(true);
        fetchUserProfile(storedToken);
      }
    }
  }, []);

  const fetchUserProfile = async (token: string) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/kite/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token }),
      });

      const data = await response.json();
      if (data.success) {
        setUserProfile(data.profile);
      } else {
        console.error('Failed to fetch profile:', data.error);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKiteConnect = () => {
    const apiKey = process.env.NEXT_PUBLIC_KITE_API_KEY;
    
    if (!apiKey) {
      alert('Kite API key not configured. Please add NEXT_PUBLIC_KITE_API_KEY to your .env.local file');
      return;
    }

    // Redirect to Kite login page
    const kiteLoginUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${apiKey}`;
    window.location.href = kiteLoginUrl;
  };

  const handleDisconnect = () => {
    localStorage.removeItem('kite_access_token');
    localStorage.removeItem('kite_user_id');
    setKiteAccessToken(null);
    setIsKiteConnected(false);
    setUserProfile(null);
  };

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4">
        {/* Header with Kite Connect Button */}
        <div className="mb-4 flex w-full max-w-4xl items-center justify-between rounded-t-lg border-x border-t bg-card p-4">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-lg">Fynex</h1>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary text-xs">
              AI Trading Assistant
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            {isKiteConnected && userProfile && (
              <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{userProfile.user_name || userProfile.email}</span>
              </div>
            )}
            
            {isKiteConnected ? (
              <Button
                onClick={handleDisconnect}
                variant="outline"
                className="gap-2"
                size="sm"
              >
                <CheckCircle2Icon className="h-4 w-4 text-green-500" />
                Disconnect
              </Button>
            ) : (
              <Button
                onClick={handleKiteConnect}
                variant="default"
                className="gap-2"
                disabled={isLoading}
              >
                <TrendingUpIcon className="h-4 w-4" />
                Connect Kite
              </Button>
            )}
          </div>
        </div>

        {/* Chat Interface */}
        <div className="h-full w-full max-w-4xl overflow-hidden rounded-b-lg border shadow-lg">
          <Thread />
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
}
