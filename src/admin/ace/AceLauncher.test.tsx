// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const contextMocks = vi.hoisted(() => ({
  buildAceContext: vi.fn(),
  renderAceContext: vi.fn(() => 'RENDERED CONTEXT'),
}))

vi.mock('./client', () => ({
  aceChat: vi.fn(),
  aceJson: vi.fn(),
  aceTts: vi.fn(),
  getAceConfig: () => ({ baseUrl: 'https://ace.test', model: 'qwen3:8b' }),
}))
vi.mock('./context', () => contextMocks)
vi.mock('../../data/sheets/repositories', () => ({ archiveMail: vi.fn() }))
vi.mock('../../data/todoist/repositories', () => ({ closeTask: vi.fn(), createTask: vi.fn() }))

import { AceLauncher } from './AceLauncher'
import { askAceAboutNews } from './newsSummary'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  contextMocks.buildAceContext.mockReturnValue(new Promise(() => {}))
})

afterEach(() => {
  cleanup()
})

describe('AceLauncher', () => {
  it('opens Ace with the selected article summary prompt, including repeated selections', async () => {
    render(<AceLauncher idToken="token" todoistConfigured={false} />)
    const article = { title: 'City opens a new park', url: 'https://publisher.com/park', source: 'City News', publishedAt: '' }
    act(() => askAceAboutNews(article))
    expect(screen.getByRole('dialog', { name: 'Ace' })).toBeTruthy()
    expect((screen.getByLabelText('Message Ace') as HTMLTextAreaElement).value).toContain(article.url)
    expect((screen.getByLabelText('Message Ace') as HTMLTextAreaElement).value).toContain('high-level summary')
    await userEvent.setup().clear(screen.getByLabelText('Message Ace'))
    act(() => askAceAboutNews(article))
    expect((screen.getByLabelText('Message Ace') as HTMLTextAreaElement).value).toContain(article.title)
  })

  it('gathers nothing until the button is pressed', () => {
    render(<AceLauncher idToken="token" todoistConfigured={false} />)

    expect(screen.getByRole('button', { name: 'Open Ace' })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(contextMocks.buildAceContext).not.toHaveBeenCalled()
  })

  it('opens the panel, closes it on Escape, and hands focus back to the button', async () => {
    render(<AceLauncher idToken="token" todoistConfigured={false} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Open Ace' }))

    expect(screen.getByRole('dialog', { name: 'Ace' })).toBeTruthy()
    expect(contextMocks.buildAceContext).toHaveBeenCalledTimes(1)

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open Ace' }))
  })

  it('keeps the conversation mounted while closed instead of starting over', async () => {
    render(<AceLauncher idToken="token" todoistConfigured={false} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Open Ace' }))
    await user.type(screen.getByLabelText('Message Ace'), 'half-typed thought')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await user.click(screen.getByRole('button', { name: 'Open Ace' }))

    expect((screen.getByLabelText('Message Ace') as HTMLTextAreaElement).value).toBe('half-typed thought')
    // Reopening within the staleness window does not re-gather.
    expect(contextMocks.buildAceContext).toHaveBeenCalledTimes(1)
  })
})
