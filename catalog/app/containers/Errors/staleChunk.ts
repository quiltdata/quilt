const KEY = 'CHUNK_RELOAD'

const RETRY_WINDOW = 60 * 1000

// A tab loaded before a deploy fails on its next lazy import; one reload picks
// up the new build. The guard is per tab, and a repeat failure within the
// window is a real error left to the fallback.
export function reloadIfStaleChunk(error: unknown): boolean {
  if (!(error instanceof Error) || error.name !== 'ChunkLoadError') return false
  try {
    if (Date.now() - Number(sessionStorage.getItem(KEY)) < RETRY_WINDOW) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    // Without a guard a reload could loop, so leave it to the fallback.
    return false
  }
  window.location.reload()
  return true
}
