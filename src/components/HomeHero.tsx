import { Mail, MapPin } from 'lucide-react'
import { GitHubIcon, LinkedInIcon } from './PageFrame'
import { profile } from '../siteContent/profile'

/**
 * The public site's front door: who this is, what they do, and how to reach
 * them — above the fold, without needing to open a section.
 */
export function HomeHero() {
  return (
    <header className="home-hero">
      <div className="home-hero-copy">
        <p className="home-hero-eyebrow">{profile.role}</p>
        <h1 className="home-hero-name">{profile.name}</h1>

        <p className="home-hero-location">
          <MapPin size={14} strokeWidth={1.8} aria-hidden="true" />
          <span>{profile.location}</span>
        </p>

        <p className="home-hero-tagline">{profile.tagline}</p>

        <p className="home-hero-currently">
          <span className="home-hero-currently-label">Currently</span>
          {profile.currently}
        </p>

        <div className="home-hero-actions">
          <a className="home-hero-resume" href={profile.resumePdf} download>
            Résumé (PDF)
          </a>
          <a className="home-hero-resume secondary" href={profile.resumeWord} download>
            Word
          </a>
        </div>
      </div>

      {/* After the copy in the DOM so the name is read before the portrait;
          CSS places this column on the right, and lifts it above the text on
          narrow screens. */}
      <div className="home-hero-aside">
        <img
          className="home-hero-portrait"
          src={profile.headshot}
          alt={`${profile.name}, ${profile.role}`}
          width={132}
          height={132}
          loading="eager"
          decoding="async"
        />

        <nav className="home-hero-links" aria-label="Elsewhere">
          <a
            href={`https://www.linkedin.com/in/${profile.linkedin}/`}
            target="_blank"
            rel="noreferrer"
            aria-label="LinkedIn"
            title="LinkedIn"
          >
            <LinkedInIcon />
          </a>
          <a
            href={`https://github.com/${profile.github}`}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            title="GitHub"
          >
            <GitHubIcon />
          </a>
          <a href={`mailto:${profile.email}`} aria-label="Email" title={profile.email}>
            <Mail size={18} strokeWidth={1.8} aria-hidden="true" />
          </a>
        </nav>
      </div>
    </header>
  )
}
