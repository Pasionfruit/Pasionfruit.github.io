import CookingApp from "./App";

interface CookingHomepageProps {
  onBackToHub: () => void;
  onSignOut: () => void;
  isAuthenticated: boolean;
  getToken: () => string;
}

export function CookingHomepage({ onBackToHub, onSignOut, isAuthenticated, getToken }: CookingHomepageProps) {
  return (
    <CookingApp
      onBackToHub={onBackToHub}
      onSignOut={onSignOut}
      isAuthenticated={isAuthenticated}
      getToken={getToken}
    />
  );
}
