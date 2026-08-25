import * as React from 'react'
import { render, cleanup, waitFor } from '@testing-library/react'
import { ErrorBoundary } from 'react-error-boundary'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The load itself was always guarded. These cover what runs *after* it --
// `restore(config)`, `size()`, the `onRender` callback -- which used to reject
// into nothing: `setState` never ran, so the preview stayed blank with no message.

interface Deferred {
  resolve: (table: unknown) => void
  reject: (e: unknown) => void
}

// One entry per `worker.table()` call, so a test can settle each effect run
// independently and interleave them.
const tableCalls: Deferred[] = []

vi.mock('@finos/perspective', () => ({
  default: {
    worker: () => ({
      table: () =>
        new Promise((resolve, reject) => {
          tableCalls.push({ resolve, reject })
        }),
    }),
  },
}))

vi.mock('utils/perspective-pollution', () => ({ themes: ['material'] }))

import * as perspective from './perspective'

const size = vi.fn(async () => 2)
const fakeTable = { size, delete: vi.fn(async () => {}) }

// `renderViewer` does `document.createElement('perspective-viewer')`, so the
// element has to exist for the code under test to have anything to call.
const restore = vi.fn(async () => {})

class FakeViewer extends HTMLElement {
  restore = restore

  load = vi.fn(async () => {})

  save = vi.fn(async () => ({}))

  toggleConfig = vi.fn()

  delete = vi.fn(async () => {})
}

if (!customElements.get('perspective-viewer')) {
  customElements.define('perspective-viewer', FakeViewer)
}

const ATTRS = { className: 'viewer' }

function Subject({ data, config }: { data: string; config?: object }) {
  const [root, setRoot] = React.useState<HTMLDivElement | null>(null)
  const state = perspective.use(root, data, ATTRS, config as never)
  return <div data-testid="root" ref={setRoot} children={state ? 'loaded' : 'pending'} />
}

const subject = (data: string, config?: object) => (
  <ErrorBoundary fallback={<div data-testid="fallback">failed</div>}>
    <Subject data={data} config={config} />
  </ErrorBoundary>
)

// let queued promise callbacks run without asserting anything
const settle = () => waitFor(() => expect(true).toBe(true))

describe('utils/perspective', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    tableCalls.length = 0
    restore.mockReset()
    restore.mockImplementation(async () => {})
    size.mockReset()
    size.mockImplementation(async () => 2)
  })

  afterEach(() => {
    cleanup()
    consoleError.mockRestore()
  })

  it('loads the table', async () => {
    const { getByTestId } = render(subject('a,b\n1,2\n'))
    await waitFor(() => expect(tableCalls).toHaveLength(1))
    tableCalls[0].resolve(fakeTable)
    await waitFor(() => expect(getByTestId('root').textContent).toBe('loaded'))
  })

  it('surfaces a rejected restore(config)', async () => {
    // what a quilt_summarize.json naming a column the file lacks produces
    restore.mockImplementation(async () => {
      throw new Error("Invalid column 'nonexistent' found in View group_by")
    })

    const { getByTestId } = render(subject('a,b\n1,2\n', { group_by: ['nonexistent'] }))
    await waitFor(() => expect(tableCalls).toHaveLength(1))
    tableCalls[0].resolve(fakeTable)

    await waitFor(() => expect(getByTestId('fallback')).toBeTruthy())
  })

  it('surfaces a rejected size()', async () => {
    size.mockImplementation(async () => {
      throw new Error('gone')
    })

    const { getByTestId } = render(subject('a,b\n1,2\n'))
    await waitFor(() => expect(tableCalls).toHaveLength(1))
    tableCalls[0].resolve(fakeTable)

    await waitFor(() => expect(getByTestId('fallback')).toBeTruthy())
  })

  it('ignores a run the next one replaced', async () => {
    // "Load more" changes `data`, which is an effect dep: the first run is
    // abandoned mid-flight and must not report its failure over the second.
    const { getByTestId, queryByTestId, rerender } = render(subject('a,b\n1,2\n'))

    await waitFor(() => expect(tableCalls).toHaveLength(1))
    rerender(subject('a,b\n1,2\n3,4\n'))
    await waitFor(() => expect(tableCalls).toHaveLength(2))

    tableCalls[0].reject(new Error('abandoned'))
    await settle()
    expect(queryByTestId('fallback')).toBeNull()

    tableCalls[1].resolve(fakeTable)
    await waitFor(() => expect(getByTestId('root').textContent).toBe('loaded'))
  })
})
