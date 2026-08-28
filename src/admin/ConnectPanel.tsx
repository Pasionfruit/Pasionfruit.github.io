import type { ConnectionStatus } from './integrations/types'

const STATE_LABELS: Record<ConnectionStatus['state'], string> = {
  connected: 'Connected',
  'needs-auth': 'Needs authorization',
  'not-configured': 'Not configured',
}

/**
 * Rendered in place of data when an integration cannot load yet. It states
 * what is missing and what would fix it, so an empty dashboard is never
 * mistaken for a quiet inbox or an empty week.
 */
export function ConnectPanel({ name, status }: { name: string; status: ConnectionStatus }) {
  return (
    <div className={`connect-panel connect-panel-${status.state}`}>
      <div className="connect-panel-head">
        <h4>{name}</h4>
        <span className={`connect-badge connect-badge-${status.state}`}>
          {STATE_LABELS[status.state]}
        </span>
      </div>

      <p className="connect-panel-message">{status.message}</p>

      {status.steps.length > 0 ? (
        <ol className="connect-panel-steps">
          {status.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}
