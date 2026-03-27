interface FamilyHomepageProps {
  onBackToHub: () => void;
  onSignOut: () => void;
}

export function FamilyHomepage({ onBackToHub, onSignOut }: FamilyHomepageProps) {
  return (
    <div className="panel-homepage">
      <header className="panel-homepage-header">
        <div>
          <h2>Family</h2>
          <p>Manage family plans, schedules, and shared priorities.</p>
        </div>
        <div className="panel-homepage-actions">
          <button type="button" className="secondary" onClick={onBackToHub}>Back to Hub</button>
          <button type="button" className="secondary" onClick={onSignOut}>Sign Out</button>
        </div>
      </header>
      <section className="panel-homepage-grid">
        <article className="panel-homepage-card">
          <h3>Family Calendar</h3>
          <p>Track important dates, school events, and routines.</p>
        </article>
        <article className="panel-homepage-card">
          <h3>Household Tasks</h3>
          <p>Coordinate chores and weekly responsibilities.</p>
        </article>
      </section>
    </div>
  );
}
