// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: purple; icon-glyph: tasks;

/**
 * abepasion.com Home Screen widget for Scriptable (medium size).
 *
 * Left: today's + overdue Todoist tasks — the same set as the Home dashboard's
 * Tasks of the Day. Right: last night's sleep from the garmin_wellness sheet.
 *
 * iOS widgets need WidgetKit, which a PWA cannot use, so this runs in
 * Scriptable and reads the same sources the site does rather than the site
 * itself. Nothing here talks to the Workers or Apps Script.
 *
 * Credentials live in the iOS Keychain, never in this file: run the script once
 * inside the Scriptable app and it asks for them. See README.md next to this
 * file for setup.
 */

const KEYCHAIN_KEY = 'abepasion.widget.config'
const SETUP_CODE_PREFIX = 'abw1.'

// Widget taps open Safari — iOS gives no way to target a Home Screen web app.
const SITE_URL = 'https://abepasion.com/'
const TASKS_URL = 'https://abepasion.com/tasks'
const HEALTH_URL = 'https://abepasion.com/admin/health'

const TODOIST_FILTER_URL = 'https://api.todoist.com/api/v1/tasks/filter'
const WELLNESS_RANGE = 'garmin_wellness!A1:U10000'

const MAX_TASK_ROWS = 5
const REFRESH_MINUTES = 15

// The site's palette (src/index.css), so the widget reads as the same app.
const COLORS = {
  background: Color.dynamic(new Color('#fbf6e9'), new Color('#34373b')),
  text: Color.dynamic(new Color('#33291c'), new Color('#f1f3f5')),
  muted: Color.dynamic(new Color('#7a6b4f'), new Color('#c2c7cd')),
  accent: Color.dynamic(new Color('#9333ea'), new Color('#c084fc')),
  warning: Color.dynamic(new Color('#b45309'), new Color('#fbbf24')),
  danger: Color.dynamic(new Color('#c2410c'), new Color('#fb923c')),
  good: Color.dynamic(new Color('#15803d'), new Color('#4ade80')),
}

// Todoist's own priority colours. The API's 4 is the app's p1.
const PRIORITY_COLORS = {
  4: new Color('#d1453b'),
  3: new Color('#eb8909'),
  2: new Color('#246fe0'),
  1: Color.dynamic(new Color('#c9bd9f'), new Color('#6b7077')),
}

// ---------------------------------------------------------------------------
// Settings

function readSettings() {
  if (!Keychain.contains(KEYCHAIN_KEY)) {
    return null
  }
  try {
    const settings = JSON.parse(Keychain.get(KEYCHAIN_KEY))
    return settings.todoistToken && settings.sheetsId && settings.sheetsKey ? settings : null
  } catch {
    return null
  }
}

/**
 * Picks the code out of whatever was pasted — copying a task description on
 * iOS can bring backticks, a title or a trailing newline along with it.
 */
function findSetupCode(text) {
  return /abw1\.[A-Za-z0-9+/=]+/.exec(String(text ?? ''))?.[0] ?? ''
}

