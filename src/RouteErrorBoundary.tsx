import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * Contains a crash to the page that threw it.
 *
 * React unmounts the *entire* tree on an uncaught render error unless
 * something catches it — with a plain `<Routes>`/`<Route>` tree and no
 * boundary, one bad render on any single dashboard blanked the whole site and
 * needed a hard refresh to recover, since React itself was gone, not just that
 * route. `SiteLayout` renders this around its `<Outlet />`, keyed by
 * `location.pathname`, so React Router remounts a fresh boundary on every
 * navigation — landing on a different page always recovers, with no reload.
 *
 * Error boundaries must be class components; React has no hook equivalent.
 */
type Props = { children: ReactNode }
type State = { error: Error | null }

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Route crashed:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) {
      return this.props.children
    }

    return (
      <div className="route-crash">
        <p className="route-crash-title">This page hit a problem and couldn&apos;t load.</p>
        <p className="route-crash-detail">{error.message || 'Unknown error'}</p>
        <Link to="/" className="route-crash-home">
          Back to Home
        </Link>
      </div>
    )
  }
}
