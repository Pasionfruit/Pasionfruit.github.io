interface MaintenanceHomepageProps {
  onBackToHub: () => void;
  onSignOut: () => void;
}

export function MaintenanceHomepage({ onBackToHub, onSignOut }: MaintenanceHomepageProps) {
  return (
    <div className="panel-homepage">
      <header className="panel-homepage-header">
        <div>
          <h2>Maintenance</h2>
          <p>Track recurring upkeep tasks and service reminders.</p>
        </div>
        <div className="panel-homepage-actions">
          <button type="button" className="secondary" onClick={onBackToHub}>Back to Hub</button>
          <button type="button" className="secondary" onClick={onSignOut}>Sign Out</button>
        </div>
      </header>
      <section className="panel-homepage-grid">
        <article className="panel-homepage-card">
          <h3>Home Upkeep</h3>
          <p>Manage routine checks and household maintenance.</p>
        </article>
        <article className="panel-homepage-card">
          <h3>Vehicle Service</h3>
          <p>Track inspections, oil changes, and repairs.</p>
        </article>
      </section>
    </div>
  );
}
