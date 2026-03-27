interface TrainingHomepageProps {
  onBackToHub: () => void;
  onSignOut: () => void;
}

export function TrainingHomepage({ onBackToHub, onSignOut }: TrainingHomepageProps) {
  return (
    <div className="panel-homepage">
      <header className="panel-homepage-header">
        <div>
          <h2>Training</h2>
          <p>Plan sessions, routines, and progression goals.</p>
        </div>
        <div className="panel-homepage-actions">
          <button type="button" className="secondary" onClick={onBackToHub}>Back to Hub</button>
          <button type="button" className="secondary" onClick={onSignOut}>Sign Out</button>
        </div>
      </header>
      <section className="panel-homepage-grid">
        <article className="panel-homepage-card">
          <h3>Weekly Plan</h3>
          <p>Define and schedule focused training blocks.</p>
        </article>
        <article className="panel-homepage-card">
          <h3>Performance Logs</h3>
          <p>Capture sessions and measure improvement over time.</p>
        </article>
      </section>
    </div>
  );
}
