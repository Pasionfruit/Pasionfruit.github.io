// Minecraft server control dashboard — UI wiring only.
// All backend access goes through the centralized API module (./api).
import './minecraft.css'
import {
  ApiError,
  getServerLogs,
  getServerMetrics,
  getServerStatus,
  restartServer,
  startServer,
  stopServer,
  type ServerMetrics,
  type ServerStatus,
} from './api'

const POLL_INTERVAL_MS = 5000

// ── Elements ──────────────────────────────────────────────────────────────

function requireEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Missing element: #${id}`)
  return el as T
}

const statusEl = requireEl<HTMLElement>('server-status')
const playersEl = requireEl<HTMLElement>('server-players')
const versionEl = requireEl<HTMLElement>('server-version')
const bannerEl = requireEl<HTMLParagraphElement>('connectivity-banner')
const messageEl = requireEl<HTMLParagraphElement>('action-message')
const consoleEl = requireEl<HTMLPreElement>('console-window')
const cpuEl = requireEl<HTMLElement>('metric-cpu')
const ramEl = requireEl<HTMLElement>('metric-ram')
const uptimeEl = requireEl<HTMLElement>('metric-uptime')
const startBtn = requireEl<HTMLButtonElement>('btn-start')
const restartBtn = requireEl<HTMLButtonElement>('btn-restart')
const stopBtn = requireEl<HTMLButtonElement>('btn-stop')

type ActionName = 'start' | 'restart' | 'stop'

const BUTTON_LABELS: Record<ActionName, { idle: string; busy: string }> = {
  start: { idle: 'Start Server', busy: 'Starting…' },
  restart: { idle: 'Restart Server', busy: 'Restarting…' },
  stop: { idle: 'Stop Server', busy: 'Stopping…' },
}

// ── State ─────────────────────────────────────────────────────────────────

let backendReachable = false
let activeAction: ActionName | null = null
let isStarting = false
let lastStatus: ServerStatus | null = null
let lastLogSignature: string | null = null

// ── UI updates ────────────────────────────────────────────────────────────

function setBackendReachable(reachable: boolean) {
  backendReachable = reachable
  bannerEl.hidden = reachable
}

function renderStatus() {
  if (!backendReachable) {
    statusEl.textContent = '—'
    playersEl.textContent = '— / —'
    versionEl.textContent = '—'
    return
  }

  if (lastStatus?.state === 'stopping') {
    statusEl.textContent = '🟡 Stopping...'
    playersEl.textContent = '— / —'
    versionEl.textContent = '—'
    return
  }

  if (lastStatus?.online) {
    statusEl.textContent = '🟢 Online'
    playersEl.textContent = `${lastStatus.players ?? 0} / ${lastStatus.maxPlayers ?? '—'}`
    versionEl.textContent = lastStatus.version || '—'
    return
  }

  statusEl.textContent = isStarting ? '🟡 Starting...' : '🔴 Server Offline'
  playersEl.textContent = '— / —'
  versionEl.textContent = '—'
}

function renderMetrics(metrics: ServerMetrics | null) {
  if (!metrics) {
    cpuEl.textContent = '—'
    ramEl.textContent = '—'
    uptimeEl.textContent = '—'
    return
  }

  cpuEl.textContent = metrics.cpu != null ? `${metrics.cpu}%` : '—'
  ramEl.textContent =
    metrics.ramUsedGB != null && metrics.ramTotalGB != null
      ? `${metrics.ramUsedGB} / ${metrics.ramTotalGB} GB`
      : metrics.ramUsedGB != null
        ? `${metrics.ramUsedGB} GB`
        : '—'
  uptimeEl.textContent = metrics.uptime || '—'
}

function renderConsole(lines: string[]) {
  const signature = lines.join('\n')
  if (signature === lastLogSignature) return
  lastLogSignature = signature
  consoleEl.textContent = signature
  consoleEl.scrollTop = consoleEl.scrollHeight
}

function renderButtons() {
  const online = Boolean(lastStatus?.online)
  const transitioning = isStarting || lastStatus?.state === 'starting' || lastStatus?.state === 'stopping'
  const blocked = !backendReachable || activeAction !== null

  // Start stays available while the server is offline; Stop/Restart need a
  // running server to act on. Nothing is actionable mid-transition.
  startBtn.disabled = blocked || transitioning || online
  restartBtn.disabled = blocked || transitioning || !online
  stopBtn.disabled = blocked || transitioning || !online

  const buttons: Array<[ActionName, HTMLButtonElement]> = [
    ['start', startBtn],
    ['restart', restartBtn],
    ['stop', stopBtn],
  ]
  for (const [action, button] of buttons) {
    button.textContent = activeAction === action ? BUTTON_LABELS[action].busy : BUTTON_LABELS[action].idle
  }
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'timeout') return '⚠ Request timed out — please try again.'
    if (error.kind === 'http') {
      if (error.status === 429) return '⚠ Please wait 30 seconds between server actions.'
      return `⚠ Server manager returned an error (${error.status ?? 'unknown'}).`
    }
    return '⚠ Server manager unavailable.'
  }
  return '⚠ Request failed — please try again.'
}

// ── Refresh loop ──────────────────────────────────────────────────────────

async function refreshStatus() {
  try {
    const status = await getServerStatus()
    lastStatus = status
    if (status.state) {
      // Backend tracks transitions authoritatively once it reports a state.
      isStarting = status.state === 'starting'
    } else if (status.online) {
      isStarting = false
    }
    setBackendReachable(true)
  } catch {
    lastStatus = null
    setBackendReachable(false)
  }
  renderStatus()
  renderButtons()
}

async function refreshMetrics() {
  try {
    renderMetrics(await getServerMetrics())
  } catch {
    renderMetrics(null)
  }
}

async function refreshLogs() {
  try {
    renderConsole(await getServerLogs())
  } catch {
    // Keep the last known log lines on transient failures.
  }
}

async function refreshAll() {
  await Promise.allSettled([refreshStatus(), refreshMetrics(), refreshLogs()])
}

// ── Event handlers ────────────────────────────────────────────────────────

async function runAction(action: ActionName, requestFn: () => Promise<unknown>, onSuccess?: () => void) {
  if (activeAction !== null || !backendReachable) return
  activeAction = action
  renderButtons()
  messageEl.textContent = ''
  try {
    await requestFn()
    onSuccess?.()
    messageEl.textContent = `${BUTTON_LABELS[action].idle} request sent.`
  } catch (error) {
    messageEl.textContent = describeError(error)
  } finally {
    activeAction = null
    renderStatus()
    renderButtons()
    void refreshAll()
  }
}

startBtn.addEventListener('click', () => {
  void runAction('start', startServer, () => {
    isStarting = true
  })
})

restartBtn.addEventListener('click', () => {
  void runAction('restart', restartServer)
})

stopBtn.addEventListener('click', () => {
  if (!window.confirm('Stop the Minecraft server?')) return
  void runAction('stop', stopServer, () => {
    isStarting = false
  })
})

// ── Boot ──────────────────────────────────────────────────────────────────

void refreshAll()
setInterval(() => {
  void refreshAll()
}, POLL_INTERVAL_MS)
