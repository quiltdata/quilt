import * as React from 'react'
import { render, cleanup, waitFor } from '@testing-library/react'
import { ErrorBoundary } from 'react-error-boundary'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The load itself was always guarded. These cover what runs *after* it --
// `restore(config)`, `size()`, the `onRender` callback -- which used to reject
// into nothing: `setState` never ran, so the preview stayed blank with no message.

const table = {
  size: vi.fn(async () => 2),
  delete: vi.fn(async () => {}),
}

vi.mock('@finos/perspective', () => ({
  default: { worker: () => ({ table: vi.fn(async () => table) }) },
}))

vi.mock('utils/perspective-pollution', () => ({ themes: ['material'] }))

import * as perspective from './perspective'

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

function Subject({ config }: { config?: object }) {
  const [root, setRoot] = React.useState<HTMLDivElement | null>(null)
  const state = perspective.use(root, 'a,b\n1,2\n', ATTRS, config as never)
  return (
    <div ref={setRoot} data-testid="root">
      {state ? 'loaded' : 'pending'}
    </div>
  )
}

function renderSubject(config?: object) {
  return render(
    <ErrorBoundary fallback={<div data-testid="fallback">failed</div>}>
      <Subject config={config} />
    </ErrorBoundary>,
  )
}

describe('utils/perspective', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    restore.mockReset()
    restore.mockImplementation(async () => {})
    table.size.mockReset()
    table.size.mockImplementation(async () => 2)
  })

  afterEach(() => {
    cleanup()
    consoleError.mockRestore()
  })

  it('loads the table', async () => {
    const { getByTestId } = renderSubject()
    await waitFor(() => expect(getByTestId('root').textContent).toBe('loaded'))
  })

  it('surfaces a rejected restore(config)', async () => {
    // what a quilt_summarize.json naming a column the file lacks produces
    restore.mockImplementation(async () => {
      throw new Error("Invalid column 'nonexistent' found in View group_by")
    })

    const { getByTestId } = renderSubject({ group_by: ['nonexistent'] })

    await waitFor(() => expect(getByTestId('fallback')).toBeTruthy())
  })

  it('surfaces a rejected size()', async () => {
    table.size.mockImplementation(async () => {
      throw new Error('gone')
    })

    const { getByTestId } = renderSubject()

    await waitFor(() => expect(getByTestId('fallback')).toBeTruthy())
  })
})
