// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

const clientMocks = vi.hoisted(() => ({ getAceConfig: vi.fn() }))

vi.mock('./ace/client', () => clientMocks)

import { SystemDashboard } from './SystemDashboard'

const AT = 1788400000

const MACHINE = {
  machine: 'MrPasionfruit-Desktop',
  at: AT,
  cpu: 18.6,
  ram_used_gb: 12.1,
  ram_total_gb: 31.88,
  disk_used_gb: 700.2,
  disk_total_gb: 1396.4,
  gpu: 'NVIDIA GeForce RTX 4060',
  uptime_s: 7200,
  mc_state: null,
  services: { ollama: true, cloudflared: true },
}

const HISTORY = [
  { at: AT - 1200, cpu: 12, ram_used_gb: 10 },
  { at: AT - 600, cpu: 20, ram_used_gb: 11 },
  { at: AT, cpu: 18.6, ram_used_gb: 12.1 },
]

/** Answers the two system routes; anything else 404s the way the worker does. */
function stubFetch(routes: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string) => {
      const { pathname } = new URL(String(input), 'https://worker.test')
      const body = routes[pathname]
      return Promise.resolve({
        ok: body !== undefined,
        status: body === undefined ? 404 : 200,
        json: () => Promise.resolve(body ?? { error: 'No such route' }),
      } as Response)
    }),
  )
}

/** The whole point of the placeholder chain: the grid is never left empty. */
function gridChildren() {
  return document.querySelector('.page-grid')?.childElementCount ?? 0
}

beforeEach(() => {
  vi.clearAllMocks()
  clientMocks.getAceConfig.mockReturnValue({ baseUrl: 'https://worker.test', model: 'qwen3:8b' })
  stubFetch({
    '/system/machines': { now: AT + 10, machines: [MACHINE] },
    '/system/history': { history: { [MACHINE.machine]: HISTORY } },
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('SystemDashboard', () => {
  it('asks for sign-in rather than rendering nothing when no token has arrived', () => {
    // Configured but tokenless is a real state — the admin route renders before
    // the stored Google token has been read back. It used to match none of the
    // page's conditions and leave the grid completely empty.
    render(<SystemDashboard idToken="" />)

    expect(screen.getByText(/Sign in with the admin account/)).toBeTruthy()
    expect(gridChildren()).toBeGreaterThan(0)
  })

  it('names the missing variable when the worker URL is unset', () => {
    clientMocks.getAceConfig.mockReturnValue(null)

    render(<SystemDashboard idToken="a-token" />)

    expect(screen.getByText(/VITE_ACE_BASE_URL/)).toBeTruthy()
    expect(gridChildren()).toBeGreaterThan(0)
  })

  it('renders a card per machine and folds its history into the sparkline', async () => {
    render(<SystemDashboard idToken="a-token" />)

    expect(await screen.findByText(MACHINE.machine)).toBeTruthy()
    expect(screen.getByText('Online')).toBeTruthy()

    // History arrives from its own endpoint and is merged in by machine name.
    await waitFor(() => expect(document.querySelector('.system-sparkline')).toBeTruthy())
  })

  it('reads latest and history from separate endpoints', async () => {
    render(<SystemDashboard idToken="a-token" />)
    await screen.findByText(MACHINE.machine)

    const paths = vi.mocked(fetch).mock.calls.map((call) => String(call[0]))
    expect(paths).toContain('https://worker.test/system/machines')
    expect(paths).toContain('https://worker.test/system/history')
  })

  it('shows a failed machines read instead of an empty page', async () => {
    stubFetch({ '/system/history': { history: {} } })

    render(<SystemDashboard idToken="a-token" />)

    expect(await screen.findByText(/No such route/)).toBeTruthy()
    expect(gridChildren()).toBeGreaterThan(0)
  })

  it('keeps the machines it has when only the history read fails', async () => {
    stubFetch({ '/system/machines': { now: AT + 10, machines: [MACHINE] } })

    render(<SystemDashboard idToken="a-token" />)

    // Sparklines are decoration; losing them must not blank the card or raise
    // an error over data that loaded fine.
    expect(await screen.findByText(MACHINE.machine)).toBeTruthy()
    expect(document.querySelector('.sheets-error')).toBeNull()
  })

  it('does not poll while the tab is hidden', async () => {
    render(<SystemDashboard idToken="a-token" />)
    await screen.findByText(MACHINE.machine)

    const before = vi.mocked(fetch).mock.calls.length
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))

    expect(vi.mocked(fetch).mock.calls.length).toBe(before)
  })
})
