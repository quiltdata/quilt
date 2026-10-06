import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { reloadIfStaleChunk } from './staleChunk'

const chunkError = () =>
  Object.assign(new Error('Loading chunk 42 failed'), { name: 'ChunkLoadError' })

describe('containers/Errors/staleChunk', () => {
  const reload = vi.fn()

  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('location', { ...window.location, reload })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    reload.mockReset()
  })

  it('ignores errors other than ChunkLoadError', () => {
    expect(reloadIfStaleChunk(new Error('boom'))).toBe(false)
    expect(reloadIfStaleChunk('ChunkLoadError')).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads once, then leaves a repeat failure to the fallback', () => {
    expect(reloadIfStaleChunk(chunkError())).toBe(true)
    expect(reloadIfStaleChunk(chunkError())).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads again once the retry window has passed', () => {
    localStorage.setItem('CHUNK_RELOAD', JSON.stringify(Date.now() - 2 * 60 * 1000))
    expect(reloadIfStaleChunk(chunkError())).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
