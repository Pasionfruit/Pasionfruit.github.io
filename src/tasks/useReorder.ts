import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

// How long a touch must rest on a row before it becomes a drag, and how far the
// finger may drift in that window before we treat it as a scroll instead.
const LONG_PRESS_MS = 250
const MOVE_CANCEL_PX = 10

type UseReorderOptions = {
  enabled: boolean
  count: number
  onReorder: (from: number, to: number) => void
}

/**
 * Hold-and-drag reordering built on pointer events, so mouse, touch, and pen all
 * flow through one path. A drag begins either immediately from a `.task-drag-handle`
 * grip, or after a {@link LONG_PRESS_MS} press-and-hold anywhere on a touch row.
 * The handlers attach to the list container; each reorderable item is tagged with
 * `data-reorder-index`.
 */
export function useReorder({ enabled, count, onReorder }: UseReorderOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const state = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    startIndex: -1,
    over: -1,
    dragging: false,
    timer: null as ReturnType<typeof setTimeout> | null,
  })

  const clearTimer = useCallback(() => {
    if (state.current.timer) {
      clearTimeout(state.current.timer)
      state.current.timer = null
    }
  }, [])

  const resetState = useCallback(() => {
    clearTimer()
    state.current.dragging = false
    state.current.pointerId = -1
    state.current.startIndex = -1
    state.current.over = -1
    setDragIndex(null)
    setOverIndex(null)
  }, [clearTimer])

  useEffect(() => resetState, [resetState])

  const itemElements = useCallback((): HTMLElement[] => {
    const container = containerRef.current
    if (!container) return []
    return Array.from(container.querySelectorAll<HTMLElement>('[data-reorder-index]'))
  }, [])

  const insertIndexForY = useCallback(
    (clientY: number): number => {
      const els = itemElements()
      for (let i = 0; i < els.length; i += 1) {
        const rect = els[i].getBoundingClientRect()
        if (clientY < rect.top + rect.height / 2) {
          return i
        }
      }
      return els.length
    },
    [itemElements],
  )

  const beginDrag = useCallback((index: number, pointerId: number) => {
    state.current.dragging = true
    state.current.over = index
    setDragIndex(index)
    setOverIndex(index)
    try {
      containerRef.current?.setPointerCapture(pointerId)
    } catch {
      // capture can throw if the pointer already ended — safe to ignore.
    }
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(15)
    }
  }, [])

  // Swallow the click that fires right after a drag so a reorder doesn't also
  // open the row's inline editor.
  const suppressNextClick = useCallback(() => {
    const handler = (event: MouseEvent) => {
      event.stopPropagation()
      event.preventDefault()
    }
    document.addEventListener('click', handler, { capture: true, once: true })
    window.setTimeout(() => document.removeEventListener('click', handler, true), 400)
  }, [])

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled) return
      const target = event.target as HTMLElement

      // Let real controls and the open editor keep their own interactions.
      if (target.closest('input, textarea, select, a, .task-edit')) return

      const isGrip = Boolean(target.closest('.task-drag-handle'))
      // Off the grip, ignore other buttons (checkbox, quick-action) so taps work.
      if (!isGrip && target.closest('button')) return

      const itemEl = target.closest<HTMLElement>('[data-reorder-index]')
      if (!itemEl || !containerRef.current?.contains(itemEl)) return

      const index = Number(itemEl.dataset.reorderIndex)
      if (Number.isNaN(index)) return

      state.current.pointerId = event.pointerId
      state.current.startX = event.clientX
      state.current.startY = event.clientY
      state.current.startIndex = index

      if (isGrip) {
        event.preventDefault()
        beginDrag(index, event.pointerId)
      } else if (event.pointerType === 'touch') {
        clearTimer()
        state.current.timer = setTimeout(() => {
          state.current.timer = null
          beginDrag(index, event.pointerId)
        }, LONG_PRESS_MS)
      }
    },
    [enabled, beginDrag, clearTimer],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const s = state.current
      if (s.pointerId !== event.pointerId) return

      if (!s.dragging) {
        // Still in the press window — a real move means the user is scrolling.
        if (s.timer) {
          const dx = Math.abs(event.clientX - s.startX)
          const dy = Math.abs(event.clientY - s.startY)
          if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) {
            clearTimer()
          }
        }
        return
      }

      event.preventDefault()
      const over = insertIndexForY(event.clientY)
      if (over !== s.over) {
        s.over = over
        setOverIndex(over)
      }
    },
    [clearTimer, insertIndexForY],
  )

  const endGesture = useCallback(
    (commit: boolean) => {
      const s = state.current
      if (s.dragging && commit) {
        const from = s.startIndex
        const insert = s.over
        // Insert position → array index once the dragged row is pulled out.
        const to = insert > from ? insert - 1 : insert
        if (from >= 0 && to >= 0 && to < count && to !== from) {
          onReorder(from, to)
        }
        suppressNextClick()
      }
      resetState()
    },
    [count, onReorder, resetState, suppressNextClick],
  )

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (state.current.pointerId !== event.pointerId) return
      endGesture(true)
    },
    [endGesture],
  )

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (state.current.pointerId !== event.pointerId) return
      endGesture(false)
    },
    [endGesture],
  )

  return {
    containerRef,
    dragIndex,
    overIndex,
    isDragging: dragIndex !== null,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  }
}
