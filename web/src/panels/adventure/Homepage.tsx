interface AdventureHomepageProps {
  onBackToHub: () => void;
  onSignOut: () => void;
}

export function AdventureHomepage({ onBackToHub, onSignOut }: AdventureHomepageProps) {
  return (
    <div className="panel-homepage">
      <header className="panel-homepage-header">
        <div>
          <h2>Adventure</h2>
          <p>Capture destinations, plans, and upcoming experiences.</p>
        </div>
        <div className="panel-homepage-actions">
          <button type="button" className="secondary" onClick={onBackToHub}>Back to Hub</button>
          <button type="button" className="secondary" onClick={onSignOut}>Sign Out</button>
        </div>
      </header>
      <section className="panel-homepage-grid">
        <article className="panel-homepage-card">
          <h3>Trip Ideas</h3>
          <p>Collect and prioritize future travel ideas.</p>
        </article>
        <article className="panel-homepage-card">
          <h3>Packing Checklist</h3>
          <p>Prepare reusable packing and activity checklists.</p>
        </article>
      </section>
    </div>
  );
}
