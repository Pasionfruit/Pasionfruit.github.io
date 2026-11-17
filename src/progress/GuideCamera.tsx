import { useEffect, useRef, useState } from 'react'

/** Seconds before the back photo fires, so there is time to put the phone down and turn around. */
const BACK_COUNTDOWN = 10
import type { SkinAngle } from './client'

/**
 * The same silhouette every time, so day-to-day photos line up: fit the head (or
 * back) inside the outline, eyes on the dashed line, then shoot. Drawn in a
 * 100x133 box, the 3:4 frame the camera is cropped to.
 */
export function GuideOutline({ angle }: { angle: SkinAngle }) {
  const stroke = { fill: 'none', stroke: '#fff', strokeWidth: 0.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg className="pg-guide-outline" viewBox="0 0 100 133" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {angle === 'front' && (
        <>
          <ellipse cx="50" cy="56" rx="26" ry="35" {...stroke} />
          <path d="M18 133 C18 104 32 96 50 96 C68 96 82 104 82 133" {...stroke} />
          <line x1="50" y1="14" x2="50" y2="98" {...stroke} strokeDasharray="2 3" strokeWidth={0.5} />
          <line x1="22" y1="48" x2="78" y2="48" {...stroke} strokeDasharray="2 3" strokeWidth={0.5} />
        </>
      )}
      {(angle === 'left' || angle === 'right') && (
        <g transform={angle === 'right' ? 'translate(100 0) scale(-1 1)' : undefined}>
          {/* Profile facing the left edge: face on the left, ear and jaw on the right. */}
          <path d="M26 58 C26 32 40 20 56 20 C72 20 78 36 78 58 C78 74 70 86 60 92 L38 92 C32 84 26 72 26 58 Z" {...stroke} />
          <path d="M22 133 C22 106 36 98 52 98 C68 98 80 106 80 133" {...stroke} />
          <circle cx="64" cy="58" r="5" {...stroke} strokeDasharray="2 2" strokeWidth={0.6} />
          <line x1="20" y1="48" x2="80" y2="48" {...stroke} strokeDasharray="2 3" strokeWidth={0.5} />
        </g>
      )}
      {angle === 'back' && (
        <>
          <ellipse cx="50" cy="20" rx="11" ry="13" {...stroke} />
          <path d="M16 133 C14 84 26 44 42 36 L58 36 C74 44 86 84 84 133" {...stroke} />
          <line x1="50" y1="34" x2="50" y2="133" {...stroke} strokeDasharray="2 3" strokeWidth={0.5} />
          <line x1="20" y1="58" x2="80" y2="58" {...stroke} strokeDasharray="2 3" strokeWidth={0.5} />
        </>
      )}
    </svg>
  )
}

/** Crop the video frame to 3:4 portrait and return it as a JPEG, so every shot has the same framing. */
function snap(video: HTMLVideoElement): Promise<Blob | null> {
  const vw = video.videoWidth
  const vh = video.videoHeight
  const ratio = 3 / 4
  let sw = vw
  let sh = vw / ratio
  if (sh > vh) {
    sh = vh
    sw = vh * ratio
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.min(1280, Math.round(sw))
  canvas.height = Math.round(canvas.width / ratio)
  canvas.getContext('2d')?.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
}

/** Full-screen live camera with the outline laid over it. Calls onFallback when the camera is unavailable. */
export function GuideCamera({ angle, onShot, onClose, onFallback }: {
  angle: SkinAngle
  onShot: (file: File) => void
  onClose: () => void
  onFallback: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const facing = angle === 'back' ? 'environment' : 'user'

  useEffect(() => {
    let stream: MediaStream | undefined
    let cancelled = false
    if (!navigator.mediaDevices?.getUserMedia) {
      onFallback()
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream = s
        const el = video.current
        if (el) {
          el.srcObject = s
          void el.play().then(() => setReady(true))
        }
      })
      .catch(onFallback)
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [facing, onFallback])

  async function shoot() {
    const el = video.current
    if (!el || !ready) return
    if (angle === 'back' && count === null) {
      setCount(BACK_COUNTDOWN)
      return
    }
    const blob = await snap(el)
    if (blob) onShot(new File([blob], `${angle}-${Date.now()}.jpg`, { type: 'image/jpeg' }))
  }

  // The back photo counts down, then fires itself.
  useEffect(() => {
    if (count === null) return
    const timer = setTimeout(() => {
      if (count > 1) {
        setCount(count - 1)
      } else {
        setCount(null)
        void shoot()
      }
    }, 1000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  return (
    <div className="pg-guide" role="dialog" aria-label={`Take the ${angle} photo`}>
      <div className="pg-guide-frame">
        <video ref={video} playsInline muted className={facing === 'user' ? 'is-mirrored' : ''} />
        <GuideOutline angle={angle} />
        {count !== null && <div className="pg-guide-count" role="timer" aria-live="polite">{count}</div>}
      </div>
      <p className="pg-guide-hint">
        {angle === 'back' ? 'Back inside the outline, shoulders on the dashed line.' : `Head inside the outline, eyes on the dashed line. ${angle === 'front' ? 'Face the camera.' : `Turn your ${angle} side to it.`}`}
      </p>
      <div className="pg-guide-actions">
        <button type="button" className="secondary-action" onClick={onClose}>Cancel</button>
        {count !== null ? (
          <button type="button" className="secondary-action" onClick={() => setCount(null)}>Stop timer</button>
        ) : (
          <button type="button" className="primary-action" onClick={() => void shoot()} disabled={!ready}>
            {angle === 'back' ? `Start ${BACK_COUNTDOWN}s timer` : `Take ${angle} photo`}
          </button>
        )}
      </div>
    </div>
  )
}
