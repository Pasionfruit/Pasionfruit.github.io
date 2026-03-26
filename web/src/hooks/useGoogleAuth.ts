import { useEffect, useRef, useState } from "react";

// ---- GIS type declarations ----
interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (error: { type: string; message?: string }) => void;
}

interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  error?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: TokenClientConfig) => TokenClient;
          revoke: (token: string, callback: () => void) => void;
        };
      };
    };
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

// Module-level token cache — avoids XSS exposure via localStorage
let accessToken: string | null = null;
let tokenExpiry = 0;

export interface GoogleAuthState {
  isAuthenticated: boolean;
  isGisLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
  getToken: () => string;
}

export function useGoogleAuth(): GoogleAuthState {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGisLoading, setIsGisLoading] = useState(true);

  // Stored as refs so the GIS callback always sees the latest resolve/reject
  const resolveRef = useRef<(() => void) | null>(null);
  const rejectRef = useRef<((reason: Error) => void) | null>(null);
  const clientRef = useRef<TokenClient | null>(null);

  useEffect(() => {
    function initClient() {
      if (!window.google?.accounts?.oauth2) {
        setTimeout(initClient, 150);
        return;
      }

      clientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: (response) => {
          if (response.error) {
            rejectRef.current?.(new Error(response.error));
            rejectRef.current = null;
            return;
          }
          accessToken = response.access_token;
          tokenExpiry = Date.now() + ((response.expires_in ?? 3599) - 60) * 1000;
          setIsAuthenticated(true);
          resolveRef.current?.();
          resolveRef.current = null;
        },
        error_callback: (error) => {
          rejectRef.current?.(new Error(error.message ?? error.type));
          rejectRef.current = null;
        },
      });

      // If we already have a valid token from a previous sign-in this session
      if (accessToken && Date.now() < tokenExpiry) {
        setIsAuthenticated(true);
      }

      setIsGisLoading(false);
    }

    initClient();
  }, []);

  function signIn(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!clientRef.current) {
        reject(new Error("Google Identity Services not loaded yet"));
        return;
      }
      resolveRef.current = resolve;
      rejectRef.current = reject;
      // Empty prompt = silent refresh if consent already granted; "consent" forces dialog
      clientRef.current.requestAccessToken({ prompt: isAuthenticated ? "" : "consent" });
    });
  }

  function signOut(): void {
    if (accessToken) {
      window.google?.accounts.oauth2.revoke(accessToken, () => {});
    }
    accessToken = null;
    tokenExpiry = 0;
    setIsAuthenticated(false);
  }

  function getToken(): string {
    if (!accessToken || Date.now() >= tokenExpiry) {
      throw new Error("No valid access token. Please sign in again.");
    }
    return accessToken;
  }

  return { isAuthenticated, isGisLoading, signIn, signOut, getToken };
}
