import { useEffect, useMemo, useState } from 'react'
import { Cpu, HardDrive, MemoryStick, RefreshCw, Server } from 'lucide-react'
import { AdminPage } from './AdminPage'
import { adminDashboardsById } from '../siteContent'
import { getAceConfig } from './ace/client'

/**
 * System — every machine on the network that runs the agent, from one screen.
 *
 * Agents (the server-manager Flask app today; the same script on any future
 * box) heartbeat a health sample to the Ace worker every minute, which stores
 * two weeks of them in Cloudflare D1. This tab reads the latest sample and 24h
 * of history per machine, so a machine that is off still shows its last state.
 */

type MachineSample = {
  machine: string
  at: number
  cpu: number | null
  ram_used_gb: number | null
  ram_total_gb: number | null
  disk_used_gb: number | null
  disk_total_gb: number | null
  gpu: string | null
  uptime_s: number | null
  mc_state: string | null
  services: Record<string, boolean>
  history: { at: number; cpu: number | null; ram_used_gb: number | null }[]
}

/** No heartbeat for three intervals means the machine is effectively down. */
const OFFLINE_AFTER_SECONDS = 3 * 60
const REFRESH_MS = 60_000

function formatUptime(seconds: number | null) {
  if (!seconds || seconds <= 0) return '—'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function formatAgo(now: number, at: number) {
  const delta = Math.max(0, now - at)
  if (delta < 90) return 'just now'
  if (delta < 3600) return `${Math.floor(delta / 60)} min ago`
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`
  return `${Math.floor(delta / 86400)}d ago`
}

function Meter({ label, used, total, unit, icon: Icon }: {
  label: string
  used: number | null
  total?: number | null
  unit: string
  icon: typeof Cpu
}) {
  const percent =
    total != null && total > 0 && used != null
      ? Math.min(100, (used / total) * 100)
      : used != null && !total
        ? Math.min(100, used)
        : null

  return (
    <div className="system-meter">
      <div className="system-meter-head">
        <span className="system-meter-label">
          <Icon size={12} strokeWidth={1.8} aria-hidden="true" /> {label}
        </span>
        <span className="system-meter-value">
          {used == null ? '—' : total != null ? `${used} / ${total} ${unit}` : `${used}${unit}`}
        </span>
      </div>
      <div className="system-meter-track">
        {percent != null ? (
          <div
            className={`system-meter-fill${percent > 88 ? ' is-hot' : ''}`}
            style={{ width: `${percent}%` }}
          />
        ) : null}
      </div>
    </div>
  )
}

function CpuSparkline({ history }: { history: MachineSample['history'] }) {
  const points = history.filter((entry) => entry.cpu != null)
  if (points.length < 2) return null

  const width = 240
  const height = 36
  const step = width / (points.length - 1)
  const path = points
    .map((entry, index) => `${index === 0 ? 'M' : 'L'}${(index * step).toFixed(1)},${(height - (Number(entry.cpu) / 100) * height).toFixed(1)}`)
    .join(' ')

  return (
    <svg
      className="system-sparkline"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="CPU over the last 24 hours"
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function MachineCard({ machine, now }: { machine: MachineSample; now: number }) {
  const online = now - machine.at <= OFFLINE_AFTER_SECONDS
  const services = Object.entries(machine.services ?? {})

  return (
    <article className={`info-card admin-card system-machine${online ? '' : ' is-offline'}`}>
      <div className="admin-card-head">
        <h3 className="system-machine-name">
          <Server size={16} strokeWidth={1.7} aria-hidden="true" />
          {machine.machine}
        </h3>
        <span className={`system-status-pill${online ? ' is-online' : ''}`}>
          <span className="system-status-dot" aria-hidden="true" />
          {online ? 'Online' : `Last seen ${formatAgo(now, machine.at)}`}
        </span>
      </div>

      <div className="system-meters">
        <Meter label="CPU" used={machine.cpu} unit="%" icon={Cpu} />
        <Meter label="RAM" used={machine.ram_used_gb} total={machine.ram_total_gb} unit="GB" icon={MemoryStick} />
        <Meter label="Disk" used={machine.disk_used_gb} total={machine.disk_total_gb} unit="GB" icon={HardDrive} />
      </div>

      <CpuSparkline history={machine.history} />

      <dl className="system-facts">
        {machine.gpu ? (
          <div>
            <dt>GPU</dt>
            <dd>{machine.gpu}</dd>
          </div>
        ) : null}
        <div>
          <dt>Uptime</dt>
          <dd>{formatUptime(machine.uptime_s)}</dd>
        </div>
        {machine.mc_state ? (
          <div>
            <dt>Minecraft</dt>
            <dd>{machine.mc_state}</dd>
          </div>
        ) : null}
      </dl>

      {services.length > 0 ? (
        <div className="system-services" aria-label="Services">
          {services.map(([name, ok]) => (
            <span key={name} className={`system-service${ok ? ' is-ok' : ''}`}>
              <span className="system-status-dot" aria-hidden="true" />
              {name}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  )
}

export function SystemDashboard({ idToken }: { idToken: string }) {
  const config = useMemo(() => getAceConfig(), [])
  const [machines, setMachines] = useState<MachineSample[]>([])
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!config || !idToken) {
        setIsLoading(false)
        return
      }
      try {
        const response = await fetch(`${config.baseUrl}/system/machines`, {
          headers: { Authorization: `Bearer ${idToken}` },
        })
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error || `System endpoint returned ${response.status}`)
        }
        const data = (await response.json()) as { now: number; machines: MachineSample[] }
        if (!cancelled) {
          setMachines(data.machines.sort((a, b) => a.machine.localeCompare(b.machine)))
          setNow(data.now)
          setError('')
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to load machines')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    const timer = window.setInterval(() => void load(), REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [config, idToken])

  return (
    <AdminPage meta={adminDashboardsById.system}>
      {!config ? (
        <p className="sheets-meta">
          Set <code>VITE_ACE_BASE_URL</code> — machine health is read through the Ace worker.
        </p>
      ) : null}

      {error ? <p className="sheets-error">{error}</p> : null}

      {isLoading ? (
        <p className="sheets-meta">
          <RefreshCw size={13} strokeWidth={1.8} className="ace-spin" aria-hidden="true" /> Reading machines…
        </p>
      ) : null}

      {!isLoading && !error && machines.length === 0 ? (
        <p className="sheets-meta">
          No machines have reported yet. Each machine runs the server-manager agent, which heartbeats
          its health every minute — check that <code>REPORT_URL</code> and <code>REPORT_KEY</code> are
          set in its .env and the service is running.
        </p>
      ) : null}

      {machines.map((machine) => (
        <MachineCard key={machine.machine} machine={machine} now={now} />
      ))}
    </AdminPage>
  )
}
