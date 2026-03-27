import { useState } from "react";
import type { GoogleAuthState } from "../hooks/useGoogleAuth";

interface HomepageProps {
  authState: GoogleAuthState;
  onNavigateToApp: () => void;
}

export function Homepage({ authState, onNavigateToApp }: HomepageProps) {
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setSigningIn(true);
    setSignInError(null);
    try {
      await authState.signIn();
    } catch (error) {
      setSignInError(error instanceof Error ? error.message : "Sign in failed");
      console.error("Sign in error:", error);
    } finally {
      setSigningIn(false);
    }
  };

  const panels = [
    {
      id: "health",
      name: "Health",
      icon: "🏥",
      description: "Health and wellness management",
      action: () => console.log("Health panel clicked"),
      bgColor: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    },
    {
      id: "training",
      name: "Training",
      icon: "💪",
      description: "Training and development",
      action: () => console.log("Training panel clicked"),
      bgColor: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    },
    {
      id: "learning",
      name: "Learning",
      icon: "📚",
      description: "Learning resources",
      action: () => console.log("Learning panel clicked"),
      bgColor: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    },
    {
      id: "adventure",
      name: "Adventure",
      icon: "🚀",
      description: "Adventure and exploration",
      action: () => console.log("Adventure panel clicked"),
      bgColor: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    },
    {
      id: "work",
      name: "Work",
      icon: "💼",
      description: "Work management and projects",
      action: onNavigateToApp,
      bgColor: "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
    },
  ];

  return (
    <div className="homepage">
      <div className="homepage-header">
        <div className="homepage-content">
          <h1>Welcome to Pasionfruit Hub</h1>
          <p className="homepage-subtitle">
            {authState.isAuthenticated
              ? "Access your life management tools"
              : "Sign in to manage your life"}
          </p>
        </div>
      </div>

      {!authState.isAuthenticated ? (
        <div className="homepage-signin">
          <div className="signin-card">
            <h2>Get Started</h2>
            <p>Sign in with your Google account to access your personal management tools.</p>
            {signInError && (
              <div style={{ marginBottom: "16px", padding: "12px", backgroundColor: "#fee", borderRadius: "8px", color: "#c33" }}>
                {signInError}
              </div>
            )}
            <button
              onClick={handleSignIn}
              disabled={authState.isGisLoading || signingIn}
              className="signin-button"
            >
              {authState.isGisLoading || signingIn ? "Loading..." : "Sign In with Google"}
            </button>
          </div>
        </div>
      ) : (
        <div className="homepage-authenticated">
          <div className="panels-grid">
            {panels.map((panel) => (
              <div
                key={panel.id}
                className="panel-card"
                style={{ backgroundImage: panel.bgColor }}
                onClick={panel.action}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    panel.action();
                  }
                }}
              >
                <div className="panel-icon">{panel.icon}</div>
                <h3>{panel.name}</h3>
                <p>{panel.description}</p>
              </div>
            ))}
          </div>

          <div className="user-card-footer">
            <button
              onClick={authState.signOut}
              className="signout-button"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
