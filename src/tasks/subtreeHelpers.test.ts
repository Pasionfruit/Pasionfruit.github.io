import { describe, expect, it } from 'vitest'
import { buildTaskTree, descendantIds, subtreeHeight, withAncestors } from './grouping'
import type { TodoistTask } from '../data/todoist/types'

function t(id: string, parent_id: string | null = null, extra: Partial<TodoistTask> = {}): TodoistTask {
  return {
    id,
    parent_id,
    project_id: 'p',
    section_id: null,
    content: id,
    priority: 4,
    is_completed: false,
    due: null,
    ...extra,
  } as TodoistTask
}

// a → a1 → a11, and a → a2; b on its own.
const tasks = [t('a'), t('a1', 'a'), t('a11', 'a1'), t('a2', 'a'), t('b')]

describe('subtree helpers', () => {
  const { childrenOf } = buildTaskTree(tasks)

  it('lists every descendant, not the task itself', () => {
    expect([...descendantIds('a', childrenOf)].sort()).toEqual(['a1', 'a11', 'a2'])
    expect(descendantIds('b', childrenOf).size).toBe(0)
  })

  it('measures levels below a task', () => {
    expect(subtreeHeight('a', childrenOf)).toBe(2)
    expect(subtreeHeight('a1', childrenOf)).toBe(1)
    expect(subtreeHeight('b', childrenOf)).toBe(0)
  })

  it('keeps the ancestors of matched tasks', () => {
    const matched = [tasks[2]] // a11 only
    expect(withAncestors(tasks, matched).map((task) => task.id).sort()).toEqual(['a', 'a1', 'a11'])
  })

  it('keeps a matched task alone when it has no ancestors', () => {
    expect(withAncestors(tasks, [tasks[4]]).map((task) => task.id)).toEqual(['b'])
  })
})
