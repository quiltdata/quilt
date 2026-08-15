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
//
// `searchState` is mutable so the combobox tests can open the dropdown and move
// the highlight. It defaults to the null-suggestions shape on purpose: consumers
// can mount the bar before any suggestions exist, and dereferencing that shape
// unguarded crashed the whole header.
const { searchState } = vi.hoisted(() => ({
  searchState: {
    helpOpen: false,
    input: { value: '', onChange: () => {} },
    onClickAway: () => {},
    suggestions: null as null | { items: unknown[]; selected: number },
  },
}))

vi.mock('components/SearchBar/State', () => ({
  default: () => searchState,
}))

// Suggestions is deliberately NOT mocked: the combobox contract below is a
// claim about two modules agreeing on option ids, and a stub would make that
// agreement unfalsifiable.
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

const openWithSuggestions = (selected: number) => {
  searchState.helpOpen = true
  searchState.suggestions = {
    items: [
      {
        kind: 'search',
        key: 'global-packages',
        what: 'packages',
        where: 'in all buckets',
        url: '/search?q=a',
      },
      {
        kind: 'search',
        key: 'global-objects',
        what: 'objects',
        where: 'in all buckets',
        url: '/search?q=b',
      },
    ],
    selected,
  }
}

describe('components/Layout/ContentBar (header field registration)', () => {
  afterEach(() => {
    cleanup()
    searchState.helpOpen = false
    searchState.suggestions = null
  })

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

  // The field owns a popup list whose highlighted row is what Enter commits.
  // Before this wiring the placeholder was the only name and the highlight was
  // a CSS class, so Enter fired a navigation a screen-reader user could not
  // perceive. These assert the whole chain, not just the attributes: each
  // pointer has to resolve to a real element of the right role.
  it('names itself as a combobox and reports the popup closed', () => {
    const { container } = renderBoth()
    const input = container.querySelector('input')!
    expect(input.getAttribute('role')).toBe('combobox')
    expect(input.getAttribute('aria-label')).toBe('Search packages and objects')
    expect(input.getAttribute('aria-autocomplete')).toBe('list')
    expect(input.getAttribute('aria-expanded')).toBe('false')
    // Nothing is highlighted while the list is shut, so naming a row would
    // point assistive tech at an element that isn't there.
    expect(input.getAttribute('aria-activedescendant')).toBeNull()
  })

  it('points aria-controls at a real listbox once the popup opens', () => {
    openWithSuggestions(0)
    const { container } = renderBoth()
    const input = container.querySelector('input')!
    expect(input.getAttribute('aria-expanded')).toBe('true')
    const listId = input.getAttribute('aria-controls')!
    expect(listId).toBeTruthy()
    // The Popper portals out of `container`, so look at the whole document.
    const list = document.getElementById(listId)
    expect(list).toBeTruthy()
    expect(list!.getAttribute('role')).toBe('listbox')
    expect(list!.querySelectorAll('[role="option"]')).toHaveLength(2)
  })

  // In the compact shell the rail is an overlay, so this button is the only way
  // back to navigation. It is icon-only, and MUI's SvgIcon is aria-hidden, so
  // without an explicit label it computes an empty accessible name.
  it('offers a named menu button only when the shell asks for one', () => {
    const { container } = renderBoth()
    expect(container.querySelector('[aria-label="Open navigation"]')).toBeNull()
    cleanup()
    const withMenu = render(
      <M.MuiThemeProvider theme={style.appTheme}>
        <MemoryRouter>
          <NamedRoutes.Provider routes={{ uriResolver }}>
            <SearchInputProvider>
              <ContentBar onMenu={() => {}} />
            </SearchInputProvider>
          </NamedRoutes.Provider>
        </MemoryRouter>
      </M.MuiThemeProvider>,
    )
    const button = withMenu.container.querySelector('[aria-label="Open navigation"]')!
    expect(button).toBeTruthy()
    // Reachable by keyboard, not just present: this is the sole path to the nav.
    ;(button as HTMLElement).focus()
    expect(document.activeElement).toBe(button)
  })

  it('names the highlighted row, and that row is the one marked selected', () => {
    openWithSuggestions(1)
    const { container } = renderBoth()
    const input = container.querySelector('input')!
    const activeId = input.getAttribute('aria-activedescendant')!
    expect(activeId).toBeTruthy()
    // The id the input announces must resolve -- this is the lockstep between
    // ContentBar's `suggestionOptionId` call and the ids Suggestions renders.
    const active = document.getElementById(activeId)
    expect(active).toBeTruthy()
    expect(active!.getAttribute('role')).toBe('option')
    expect(active!.getAttribute('aria-selected')).toBe('true')
    // ...and it is the row the state machine says is selected (index 1), not
    // merely *some* option: an off-by-one here announces the wrong destination.
    const options = Array.from(
      document
        .getElementById(input.getAttribute('aria-controls')!)!
        .querySelectorAll('[role="option"]'),
    )
    expect(options.indexOf(active!)).toBe(1)
    expect(
      options.filter((o) => o.getAttribute('aria-selected') === 'true'),
    ).toHaveLength(1)
  })
})
