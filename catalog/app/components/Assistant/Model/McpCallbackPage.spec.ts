import { afterEach, describe, expect, it, vi } from 'vitest'

// @ts-expect-error: Vite's `?raw` import; the catalog's types don't declare it.
import PAGE from '../../../../static/oauth-mcp-callback.html?raw'

const SCRIPT = (PAGE as string).match(/<script>([\s\S]*?)<\/script>/)![1]

/** Run the page's script at `search` and return what it broadcast. */
function visit(search: string) {
  const posted: unknown[] = []
  const channels: string[] = []
  vi.stubGlobal(
    'BroadcastChannel',
    class {
      constructor(name: string) {
        channels.push(name)
      }

      postMessage(m: unknown) {
        posted.push(m)
      }

      close() {}
    },
  )
  const close = vi.spyOn(window, 'close').mockImplementation(() => {})
  window.history.replaceState(null, '', `/oauth/mcp-callback${search}`)
  // oxlint-disable-next-line no-new-func
  new Function(SCRIPT)()
  return { posted, channels, close, url: window.location.href }
}

describe('static/oauth-mcp-callback.html', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('stays inert: no referrer, no external resources', () => {
    expect(PAGE).toContain('<meta name="referrer" content="no-referrer" />')
    expect(PAGE).not.toMatch(/\b(src|href)=/)
  })

  it('broadcasts a success with code, state and iss, then clears the URL and closes', () => {
    const { posted, channels, close, url } = visit(
      '?code=c1&state=s1&iss=https%3A%2F%2Fi',
    )
    expect(channels).toEqual(['quilt-mcp-oauth'])
    expect(posted).toEqual([
      { type: 'quilt-mcp-oauth', ok: true, code: 'c1', state: 's1', iss: 'https://i' },
    ])
    expect(url).not.toContain('c1')
    expect(close).toHaveBeenCalled()
  })

  it('broadcasts a failure with its state so the opener can end that flow', () => {
    const { posted } = visit('?state=s1&error=denied')
    expect(posted).toEqual([
      { type: 'quilt-mcp-oauth', ok: false, code: null, state: 's1', error: 'denied' },
    ])
  })

  it('broadcasts a failure that has no state', () => {
    const { posted } = visit('?error=invalid')
    expect(posted).toEqual([
      { type: 'quilt-mcp-oauth', ok: false, code: null, state: null, error: 'invalid' },
    ])
  })
})