function decodeSetupCode(text) {
  const code = findSetupCode(text)
  if (!code) {
    return null
  }
  try {
    const json = Data.fromBase64String(code.slice(SETUP_CODE_PREFIX.length)).toRawString()
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * One alert covers both setup paths: paste a setup code (all three values in
 * one string), or fill the three fields by hand. A code already on the
 * clipboard is filled in for you.
 */
async function promptForSettings(existing) {
  const alert = new Alert()
  alert.title = 'abepasion widget setup'
  alert.message = 'Paste a setup code, or leave it blank and fill in the three values. They are stored in the iOS Keychain.'
  alert.addTextField('Setup code (abw1.…)', findSetupCode(Pasteboard.pasteString()))
  alert.addSecureTextField('Todoist API token', existing?.todoistToken ?? '')
  alert.addTextField('Sheets spreadsheet ID', existing?.sheetsId ?? '')
  alert.addTextField('Sheets API key', existing?.sheetsKey ?? '')
  alert.addAction('Save')
  alert.addCancelAction('Cancel')

  if ((await alert.presentAlert()) === -1) {
    return null
  }

  const fromCode = decodeSetupCode(alert.textFieldValue(0))
  const settings = fromCode ?? {
    todoistToken: alert.textFieldValue(1).trim(),
    sheetsId: alert.textFieldValue(2).trim(),
    sheetsKey: alert.textFieldValue(3).trim(),
  }

  if (!settings.todoistToken || !settings.sheetsId || !settings.sheetsKey) {
    const error = new Alert()
    error.title = 'Setup incomplete'
    error.message = alert.textFieldValue(0).trim() && !fromCode
      ? 'That setup code could not be read.'
      : 'All three values are needed.'
    error.addAction('OK')
    await error.presentAlert()
    return null
  }

  Keychain.set(KEYCHAIN_KEY, JSON.stringify(settings))
  return settings
}

// ---------------------------------------------------------------------------
// Cache: the last good payload per section, so a failed refresh (no signal, an
// API hiccup) shows slightly old data instead of an error.

const fm = FileManager.local()
const CACHE_PATH = fm.joinPath(fm.documentsDirectory(), 'abepasion-widget-cache.json')

function readCache() {
  try {
    return fm.fileExists(CACHE_PATH) ? JSON.parse(fm.readString(CACHE_PATH)) : {}
  } catch {
    return {}
  }
}

function writeCache(cache) {
  try {
    fm.writeString(CACHE_PATH, JSON.stringify(cache))
  } catch {
    // A cache that will not write only costs the offline fallback.
  }
}

/** Runs a loader; on failure falls back to the cached copy, flagged stale. */
async function loadSection(cache, name, loader) {
  try {
    const data = await loader()
    cache[name] = { at: Date.now(), data }
    return { data, at: Date.now(), stale: false }
  } catch (error) {
    const cached = cache[name]
    if (cached) {
      return { data: cached.data, at: cached.at, stale: true }
    }
    return { error: String(error?.message ?? error) }
  }
}

// ---------------------------------------------------------------------------
// Data

async function getJson(url, headers = {}) {
  const request = new Request(url)
  request.headers = { Accept: 'application/json', ...headers }
  request.timeoutInterval = 15

  const body = await request.loadJSON()
  const status = request.response?.statusCode ?? 0
  if (status < 200 || status >= 300) {
    throw new Error(status === 401 || status === 403 ? 'Not authorised — rerun setup' : `HTTP ${status}`)
  }
  return body
}

function localDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Mirrors dueDateKey in src/data/todoist/dates.ts: zoned datetimes are converted to local days. */
function dueDateKey(due) {
  if (!due) {
    return ''
  }
  const value = String(due.datetime ?? due.date ?? '')
  if (/[zZ]|[+-]\d\d:\d\d$/.test(value)) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? '' : localDateKey(parsed)
  }
  return value.slice(0, 10)
}

/** Todoist content is markdown; the widget wants plain text. */
function plainText(content) {
  return String(content ?? '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/(\*\*|__|`|~~)/g, '')
    .trim()
}

/**
 * Today + overdue. Todoist's own filter selects the same set the site's
 * getTasksOfTheDay builds by hand (due date on or before today) without paging
 * through every active task — a widget has little time and memory to spare.
 */
async function loadTasks(settings) {
  const headers = { Authorization: `Bearer ${settings.todoistToken}` }
  const tasks = []
  let cursor = null

  for (let page = 0; page < 5; page += 1) {
    const params = `query=${encodeURIComponent('today | overdue')}&limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
    const body = await getJson(`${TODOIST_FILTER_URL}?${params}`, headers)
    tasks.push(...(body.results ?? []))
    cursor = body.next_cursor ?? null
    if (!cursor) break
  }

  const today = localDateKey(new Date())

  return tasks
    .map((task) => {
      const day = dueDateKey(task.due)
      const time = String(task.due?.datetime ?? task.due?.date ?? '')
      return {
        content: plainText(task.content),
        priority: Number(task.priority) || 1,
        day,
        overdue: Boolean(day) && day < today,
        sortTime: time.length > 10 ? new Date(time).getTime() : Number.MAX_SAFE_INTEGER,
        order: Number(task.day_order ?? task.child_order ?? 0),
      }
    })
    .filter((task) => task.content)
    .sort(
      (a, b) =>
        a.day.localeCompare(b.day) ||
        a.sortTime - b.sortTime ||
        b.priority - a.priority ||
        a.order - b.order,
    )
}

/**
 * The newest row that has a sleep score. Rows exist for days the watch has not
 * synced sleep for yet (or ever), so "newest row" alone would show blanks.
 */
async function loadHealth(settings) {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(settings.sheetsId)}` +
    `/values/${encodeURIComponent(WELLNESS_RANGE)}?key=${encodeURIComponent(settings.sheetsKey)}`
  const body = await getJson(url)
  const [header = [], ...rows] = body.values ?? []

  const records = rows.map((row) => Object.fromEntries(header.map((name, i) => [name, String(row[i] ?? '').trim()])))
  const latest = records
    .filter((record) => record.date && record.sleep_score)
    .sort((a, b) => b.date.localeCompare(a.date))[0]

  if (!latest) {
    return null
  }

  return {
    date: latest.date.slice(0, 10),
    sleepScore: latest.sleep_score,
    sleepHours: latest.sleep_duration_h,
    hrv: latest.hrv,
    restingHr: latest.resting_hr,
  }
}

// ---------------------------------------------------------------------------
// Formatting

function formatHours(value) {
  const hours = Number(value)
  if (!Number.isFinite(hours) || hours <= 0) {
    return '—'
  }
  const totalMinutes = Math.round(hours * 60)
  return `${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, '0')}m`
}

/** Garmin's bands: 80+ good, 60–79 fair, below 60 poor. */
function sleepScoreColor(value) {
  const score = Number(value)
  if (!Number.isFinite(score)) return COLORS.text
  if (score >= 80) return COLORS.good
  if (score >= 60) return COLORS.warning
  return COLORS.danger
}

function shortDate(key) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function shortTime(ms) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

// ---------------------------------------------------------------------------
// Rendering

function addText(stack, text, { size = 12, weight = 'regular', color = COLORS.text, rounded = false } = {}) {
  const fonts = {
    regular: rounded ? Font.regularRoundedSystemFont : Font.regularSystemFont,
    medium: rounded ? Font.mediumRoundedSystemFont : Font.mediumSystemFont,
    semibold: rounded ? Font.semiboldRoundedSystemFont : Font.semiboldSystemFont,
    bold: rounded ? Font.boldRoundedSystemFont : Font.boldSystemFont,
  }
  const element = stack.addText(String(text))
  element.font = fonts[weight](size)
  element.textColor = color
  element.lineLimit = 1
  return element
}

function addSymbol(stack, name, color, size = 12) {
  const symbol = SFSymbol.named(name)
  if (!symbol) return
  const image = stack.addImage(symbol.image)
  image.imageSize = new Size(size, size)
  image.tintColor = color
}

function addHeader(stack, symbol, title, detail, detailColor = COLORS.muted) {
  const row = stack.addStack()
  row.layoutHorizontally()
  row.centerAlignContent()
  row.spacing = 4
  addSymbol(row, symbol, COLORS.accent)
  addText(row, title, { size: 13, weight: 'bold', color: COLORS.accent })
  if (detail) {
    addText(row, detail, { size: 11, weight: 'medium', color: detailColor })
  }
}

function addMessage(stack, text) {
  stack.addSpacer(6)
  const message = addText(stack, text, { size: 11, color: COLORS.muted })
  message.lineLimit = 3
}

function renderTasks(column, section) {
  column.layoutVertically()
  column.url = TASKS_URL

  if (section.error) {
    addHeader(column, 'checklist', 'Today')
    addMessage(column, section.error)
    return
  }

  const tasks = section.data
  const overdue = tasks.filter((task) => task.overdue).length
  const count = overdue === tasks.length && overdue > 0
    ? `${overdue} overdue`
    : [String(tasks.length), overdue ? `${overdue} overdue` : ''].filter(Boolean).join(' · ')
  const detail = section.stale ? `${count} · offline` : count
  addHeader(column, 'checklist', 'Today', detail, overdue ? COLORS.danger : COLORS.muted)
  column.addSpacer(6)

  if (tasks.length === 0) {
    addText(column, 'All clear ✓', { size: 12, color: COLORS.muted })
    return
  }

  const visible = tasks.length > MAX_TASK_ROWS ? tasks.slice(0, MAX_TASK_ROWS - 1) : tasks
  for (const task of visible) {
    const row = column.addStack()
    row.layoutHorizontally()
    row.centerAlignContent()
    row.spacing = 6
    addSymbol(row, 'circle', PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS[1], 10)
    addText(row, task.content, { size: 12 })
    column.addSpacer(3)
  }

  if (visible.length < tasks.length) {
    addText(column, `+${tasks.length - visible.length} more`, { size: 11, weight: 'medium', color: COLORS.muted })
  }
}

function addMetric(row, value, label, color = COLORS.text) {
  const tile = row.addStack()
  tile.layoutVertically()
  tile.size = new Size(60, 0)
  const valueText = addText(tile, value || '—', { size: 17, weight: 'bold', color, rounded: true })
  valueText.minimumScaleFactor = 0.6
  addText(tile, label, { size: 10, color: COLORS.muted })
}

function renderHealth(column, section) {
  column.layoutVertically()
  column.url = HEALTH_URL

  if (section.error || !section.data) {
    addHeader(column, 'moon.zzz.fill', 'Sleep')
    addMessage(column, section.error ?? 'No sleep data yet')
    return
  }

  const health = section.data
  const isLastNight = health.date === localDateKey(new Date())
  addHeader(
    column,
    'moon.zzz.fill',
    isLastNight ? 'Last night' : shortDate(health.date),
    section.stale ? 'offline' : '',
  )
  if (!isLastNight) {
    // An older night is shown, not hidden — but flagged, so a missed sync is
    // not mistaken for last night's numbers.
    column.addSpacer(1)
    addText(column, 'not synced today', { size: 10, color: COLORS.warning })
  }
  column.addSpacer(6)

  const top = column.addStack()
  top.layoutHorizontally()
  addMetric(top, health.sleepScore, 'Score', sleepScoreColor(health.sleepScore))
  addMetric(top, formatHours(health.sleepHours), 'Asleep')

  column.addSpacer(6)

  const bottom = column.addStack()
  bottom.layoutHorizontally()
  addMetric(bottom, health.hrv, 'HRV ms')
  addMetric(bottom, health.restingHr, 'RHR bpm')

  column.addSpacer()
  addText(column, `Updated ${shortTime(section.at)}`, { size: 9, color: COLORS.muted })
}

function renderSetupNeeded() {
  const widget = new ListWidget()
  widget.backgroundColor = COLORS.background
  widget.setPadding(14, 14, 14, 14)
  addText(widget, 'abepasion', { size: 15, weight: 'bold', color: COLORS.accent })
  widget.addSpacer(6)
  const message = addText(widget, 'Open this script in Scriptable once to finish setup.', { size: 12, color: COLORS.muted })
  message.lineLimit = 3
  return widget
}

async function buildWidget(settings) {
  if (!settings) {
    return renderSetupNeeded()
  }

  const cache = readCache()
  const [tasks, health] = await Promise.all([
    loadSection(cache, 'tasks', () => loadTasks(settings)),
    loadSection(cache, 'health', () => loadHealth(settings)),
  ])
  writeCache(cache)

  const widget = new ListWidget()
  widget.backgroundColor = COLORS.background
  widget.url = SITE_URL
  widget.setPadding(14, 14, 14, 14)
  widget.refreshAfterDate = new Date(Date.now() + REFRESH_MINUTES * 60 * 1000)

  const body = widget.addStack()
  body.layoutHorizontally()
  body.topAlignContent()

  renderTasks(body.addStack(), tasks)
  body.addSpacer()

  // Fixed width so a long task title truncates instead of squeezing this side.
  const right = body.addStack()
  right.size = new Size(122, 0)
  renderHealth(right, health)

  return widget
}

// ---------------------------------------------------------------------------
// Entry point

async function runInApp() {
  let settings = readSettings()

  if (settings) {
    const menu = new Alert()
    menu.title = 'abepasion widget'
    menu.addAction('Preview widget')
    menu.addAction('Change setup')
    menu.addDestructiveAction('Remove saved credentials')
    menu.addCancelAction('Cancel')
    const choice = await menu.presentSheet()

    if (choice === 1) {
      settings = (await promptForSettings(settings)) ?? settings
    } else if (choice === 2) {
      Keychain.remove(KEYCHAIN_KEY)
      return
    } else if (choice !== 0) {
      return
    }
  } else {
    settings = await promptForSettings(null)
    if (!settings) return
  }

  const widget = await buildWidget(settings)
  await widget.presentMedium()
}

if (config.runsInWidget) {
  Script.setWidget(await buildWidget(readSettings()))
} else {
  await runInApp()
}

Script.complete()
