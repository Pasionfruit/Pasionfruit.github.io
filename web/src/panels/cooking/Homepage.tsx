interface CookingHomepageProps {
  onBackToHub: () => void;
  onSignOut: () => void;
}

export function CookingHomepage({ onBackToHub, onSignOut }: CookingHomepageProps) {
  return (
    <div className="panel-homepage">
      <header className="panel-homepage-header">
        <div>
          <h2>Cooking</h2>
          <p>Plan meals, organize recipes, and prep effectively.</p>
        </div>
        <div className="panel-homepage-actions">
          <button type="button" className="secondary" onClick={onBackToHub}>Back to Hub</button>
          <button type="button" className="secondary" onClick={onSignOut}>Sign Out</button>
        </div>
      </header>
      <section className="panel-homepage-grid">
        <article className="panel-homepage-card">
          <h3>Weekly Meals</h3>
          <p>Outline meals for the week and prep windows.</p>
        </article>
        <article className="panel-homepage-card">
          <h3>Shopping List</h3>
          <p>Keep ingredient lists organized by category.</p>
        </article>
      </section>
    </div>
  );
}
