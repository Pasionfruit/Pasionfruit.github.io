import { useRef } from 'react'
import { touchInput } from '../experience/inputManager.js'
import './DPad.css'

// Half-widths in px
const BASE_R  = 55   // half of 110px base
const THUMB_R = 22   // half of 44px thumb
const DEAD    = 0.18 // normalised dead-zone radius

function clearInputs() {
  touchInput.forward  = false
  touchInput.backward = false
  touchInput.left     = false
  touchInput.right    = false
}

export default function DPad() {
  const baseRef    = useRef()
  const thumbRef   = useRef()
  const activeId   = useRef(null)

  function moveThumb(dx, dy) {
    if (thumbRef.current) thumbRef.current.style.transform = `translate(${dx}px, ${dy}px)`
  }

  function processMove(clientX, clientY) {
    const rect = baseRef.current.getBoundingClientRect()
    const cx = rect.left + rect.width  / 2
    const cy = rect.top  + rect.height / 2
    let dx = clientX - cx
    let dy = clientY - cy
    const dist = Math.hypot(dx, dy)
    const max  = BASE_R - THUMB_R
    if (dist > max) { dx = (dx / dist) * max; dy = (dy / dist) * max }
    moveThumb(dx, dy)
    const nx = dx / max   // -1 … +1
    const ny = dy / max
    touchInput.forward  = ny < -DEAD
    touchInput.backward = ny >  DEAD
    touchInput.left     = nx < -DEAD
    touchInput.right    = nx >  DEAD
  }

  function onPointerDown(e) {
    e.preventDefault()
    activeId.current = e.pointerId
    baseRef.current.setPointerCapture(e.pointerId)
    processMove(e.clientX, e.clientY)
  }

  function onPointerMove(e) {
    if (e.pointerId !== activeId.current) return
    e.preventDefault()
    processMove(e.clientX, e.clientY)
  }

  function onPointerUp(e) {
    if (e.pointerId !== activeId.current) return
    activeId.current = null
    moveThumb(0, 0)
    clearInputs()
  }

  return (
    <div
      ref={baseRef}
      className="joystick-base"
      aria-label="joystick"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div ref={thumbRef} className="joystick-thumb" />
    </div>
  )
}