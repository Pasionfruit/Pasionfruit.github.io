import { useEffect, useMemo, useState } from 'react'
import { useGame } from '../context/GameContext.jsx'
import './SettingsPanel.css'

const CONTROL_FIELDS = [
  { id: 'forward', label: 'forward' },
  { id: 'backward', label: 'backward' },
  { id: 'left', label: 'left' },
  { id: 'right', label: 'right' },
  { id: 'brake', label: 'brake' },
  { id: 'boost', label: 'boost' },
]

function displayKeyName(key) {
  if (!key) return 'Unbound'
  if (key === ' ') return 'Space'
  if (key === 'Space') return 'Space'
  if (key.startsWith('Key') && key.length === 4) return key.slice(3)
  if (key.startsWith('Arrow')) return key.replace('Arrow', '')
  return key
}

function normalizePressedKey(event) {
  if (event.code === 'Space' || event.key === ' ') return 'Space'
  if (event.code && event.code !== 'Unidentified') return event.code
  return event.key
}

export default function SettingsPanel() {
  const {
    catsEnabled,
    toggleCatsEnabled,
    controlBindings,
    setControlBinding,
    resetControlBindings,
  } = useGame()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('controls')
  const [captureAction, setCaptureAction] = useState(null)

  const bindings = useMemo(() => controlBindings || {}, [controlBindings])

  useEffect(() => {
    if (!captureAction) return undefined

    function onKeyDown(event) {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        setCaptureAction(null)
        return
      }
      const nextKey = normalizePressedKey(event)
      if (!nextKey || typeof nextKey !== 'string') return
      setControlBinding(captureAction, nextKey)
      setCaptureAction(null)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [captureAction, setControlBinding])

  return (
    <div className="settings-panel">
      <button
        className={`settings-cog-btn ${open ? 'is-open' : ''}`}
        onClick={() => setOpen(prev => !prev)}
        aria-label="Open settings"
        aria-expanded={open}
      >
        ⚙
      </button>

      {open && (
        <div className="settings-menu">
          <p className="settings-title">Settings</p>

          <div className="settings-tabs">
            <button
              className={`settings-tab-btn ${tab === 'controls' ? 'is-active' : ''}`}
              onClick={() => setTab('controls')}
            >
              Controls
            </button>
            <button
              className={`settings-tab-btn ${tab === 'options' ? 'is-active' : ''}`}
              onClick={() => setTab('options')}
            >
              Options
            </button>
          </div>

          {tab === 'controls' && (
            <div className="settings-section">
              <p className="settings-hint">Pick an action, then press a key. Press Escape to cancel capture.</p>
              {CONTROL_FIELDS.map(field => (
                <div key={field.id} className="settings-row">
                  <span>{field.label}</span>
                  <button
                    className={`settings-key-btn ${captureAction === field.id ? 'is-capturing' : ''}`}
                    onClick={() => setCaptureAction(field.id)}
                  >
                    {captureAction === field.id ? 'Press key...' : displayKeyName(bindings[field.id])}
                  </button>
                </div>
              ))}

              <div className="settings-actions">
                <button className="settings-mini-btn" onClick={resetControlBindings}>
                  Reset Defaults
                </button>
              </div>
            </div>
          )}

          {tab === 'options' && (
            <div className="settings-section">
              <div className="settings-row">
                <span>Cats</span>
                <button className="settings-key-btn" onClick={toggleCatsEnabled}>
                  {catsEnabled ? 'On' : 'Off'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
