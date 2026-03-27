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
    let attempts = 0;
    const maxAttempts = 200; // ~30 seconds timeout

    function initClient() {
      attempts++;

      if (!window.google?.accounts?.oauth2) {
        if (attempts === 1) {
          console.log("Waiting for Google Identity Services to load...");
        }
        if (attempts >= maxAttempts) {
          console.error("Google Identity Services failed to load after 30 seconds. window.google:", window.google);
          setIsGisLoading(false);
          return;
        }
        setTimeout(initClient, 150);
        return;
      }

      console.log("Google Identity Services loaded successfully");

      if (!CLIENT_ID) {
        console.error("VITE_GOOGLE_CLIENT_ID environment variable not set");
        setIsGisLoading(false);
        return;
      }

      console.log("Initializing Google Token Client with CLIENT_ID:", CLIENT_ID.substring(0, 20) + "...");

      try {
        clientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPE,
          callback: (response) => {
            console.log("Token client callback received");
            if (response.error) {
              console.error("Token error:", response.error);
              rejectRef.current?.(new Error(response.error));
              rejectRef.current = null;
              return;
            }
            console.log("Token received successfully");
            accessToken = response.access_token;
            tokenExpiry = Date.now() + ((response.expires_in ?? 3599) - 60) * 1000;
            setIsAuthenticated(true);
            resolveRef.current?.();
            resolveRef.current = null;
          },
          error_callback: (error) => {
            console.error("Token client error:", error);
            rejectRef.current?.(new Error(error.message ?? error.type));
            rejectRef.current = null;
          },
        });

        console.log("Token client initialized, clientRef.current:", !!clientRef.current);

        // If we already have a valid token from a previous sign-in this session
        if (accessToken && Date.now() < tokenExpiry) {
          setIsAuthenticated(true);
        }

        setIsGisLoading(false);
      } catch (error) {
        console.error("Failed to initialize Google Identity Services:", error);
        setIsGisLoading(false);
      }
    }

    initClient();
  }, []);

  function signIn(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log("signIn called, clientRef.current:", clientRef.current);
      
      if (!clientRef.current) {
        const errorMsg = "Google Identity Services not loaded yet";
        console.error(errorMsg, "CLIENT_ID:", CLIENT_ID, "window.google:", window.google);
        reject(new Error(errorMsg));
        return;
      }
      
      resolveRef.current = resolve;
      rejectRef.current = reject;
      
      try {
        // Empty prompt = silent refresh if consent already granted; "consent" forces dialog
        clientRef.current.requestAccessToken({ prompt: isAuthenticated ? "" : "consent" });
      } catch (error) {
        console.error("Error requesting access token:", error);
        reject(error);
      }
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
