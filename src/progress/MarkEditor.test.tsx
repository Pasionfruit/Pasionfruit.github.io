// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import type { SkinMark } from './client'
import { MarkedImage } from './MarkEditor'

function Harness() {
  const [marks, setMarks] = useState<SkinMark[]>([])
  return <MarkedImage src="x.jpg" alt="photo" marks={marks} onChange={setMarks} />
}

describe('MarkedImage', () => {
  it('keeps adding circles on every tap', () => {
    const { container } = render(<Harness />)
    const svg = container.querySelector('.pg-marked-frame') as HTMLDivElement
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000, right: 1000, bottom: 1000, x: 0, y: 0, toJSON() {} }) as DOMRect
    fireEvent.click(svg, { clientX: 100, clientY: 100 })
    fireEvent.click(svg, { clientX: 500, clientY: 500 })
    fireEvent.click(svg, { clientX: 800, clientY: 200 })
    expect(container.querySelectorAll('svg.pg-marks circle')).toHaveLength(3)
    expect(screen.getByText(/A = acne 3/)).toBeTruthy()
    // A tap right on an existing ring selects it; it does not add a fourth.
    const [first] = Array.from(container.querySelectorAll('svg.pg-marks circle'))
    const r = Number(first.getAttribute('r')) * 1000
    fireEvent.click(svg, { clientX: 100 + r, clientY: 100 })
    expect(container.querySelectorAll('svg.pg-marks circle')).toHaveLength(3)
    expect(screen.getByText(/Selected A1/)).toBeTruthy()
    // Many quick taps in a crowd all land.
    for (let i = 0; i < 20; i++) fireEvent.click(svg, { clientX: 50 + i * 40, clientY: 900 })
    expect(container.querySelectorAll('svg.pg-marks circle')).toHaveLength(23)
  })
})
