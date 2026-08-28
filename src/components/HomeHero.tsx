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
        <div className="home-hero-identity">
          <p className="home-hero-eyebrow">{profile.role}</p>
          <h1 className="home-hero-name">{profile.name}</h1>

          <p className="home-hero-location">
            <MapPin size={14} strokeWidth={1.8} aria-hidden="true" />
            <span>{profile.location}</span>
          </p>
        </div>

        <div className="home-hero-detail">
          <p className="home-hero-tagline">{profile.tagline}</p>

          <p className="home-hero-currently">
            <span className="home-hero-currently-label">Currently</span>
            {profile.currently}
          </p>

          <div className="home-hero-actions">
            {/*
              * The format suffix is dropped on narrow screens so this row can stay
              * on one line beside the icon links. The label is pinned with
              * aria-label so the name a screen reader announces does not change
              * with the viewport — and because the accessible name computed from
              * a text node plus an element picks up a double space.
              */}
            <a
              className="home-hero-resume"
              href={profile.resumePdf}
              aria-label="Résumé (PDF)"
              download
            >
              Résumé<span className="home-hero-resume-ext"> (PDF)</span>
            </a>
            <a className="home-hero-resume secondary" href={profile.resumeWord} download>
              Word
            </a>
          </div>
        </div>
      </div>

      {/* After the copy in the DOM so the name is read before the portrait.
          CSS puts this column on the right at desktop widths; on a phone the
          wrappers flatten and the portrait moves beside the name, with the
          links pinned bottom-right. */}
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
