import { useEffect, useState } from "react";
import { Homepage } from "./components/Homepage";
import { useGoogleAuth } from "./hooks/useGoogleAuth";
import WorkApp from "./panels/work/App";
import { saveToStorage } from "./utils/storage";

const STORAGE_KEYS = {
  theme: "sunrag.theme",
};

type ThemeMode = "light" | "dark";

function getInitialTheme(): ThemeMode {
  const saved = localStorage.getItem(STORAGE_KEYS.theme);
  if (saved === "light" || saved === "dark") {
    return saved;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function RootApp() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [activeView, setActiveView] = useState<"home" | "work">("home");
  const [isGuestMode, setIsGuestMode] = useState(false);
  const authState = useGoogleAuth();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    saveToStorage(STORAGE_KEYS.theme, theme);
  }, [theme]);

  function toggleTheme(): void {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  }

  const globalThemeToggle = (
    <button
      className="global-theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      <span className="theme-icon" aria-hidden="true">
        {theme === "light" ? "☀" : "🌙"}
      </span>
    </button>
  );

  const showWork = activeView === "work" && (authState.isAuthenticated || isGuestMode);

  return (
    <>
      {globalThemeToggle}
      {showWork ? (
        <WorkApp
          authState={authState}
          isGuestMode={isGuestMode}
          onGuestModeChange={setIsGuestMode}
          onBackToHub={() => setActiveView("home")}
        />
      ) : (
        <Homepage
          authState={authState}
          onNavigateToApp={(mode) => {
            setIsGuestMode(mode === "guest");
            setActiveView("work");
          }}
          isGuestMode={isGuestMode}
          onGuestModeChange={setIsGuestMode}
        />
      )}
    </>
  );
}

export default RootApp;
