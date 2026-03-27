interface FinanceHomepageProps {
  onBackToHub: () => void;
  onSignOut: () => void;
}

export function FinanceHomepage({ onBackToHub, onSignOut }: FinanceHomepageProps) {
  return (
    <div className="panel-homepage">
      <header className="panel-homepage-header">
        <div>
          <h2>Finance</h2>
          <p>Organize budgets, expenses, and financial goals.</p>
        </div>
        <div className="panel-homepage-actions">
          <button type="button" className="secondary" onClick={onBackToHub}>Back to Hub</button>
          <button type="button" className="secondary" onClick={onSignOut}>Sign Out</button>
        </div>
      </header>
      <section className="panel-homepage-grid">
        <article className="panel-homepage-card">
          <h3>Monthly Budget</h3>
          <p>Monitor planned versus actual spending.</p>
        </article>
        <article className="panel-homepage-card">
          <h3>Savings Targets</h3>
          <p>Track progress toward short and long-term goals.</p>
        </article>
      </section>
    </div>
  );
}
