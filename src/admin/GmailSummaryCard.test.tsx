// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mailMocks = vi.hoisted(() => ({
  archiveMail: vi.fn(),
  createDraftReply: vi.fn(),
  getMail: vi.fn(),
}))

vi.mock('../data/sheets/repositories', () => mailMocks)

import { GmailSummaryCard } from './GmailSummaryCard'

const MESSAGE = {
  id: 'm-1',
  threadId: 't-1',
  from: 'Sam Lee <sam@example.com>',
  subject: 'Invoice for August',
  snippet: 'Attached is the invoice.',
  receivedAt: '2026-08-31T09:00:00.000Z',
  unread: true,
  important: false,
}

const SECOND = { ...MESSAGE, id: 'm-2', threadId: 't-2', subject: 'Second thread' }

const ARCHIVED_NOTICE = 'Archived. Still in All Mail if you need it back.'

beforeEach(() => {
  vi.clearAllMocks()
  // Without an Apps Script URL the card renders its "not configured" panel.
  vi.stubEnv('VITE_SHEETS_API_BASE_URL', 'https://script.google.com/macros/s/test/exec')
  mailMocks.getMail.mockResolvedValue([MESSAGE])
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

async function renderCard() {
  render(<GmailSummaryCard title="Inbox" idToken="token" />)
  await screen.findByText('Invoice for August')
}

describe('GmailSummaryCard archive', () => {
  it('removes the row and confirms when Gmail archives the thread', async () => {
    const user = userEvent.setup()
    mailMocks.archiveMail.mockResolvedValue({ archived: ['t-1'], failed: [] })
    await renderCard()

    await user.click(screen.getByRole('button', { name: 'Archive' }))

    expect(mailMocks.archiveMail).toHaveBeenCalledWith('token', ['t-1'])
    await screen.findByText(ARCHIVED_NOTICE)
    expect(screen.queryByText('Invoice for August')).toBeNull()
  })

  it('keeps the row and shows the reason when archiving fails', async () => {
    const user = userEvent.setup()
    mailMocks.archiveMail.mockRejectedValue(
      new Error('Apps Script is not authorised to change Gmail.'),
    )
    await renderCard()

    await user.click(screen.getByRole('button', { name: 'Archive' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('not authorised to change Gmail')
    // The optimistic removal is rolled back so the thread can be retried.
    expect(screen.getByText('Invoice for August')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Archive' })).toBeTruthy()
    expect(screen.queryByText(ARCHIVED_NOTICE)).toBeNull()
  })

  it('does not report success when the thread is missing from `archived`', async () => {
    const user = userEvent.setup()
    // The shape an older script build returns for a thread it could not archive.
    mailMocks.archiveMail.mockResolvedValue({ archived: [], failed: ['t-1'] })
    await renderCard()

    await user.click(screen.getByRole('button', { name: 'Archive' }))

    await screen.findByRole('alert')
    expect(screen.queryByText(ARCHIVED_NOTICE)).toBeNull()
    expect(screen.getByText('Invoice for August')).toBeTruthy()
  })
})

describe('GmailSummaryCard clear inbox', () => {
  async function renderTwo() {
    render(<GmailSummaryCard title="Inbox" idToken="token" />)
    await screen.findByText('Second thread')
  }

  it('archives every listed thread and empties the list', async () => {
    const user = userEvent.setup()
    mailMocks.getMail.mockResolvedValue([MESSAGE, SECOND])
    mailMocks.archiveMail.mockResolvedValue({ archived: ['t-1', 't-2'], failed: [] })
    await renderTwo()

    await user.click(screen.getByRole('button', { name: 'Clear inbox' }))

    expect(mailMocks.archiveMail).toHaveBeenCalledWith('token', ['t-1', 't-2'])
    await screen.findByText('Archived 2 threads.')
    expect(screen.getByText('Inbox is empty.')).toBeTruthy()
  })

  it('restores the list and shows the reason when nothing could be archived', async () => {
    const user = userEvent.setup()
    mailMocks.getMail.mockResolvedValue([MESSAGE, SECOND])
    mailMocks.archiveMail.mockRejectedValue(
      new Error('Apps Script is not authorised to change Gmail.'),
    )
    await renderTwo()

    await user.click(screen.getByRole('button', { name: 'Clear inbox' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('not authorised to change Gmail')
    expect(screen.getByText('Invoice for August')).toBeTruthy()
    expect(screen.getByText('Second thread')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Clear inbox' })).toBeTruthy()
  })

  it('reports a partial clear and reloads what is left', async () => {
    const user = userEvent.setup()
    mailMocks.getMail.mockResolvedValueOnce([MESSAGE, SECOND]).mockResolvedValue([SECOND])
    mailMocks.archiveMail.mockResolvedValue({ archived: ['t-1'], failed: ['t-2'] })
    await renderTwo()

    await user.click(screen.getByRole('button', { name: 'Clear inbox' }))

    await screen.findByText('Archived 1 thread. 1 could not be archived.')
    await screen.findByText('Second thread')
    expect(screen.queryByText('Invoice for August')).toBeNull()
  })
})
