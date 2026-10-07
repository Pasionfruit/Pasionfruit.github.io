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

vi.mock('./client', () => clientMocks)
vi.mock('./context', () => contextMocks)
vi.mock('../../data/sheets/repositories', () => ({ archiveMail: vi.fn() }))
vi.mock('../../data/todoist/repositories', () => ({ closeTask: vi.fn(), createTask: vi.fn() }))

import { AceChat } from './AceChat'
import { AceMarkdown } from './AceMarkdown'
import type { AceMessage } from './client'
import { CONTEXT_PENDING_PROMPT, QUICK_PROMPTS } from './prompts'
import { todayKey } from '../../data/todoist/dates'

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
  wellnessHistory: [],
  activities: [],
  trainingPlan: [],
  races: [],
  milestones: [],
  journal: [],
  gaps: [],
}

const LOADING_HINT = /still gathering your mail/i

function renderChat() {
  return render(<AceChat idToken="token" todoistConfigured={false} open onClose={() => {}} />)
}

function sentMessages(call = 0) {
  return (clientMocks.aceChat.mock.calls[call][0] as { messages: AceMessage[] }).messages
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  clientMocks.aceChat.mockResolvedValue("I don't have that data yet.")
})

afterEach(() => {
  cleanup()
})

async function ask(question: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Message Ace'), question)
  await user.click(screen.getByRole('button', { name: 'Ask' }))
  await waitFor(() => expect(clientMocks.aceChat).toHaveBeenCalledTimes(1))
  return sentMessages()
}

describe('AceChat context', () => {
  it('tells the model the data is still loading rather than sending nothing', async () => {
    // Sources never resolve: the question goes out while Ace is still gathering.
    contextMocks.buildAceContext.mockReturnValue(new Promise(() => {}))
    renderChat()

    expect(screen.getByText(LOADING_HINT)).toBeTruthy()

    const messages = await ask('What is on today?')

    expect(messages[1]).toEqual({ role: 'system', content: CONTEXT_PENDING_PROMPT })
    expect(messages.some((message) => message.content.includes('RENDERED CONTEXT'))).toBe(false)
  })

  it('sends the rendered context once it has loaded', async () => {
    contextMocks.buildAceContext.mockResolvedValue(EMPTY_CONTEXT)
    renderChat()

    await waitFor(() => expect(screen.queryByText(LOADING_HINT)).toBeNull())

    const messages = await ask('What is on today?')

    expect(messages[1].role).toBe('system')
    expect(messages[1].content).toContain('RENDERED CONTEXT')
    expect(messages[1].content).not.toBe(CONTEXT_PENDING_PROMPT)
  })
})

describe('AceChat quick prompts', () => {
  it('shows the short label but asks the model the full instruction', async () => {
    contextMocks.buildAceContext.mockResolvedValue(EMPTY_CONTEXT)
    clientMocks.aceChat.mockResolvedValue('**Mon** — Easy run, 40 min, zone 2')
    renderChat()
    const user = userEvent.setup()

    const training = QUICK_PROMPTS.find((quick) => quick.id === 'training')!
    await user.click(screen.getByRole('button', { name: training.label }))
    await waitFor(() => expect(clientMocks.aceChat).toHaveBeenCalledTimes(1))

    const last = sentMessages().at(-1)!
    expect(last).toEqual({ role: 'user', content: training.prompt })
    // The bubble shows what was tapped, not the instruction behind it.
    expect(screen.getByText(training.label, { selector: '.ace-turn-user' })).toBeTruthy()
    expect(await screen.findByText('Mon')).toBeTruthy()
  })

  it('replays the full instruction, not the label, on the next turn', async () => {
    contextMocks.buildAceContext.mockResolvedValue(EMPTY_CONTEXT)
    renderChat()
    const user = userEvent.setup()

    const sleep = QUICK_PROMPTS.find((quick) => quick.id === 'sleep')!
    await user.click(screen.getByRole('button', { name: sleep.label }))
    await waitFor(() => expect(clientMocks.aceChat).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ask' })).toBeTruthy())

    await user.type(screen.getByLabelText('Message Ace'), 'And tonight?')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    await waitFor(() => expect(clientMocks.aceChat).toHaveBeenCalledTimes(2))

    const history = sentMessages(1).slice(2)
    expect(history.map((message) => message.content)).toEqual([
      sleep.prompt,
      "I don't have that data yet.",
      'And tonight?',
    ])
  })
})

describe('AceChat conversation', () => {
  it("keeps today's conversation across a remount", async () => {
    contextMocks.buildAceContext.mockResolvedValue(EMPTY_CONTEXT)
    const first = renderChat()

    await ask('Remember this chat')
    expect(await screen.findByText("I don't have that data yet.")).toBeTruthy()
    first.unmount()

    renderChat()
    expect(screen.getByText('Remember this chat')).toBeTruthy()
    expect(screen.getByText("I don't have that data yet.")).toBeTruthy()
  })

  it("starts clean when the stored conversation is from another day", () => {
    contextMocks.buildAceContext.mockResolvedValue(EMPTY_CONTEXT)
    localStorage.setItem(
      'ace-conversation',
      JSON.stringify({ day: '2000-01-01', turns: [{ id: 'u-1', role: 'user', content: 'Old news' }] }),
    )

    renderChat()

    expect(screen.queryByText('Old news')).toBeNull()
    expect(screen.getByText(/what's on your mind/i)).toBeTruthy()
  })

  it('clears the thread and gathers fresh context on New conversation', async () => {
    contextMocks.buildAceContext.mockResolvedValue(EMPTY_CONTEXT)
    localStorage.setItem(
      'ace-conversation',
      JSON.stringify({ day: todayKey(), turns: [{ id: 'u-1', role: 'user', content: 'Earlier today' }] }),
    )
    renderChat()
    const user = userEvent.setup()

    expect(screen.getByText('Earlier today')).toBeTruthy()
    await waitFor(() => expect(contextMocks.buildAceContext).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: 'New conversation' }))

    expect(screen.queryByText('Earlier today')).toBeNull()
    expect(localStorage.getItem('ace-conversation')).toBeNull()
    await waitFor(() => expect(contextMocks.buildAceContext).toHaveBeenCalledTimes(2))
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

  it('renders a stray # heading as a label instead of printing the hashes', () => {
    const { container } = render(<AceMarkdown text="## Week 1" />)
    expect(container.textContent).toBe('Week 1')
  })
})
