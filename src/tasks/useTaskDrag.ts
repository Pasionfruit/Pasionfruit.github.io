import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { resolveDropTarget, type DropTarget, type RootRowBox } from './dropTarget'

// How long a touch must rest on a row before it becomes a drag, and how far the
// finger may drift in that window before we treat it as a scroll instead.
const LONG_PRESS_MS = 250
const MOVE_CANCEL_PX = 10

type UseTaskDragOptions = {
  enabled: boolean
  /** A task with subtasks cannot be nested under another, so it only reorders at the top level. */
  hasChildren: (taskId: string) => boolean
  onDrop: (drop: DropTarget, taskId: string) => void
}

/**
 * Hold-and-drag for a task list, built on pointer events so mouse, touch, and pen
 * share one path. Any row can be dragged, from its grip or after a long press on
 * touch. While dragging, a top-level row's middle band takes the task as a subtask,
 * and the gaps between top-level rows place it there.
 *
 * Rows are found by `data-task-id`; top-level rows also carry `data-root-index`.
 */
export function useTaskDrag({ enabled, hasChildren, onDrop }: UseTaskDragOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const optionsRef = useRef({ hasChildren, onDrop })
  useEffect(() => {
    optionsRef.current = { hasChildren, onDrop }
  })

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [drop, setDrop] = useState<DropTarget | null>(null)

  const state = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    dragId: null as string | null,
    dragging: false,
    drop: null as DropTarget | null,
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
    state.current.dragId = null
    state.current.drop = null
    state.current.pointerId = -1
    setDraggingId(null)
    setDrop(null)
  }, [clearTimer])

  useEffect(() => resetState, [resetState])

  const topLevelBoxes = useCallback((): RootRowBox[] => {
    const container = containerRef.current
    if (!container) return []
    return Array.from(container.querySelectorAll<HTMLElement>('.task-item[data-root-index]')).map((item) => {
      const itemRect = item.getBoundingClientRect()
      const row = item.querySelector<HTMLElement>(':scope > .task-row')
      const rowRect = (row ?? item).getBoundingClientRect()
      return {
        id: item.dataset.taskId ?? '',
        top: itemRect.top,
        bottom: itemRect.bottom,
        rowTop: rowRect.top,
        rowBottom: rowRect.bottom,
      }
    })
  }, [])

  const beginDrag = useCallback((taskId: string, pointerId: number) => {
    state.current.dragging = true
    state.current.dragId = taskId
    state.current.drop = null
    setDraggingId(taskId)
    try {
      containerRef.current?.setPointerCapture(pointerId)
    } catch {
      // capture can throw if the pointer already ended — safe to ignore.
    }
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(15)
    }
  }, [])

  // Swallow the click that fires right after a drag so a drop doesn't also
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
      // Off the grip, ignore other buttons (checkbox, chevron, quick-action) so taps work.
      if (!isGrip && target.closest('button')) return

      const itemEl = target.closest<HTMLElement>('.task-item[data-task-id]')
      if (!itemEl || !containerRef.current?.contains(itemEl)) return
      const taskId = itemEl.dataset.taskId
      if (!taskId) return

      state.current.pointerId = event.pointerId
      state.current.startX = event.clientX
      state.current.startY = event.clientY

      if (isGrip) {
        event.preventDefault()
        beginDrag(taskId, event.pointerId)
      } else if (event.pointerType === 'touch') {
        clearTimer()
        state.current.timer = setTimeout(() => {
          state.current.timer = null
          beginDrag(taskId, event.pointerId)
        }, LONG_PRESS_MS)
      }
    },
    [enabled, beginDrag, clearTimer],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const s = state.current
      if (s.pointerId !== event.pointerId) return

      if (!s.dragging || s.dragId === null) {
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
      const dragId = s.dragId
      const next = resolveDropTarget(
        topLevelBoxes(),
        event.clientY,
        dragId,
        !optionsRef.current.hasChildren(dragId),
      )
      if (JSON.stringify(next) !== JSON.stringify(s.drop)) {
        s.drop = next
        setDrop(next)
      }
    },
    [clearTimer, topLevelBoxes],
  )

  const endGesture = useCallback(
    (commit: boolean) => {
      const s = state.current
      if (s.dragging && commit && s.dragId !== null && s.drop) {
        optionsRef.current.onDrop(s.drop, s.dragId)
        suppressNextClick()
      }
      resetState()
    },
    [resetState, suppressNextClick],
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
    draggingId,
    drop,
    isDragging: draggingId !== null,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  }
}
