// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { WorkoutText } from './WorkoutText'

afterEach(() => {
  cleanup()
})

describe('WorkoutText', () => {
  it('renders a pasted workout as a bold title over a bullet list', () => {
    const { container } = render(<WorkoutText value={'**Long run**\n• 5min warm-up\n• 60min easy/run–walk'} />)

    expect(container.querySelector('strong')?.textContent).toBe('Long run')
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '5min warm-up',
      '60min easy/run–walk',
    ])
    // The markers are formatting, not text.
    expect(container.textContent).not.toMatch(/\*\*|•/)
  })

  it('leaves a one-word workout as plain text', () => {
    const { container } = render(<WorkoutText value="Legs" />)

    expect(container.innerHTML).toBe('<span>Legs</span>')
  })

  it('shows the placeholder when there is no workout', () => {
    render(<WorkoutText value="" empty="Morning —" />)

    expect(screen.getByText('Morning —')).toBeTruthy()
  })
})
