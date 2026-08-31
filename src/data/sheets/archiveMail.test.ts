import { beforeEach, describe, expect, it, vi } from 'vitest'

const clientMocks = vi.hoisted(() => ({
  postSheetsAction: vi.fn(),
  fetchSheetTable: vi.fn(),
}))

vi.mock('./client', () => clientMocks)

import { archiveMail, describeArchiveError } from './repositories'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('archiveMail', () => {
  it('returns archived and failed ids on a partial success', async () => {
    clientMocks.postSheetsAction.mockResolvedValue({ ok: true, archived: ['a'], failed: ['b'] })

    await expect(archiveMail('token', ['a', 'b'])).resolves.toEqual({
      archived: ['a'],
      failed: ['b'],
    })
    expect(clientMocks.postSheetsAction).toHaveBeenCalledWith({
      action: 'archiveMail',
      idToken: 'token',
      thread_ids: ['a', 'b'],
    })
  })

  it('treats an ok envelope that archived nothing as a failure', async () => {
    // What older script builds return when gmail.modify is missing: the
    // permission error is swallowed per thread and the call still says ok.
    clientMocks.postSheetsAction.mockResolvedValue({ ok: true, archived: [], failed: ['a'] })

    await expect(archiveMail('token', ['a'])).rejects.toThrow(/gmail\.modify/)
  })

  it('uses the per-thread reason when the script provides one', async () => {
    clientMocks.postSheetsAction.mockResolvedValue({
      ok: true,
      archived: [],
      failed: ['a'],
      reasons: { a: 'You do not have permission to call GmailApp.moveToArchive' },
    })

    await expect(archiveMail('token', ['a'])).rejects.toThrow(/gmail\.modify scope/)
  })

  it('explains a permission error returned as ok:false', async () => {
    clientMocks.postSheetsAction.mockResolvedValue({
      ok: false,
      error: 'You do not have permission to call GmailApp.moveToArchive',
    })

    await expect(archiveMail('token', ['a'])).rejects.toThrow(/authorizeGmail/)
  })

  it('explains a stale deployment', () => {
    expect(describeArchiveError('Unknown action: archiveMail')).toMatch(/redeploy/)
  })

  it('passes through errors it does not recognise', () => {
    expect(describeArchiveError('Thread not found')).toBe('Thread not found')
  })
})
