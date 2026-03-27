interface LearningHomepageProps {
  onBackToHub: () => void;
  onSignOut: () => void;
}

export function LearningHomepage({ onBackToHub, onSignOut }: LearningHomepageProps) {
  return (
    <div className="panel-homepage">
      <header className="panel-homepage-header">
        <div>
          <h2>Learning</h2>
          <p>Track courses, reading lists, and skill milestones.</p>
        </div>
        <div className="panel-homepage-actions">
          <button type="button" className="secondary" onClick={onBackToHub}>Back to Hub</button>
          <button type="button" className="secondary" onClick={onSignOut}>Sign Out</button>
        </div>
      </header>
      <section className="panel-homepage-grid">
        <article className="panel-homepage-card">
          <h3>Current Courses</h3>
          <p>Track enrollment, progress, and next milestones.</p>
        </article>
        <article className="panel-homepage-card">
          <h3>Reading Queue</h3>
          <p>Maintain books, articles, and notes to review.</p>
        </article>
      </section>
    </div>
  );
}
