import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import * as M from '@material-ui/core'
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { uriResolver } from 'constants/routes'
import * as style from 'constants/style'
import * as NamedRoutes from 'utils/NamedRoutes'

vi.mock('constants/config', () => ({ default: {}, registryUrl: '' }))

// The search state machine and bucket resolution are out of scope here: this
// spec is about the header field's registration seam. SearchInput.spec.tsx
// proves the provider/hook mechanics against a stand-in field; this proves the
// REAL ContentBar attaches the shared ref to its actual input -- the wiring
// that, when broken, turned the no-results refine links into silent no-ops.
vi.mock('components/SearchBar/State', () => ({
  default: () => ({
    helpOpen: false,
    input: { value: '', onChange: () => {} },
    onClickAway: () => {},
    suggestions: null,
  }),
}))

vi.mock('components/SearchBar/Suggestions', () => ({ default: () => null }))

vi.mock('utils/Buckets', () => ({ useCurrentBucket: () => null }))

import { ContentBar } from './ContentBar'
import { SearchInputProvider, useSearchInput } from './SearchInput'

function Page({ onReady }: { onReady: (h: ReturnType<typeof useSearchInput>) => void }) {
  const searchInput = useSearchInput()
  React.useEffect(() => onReady(searchInput), [onReady, searchInput])
  return null
}

const renderBoth = () => {
  let handle: ReturnType<typeof useSearchInput> | undefined
  const utils = render(
    // The ambient app theme, as app.tsx provides it: ContentBar's styles read
    // the theme extensions (typography.monospace) before its own inner theme
    // wrapper takes effect.
    <M.MuiThemeProvider theme={style.appTheme}>
      <MemoryRouter>
        <NamedRoutes.Provider routes={{ uriResolver }}>
          <SearchInputProvider>
            <ContentBar />
            <Page onReady={(h) => (handle = h)} />
          </SearchInputProvider>
        </NamedRoutes.Provider>
      </MemoryRouter>
    </M.MuiThemeProvider>,
  )
  return { ...utils, getHandle: () => handle! }
}

describe('components/Layout/ContentBar (header field registration)', () => {
  afterEach(cleanup)

  it('registers its query field so a page-level focus() reaches it', () => {
    const { container, getHandle } = renderBoth()
    const input = container.querySelector('input')!
    expect(input).toBeTruthy()
    expect(document.activeElement).not.toBe(input)
    getHandle().focus()
    expect(document.activeElement).toBe(input)
  })

  it("focuses the field on '/' pressed outside an input", () => {
    const { container } = renderBoth()
    const input = container.querySelector('input')!
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }))
    expect(document.activeElement).toBe(input)
  })

  it("ignores '/' typed inside another input", () => {
    const { container } = renderBoth()
    const outside = document.createElement('input')
    document.body.appendChild(outside)
    outside.focus()
    const evt = new KeyboardEvent('keydown', { key: '/', bubbles: true })
    Object.defineProperty(evt, 'target', { value: outside })
    window.dispatchEvent(evt)
    expect(document.activeElement).toBe(outside)
    expect(document.activeElement).not.toBe(container.querySelector('input'))
    document.body.removeChild(outside)
  })
})
