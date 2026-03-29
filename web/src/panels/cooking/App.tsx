import { useMemo, useState } from "react";
import { ShoppingPage } from "./components/ShoppingPage";

interface CookingAppProps {
  onBackToHub: () => void;
  onSignOut: () => void;
  isAuthenticated: boolean;
  getToken: () => string;
}

type CookingPage = "home" | "shopping" | "deals" | "recipes" | "meals";

const PAGE_CONTENT: Array<{
  id: Exclude<CookingPage, "home">;
  title: string;
  description: string;
}> = [
  {
    id: "shopping",
    title: "Shopping",
    description: "Manage grocery list entries and compare store pricing.",
  },
  {
    id: "deals",
    title: "Deals",
    description: "Deals page is ready for your next implementation pass.",
  },
  {
    id: "recipes",
    title: "Recipes",
    description: "Recipes page is ready for your next implementation pass.",
  },
  {
    id: "meals",
    title: "Meals",
    description: "Meals page is ready for your next implementation pass.",
  },
];

function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="cooking-page-content">
      <div className="cooking-section-card">
        <h3>{title}</h3>
        <p className="muted">This section is ready. Detailed tools can be added next.</p>
      </div>
    </section>
  );
}

export default function CookingApp({ onBackToHub, onSignOut, isAuthenticated, getToken }: CookingAppProps) {
  const [activePage, setActivePage] = useState<CookingPage>("home");

  const activeDescriptor = useMemo(
    () => PAGE_CONTENT.find((page) => page.id === activePage),
    [activePage],
  );

  return (
    <div className="panel-homepage">
      <header className="panel-homepage-header">
        <div>
          <h2>Cooking</h2>
          <p>
            {activePage === "home"
              ? "Choose a category to open its page."
              : `${activeDescriptor?.title ?? "Cooking"} page`}
          </p>
        </div>
        <div className="panel-homepage-actions">
          {activePage !== "home" ? (
            <button type="button" className="secondary" onClick={() => setActivePage("home")}>
              Back to Cooking
            </button>
          ) : null}
          <button type="button" className="secondary" onClick={onBackToHub}>Back to Hub</button>
          <button type="button" className="secondary" onClick={onSignOut}>Sign Out</button>
        </div>
      </header>

      {activePage === "home" ? (
        <section className="panel-homepage-grid" aria-label="Cooking categories">
          {PAGE_CONTENT.map((page) => (
            <button
              key={page.id}
              type="button"
              className="panel-homepage-card cooking-nav-card"
              onClick={() => setActivePage(page.id)}
            >
              <h3>{page.title}</h3>
              <p>{page.description}</p>
            </button>
          ))}
        </section>
      ) : null}

      {activePage === "shopping" ? (
        <ShoppingPage isAuthenticated={isAuthenticated} getToken={getToken} />
      ) : null}

      {activePage === "deals" ? <PlaceholderPage title="Deals" /> : null}
      {activePage === "recipes" ? <PlaceholderPage title="Recipes" /> : null}
      {activePage === "meals" ? <PlaceholderPage title="Meals" /> : null}
    </div>
  );
}
