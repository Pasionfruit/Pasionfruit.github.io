import { describe, expect, it } from 'vitest'
import { orderSections, rowsForOrder, isSectionHidden } from './sectionLayout'
import type { TodoistSection } from '../data/todoist/types'

const section = (id: string, section_order: number): TodoistSection => ({
  id,
  project_id: 'p1',
  name: id,
  section_order,
})

const sections = [section('a', 0), section('b', 1), section('c', 2)]

describe('orderSections', () => {
  it('keeps Todoist order when nothing is saved', () => {
    expect(orderSections(sections, {}).map((s) => s.id)).toEqual(['a', 'b', 'c'])
  })

  it('applies saved positions, with unsaved sections after them', () => {
    const layout = { c: { project_id: 'p1', position: 0, hidden: false } }
    expect(orderSections(sections, layout).map((s) => s.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('rowsForOrder', () => {
  it('gives every section an explicit position and keeps hidden flags', () => {
    const layout = { b: { project_id: 'p1', position: 1, hidden: true } }
    const rows = rowsForOrder('p1', [sections[2], sections[1], sections[0]], layout)
    expect(rows).toEqual({
      c: { project_id: 'p1', position: 0, hidden: false },
      b: { project_id: 'p1', position: 1, hidden: true },
      a: { project_id: 'p1', position: 2, hidden: false },
    })
  })
})

describe('isSectionHidden', () => {
  it('defaults to visible', () => {
    expect(isSectionHidden('a', {})).toBe(false)
    expect(isSectionHidden('a', { a: { project_id: 'p1', position: 0, hidden: true } })).toBe(true)
  })
})
