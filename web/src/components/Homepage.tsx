import { useState } from "react";
import type { GoogleAuthState } from "../hooks/useGoogleAuth";
import { AdventureHomepage } from "../panels/adventure/Homepage";
import { CookingHomepage } from "../panels/cooking/Homepage";
import { FamilyHomepage } from "../panels/family/Homepage";
import { FinanceHomepage } from "../panels/finance/Homepage";
import { LearningHomepage } from "../panels/learning/Homepage";
import { MaintenanceHomepage } from "../panels/maintenance/Homepage";
import { TrainingHomepage } from "../panels/training/Homepage";

interface HomepageProps {
  authState: GoogleAuthState;
  onNavigateToApp: () => void;
}

export function Homepage({ authState, onNavigateToApp }: HomepageProps) {
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<
    "family" | "finance" | "cooking" | "adventure" | "learning" | "training" | "maintenance" | null
  >(null);

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
      id: "family",
      name: "Family",
      icon: "🏡",
      description: "Family planning and household coordination",
      action: () => setActivePanel("family"),
      bgColor: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    },
    {
      id: "finance",
      name: "Finance",
      icon: "💰",
      description: "Budgeting, expenses, and financial tracking",
      action: () => setActivePanel("finance"),
      bgColor: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    },
    {
      id: "cooking",
      name: "Cooking",
      icon: "🍳",
      description: "Meal planning, recipes, and kitchen routines",
      action: () => setActivePanel("cooking"),
      bgColor: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    },
    {
      id: "adventure",
      name: "Adventure",
      icon: "🚀",
      description: "Adventure and exploration",
      action: () => setActivePanel("adventure"),
      bgColor: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    },
    {
      id: "learning",
      name: "Learning",
      icon: "📚",
      description: "Learning resources",
      action: () => setActivePanel("learning"),
      bgColor: "linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)",
    },
    {
      id: "training",
      name: "Training",
      icon: "💪",
      description: "Training and development",
      action: () => setActivePanel("training"),
      bgColor: "linear-gradient(135deg, #ff7eb3 0%, #ff758c 100%)",
    },
    {
      id: "maintenance",
      name: "Maintenance",
      icon: "🛠️",
      description: "Maintenance tasks and upkeep tracking",
      action: () => setActivePanel("maintenance"),
      bgColor: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
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

  if (authState.isAuthenticated && activePanel === "family") {
    return <FamilyHomepage onBackToHub={() => setActivePanel(null)} onSignOut={authState.signOut} />;
  }

  if (authState.isAuthenticated && activePanel === "finance") {
    return <FinanceHomepage onBackToHub={() => setActivePanel(null)} onSignOut={authState.signOut} />;
  }

  if (authState.isAuthenticated && activePanel === "cooking") {
    return <CookingHomepage onBackToHub={() => setActivePanel(null)} onSignOut={authState.signOut} />;
  }

  if (authState.isAuthenticated && activePanel === "adventure") {
    return <AdventureHomepage onBackToHub={() => setActivePanel(null)} onSignOut={authState.signOut} />;
  }

  if (authState.isAuthenticated && activePanel === "learning") {
    return <LearningHomepage onBackToHub={() => setActivePanel(null)} onSignOut={authState.signOut} />;
  }

  if (authState.isAuthenticated && activePanel === "training") {
    return <TrainingHomepage onBackToHub={() => setActivePanel(null)} onSignOut={authState.signOut} />;
  }

  if (authState.isAuthenticated && activePanel === "maintenance") {
    return <MaintenanceHomepage onBackToHub={() => setActivePanel(null)} onSignOut={authState.signOut} />;
  }

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
