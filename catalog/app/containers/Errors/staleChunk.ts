import mkStorage from 'utils/storage'

const storage = mkStorage({ chunkReload: 'CHUNK_RELOAD' })

const RETRY_WINDOW = 60 * 1000

// A deploy removes the previous build's chunks, so a page loaded before it
// fails on its next lazy import. One reload picks up the new build; a second
// failure within the window is a real error and is left to the fallback.
export function reloadIfStaleChunk(error: unknown): boolean {
  if (!(error instanceof Error) || error.name !== 'ChunkLoadError') return false
  try {
    const last: number | null = storage.get('chunkReload')
    if (last && Date.now() - last < RETRY_WINDOW) return false
    storage.set('chunkReload', Date.now())
  } catch {
    return false
  }
  window.location.reload()
  return true
}
