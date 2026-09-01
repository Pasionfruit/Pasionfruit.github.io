// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const clientMocks = vi.hoisted(() => ({
  aceChat: vi.fn(),
  aceJson: vi.fn(),
  aceTts: vi.fn(),
  getAceConfig: vi.fn(() => ({ baseUrl: 'https://ace.test', model: 'qwen3:8b' })),
}))

const contextMocks = vi.hoisted(() => ({
  buildAceContext: vi.fn(),
  renderAceContext: vi.fn(() => 'RENDERED CONTEXT'),
}))

vi.mock('./ace/client', () => clientMocks)
vi.mock('./ace/context', () => contextMocks)
vi.mock('../data/sheets/repositories', () => ({ archiveMail: vi.fn() }))
vi.mock('../data/todoist/repositories', () => ({ closeTask: vi.fn(), createTask: vi.fn() }))

import { AceMarkdown, AssistantAceCard } from './AssistantAceCard'
import type { AceMessage } from './ace/client'
import { CONTEXT_PENDING_PROMPT } from './ace/prompts'

const EMPTY_CONTEXT = {
  now: new Date(),
  mail: [],
  events: [],
  tasksToday: [],
  tasksOverdue: [],
  completedYesterday: [],
  completedToday: [],
  slippedYesterday: [],
  tasksTomorrow: [],
  wellness: null,
  gaps: [],
}

const LOADING_HINT = /still gathering today/i

beforeEach(() => {
  vi.clearAllMocks()
  clientMocks.aceChat.mockResolvedValue("I don't have today's data yet.")
})

afterEach(() => {
  cleanup()
})

async function ask(question: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Message Ace'), question)
  await user.click(screen.getByRole('button', { name: 'Ask' }))
  await waitFor(() => expect(clientMocks.aceChat).toHaveBeenCalledTimes(1))
  return (clientMocks.aceChat.mock.calls[0][0] as { messages: AceMessage[] }).messages
}

describe('AssistantAceCard chat context', () => {
  it('tells the model the data is still loading rather than sending nothing', async () => {
    // Sources never resolve: the question goes out during "Gathering today…".
    contextMocks.buildAceContext.mockReturnValue(new Promise(() => {}))
    render(<AssistantAceCard title="Ace" idToken="token" todoistConfigured={false} />)

    expect(screen.getByText(LOADING_HINT)).toBeTruthy()

    const messages = await ask('What is on today?')

    expect(messages[1]).toEqual({ role: 'system', content: CONTEXT_PENDING_PROMPT })
    expect(messages.some((message) => message.content.includes('RENDERED CONTEXT'))).toBe(false)
  })

  it('sends the rendered context once it has loaded', async () => {
    contextMocks.buildAceContext.mockResolvedValue(EMPTY_CONTEXT)
    render(<AssistantAceCard title="Ace" idToken="token" todoistConfigured={false} />)

    await waitFor(() => expect(screen.queryByText(LOADING_HINT)).toBeNull())

    const messages = await ask('What is on today?')

    expect(messages[1].role).toBe('system')
    expect(messages[1].content).toContain('RENDERED CONTEXT')
    expect(messages[1].content).not.toBe(CONTEXT_PENDING_PROMPT)
  })
})

describe('AceMarkdown', () => {
  it('keeps a real space between a bold label and its body', () => {
    const { container } = render(<AceMarkdown text="**Meeting** — Client call at 10:00 AM." />)
    expect(container.textContent).toBe('Meeting Client call at 10:00 AM.')
  })

  it('also drops a colon separator after the label', () => {
    const { container } = render(<AceMarkdown text="**Email**: Reply to Sam." />)
    expect(container.textContent).toBe('Email Reply to Sam.')
  })
})
