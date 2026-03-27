import FinanceApp from "./App";

interface FinanceHomepageProps {
  onBackToHub: () => void;
  onSignOut: () => void;
}

export function FinanceHomepage({ onBackToHub, onSignOut }: FinanceHomepageProps) {
  return <FinanceApp onBackToHub={onBackToHub} onSignOut={onSignOut} />;
}
