import * as React from 'react'
import { render, cleanup, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import * as Column from './Column'

// jsdom has no ResizeObserver and measures nothing, so the band can only be
// driven by handing the Provider an observer whose callback this file calls.
// One instance at a time is all `Provider` creates.
let deliver: ((width: number) => void) | null = null

class StubResizeObserver {
  constructor(cb: ResizeObserverCallback) {
    deliver = (width: number) =>
      cb([{ contentRect: { width } } as ResizeObserverEntry], this as never)
  }

  // Observing fires the callback for real, but with a width jsdom reports as 0;
  // the tests below deliver their own, which is the case that matters.
  observe() {}

  unobserve() {}

  disconnect() {
    deliver = null
  }
}

vi.stubGlobal('ResizeObserver', StubResizeObserver)

describe('components/Layout/Column', () => {
  it('retargets a query from the viewport to the main column', () => {
    expect(Column.down('sm')).toBe('@container main (max-width:959.95px)')
    expect(Column.up('md')).toBe('@container main (min-width:960px)')
  })

  it('passes a pixel width through at the same threshold MUI would emit', () => {
    // A named band would round these to 960/600 and move a hand-tuned tier.
    expect(Column.down(1044)).toBe('@container main (max-width:1043.95px)')
    expect(Column.down(844)).toBe('@container main (max-width:843.95px)')
  })

  // The page tiers retargeted onto the column (Bucket/Header, PackageTree)
  // carry pixel numbers derived from what the shell takes out of the viewport.
  // Read from the source, so a later edit to either number has to come here and
  // restate the rule rather than quietly drifting from the tier it replaced.
  describe('the retargeted page tiers', () => {
    const read = async (path: string) => {
      const fs = await import('fs')
      return fs.readFileSync(new URL(path, import.meta.url), 'utf8')
    }

    // Above 960px the docked rail is the only chrome outside the measurement:
    // Qurator's gutter is padding on the column's parent, and the page inset is
    // inside the container. So a viewport tier of N is a column tier of N-256.
    const RAIL = 256

    it('bucket header stacks at the column the 1300px viewport tier meant', async () => {
      const src = await read('../../containers/Bucket/Header.tsx')
      expect(src).toContain(`Column.down(${1300 - RAIL})`)
      expect(src).not.toContain('breakpoints.down(1300)')
    })

    it('package top bar stacks at the column the 1100px viewport tier meant', async () => {
      const src = await read('../../containers/Bucket/PackageTree/PackageTree.tsx')
      expect(src).toContain(`Column.down(${1100 - RAIL})`)
      expect(src).not.toContain('breakpoints.down(1100)')
    })

    // Below 960px the rail is an overlay and takes no row width, so a tier in
    // that regime needs no translation -- the column *is* the viewport.
    it('the narrow readout tier keeps the viewport tier’s own number', async () => {
      const src = await read('../../containers/Bucket/Header.tsx')
      expect(src).toContain('Column.down(640)')
    })
  })

  // Greptile P2: the assertions above read query strings and source text, so a
  // break in the measurement path -- the observer, the band, the fallback --
  // would leave every one of them green. This drives a width through to a
  // consumer that changes its markup on the band, not just its styles.
  describe('a measured width reaches a consumer', () => {
    afterEach(() => {
      cleanup()
      deliver = null
    })

    // Mirrors `Iconized`: below `sm` it renders an icon-only control.
    function Consumer() {
      const sm = Column.useDown('sm')
      return <span data-testid="shape">{sm ? 'icon' : 'label'}</span>
    }

    const mount = () => {
      const target = document.createElement('div')
      return render(
        <Column.Provider target={target}>
          <Consumer />
        </Column.Provider>,
      )
    }

    it('reads a narrow column as narrow, whatever the viewport says', () => {
      const { getByTestId } = mount()
      act(() => deliver!(700))
      expect(getByTestId('shape').textContent).toBe('icon')
    })

    it('reads a wide column as wide', () => {
      const { getByTestId } = mount()
      act(() => deliver!(1200))
      expect(getByTestId('shape').textContent).toBe('label')
    })

    it('follows the column when the panel takes its width', () => {
      const { getByTestId } = mount()
      act(() => deliver!(1200))
      expect(getByTestId('shape').textContent).toBe('label')
      // Qurator docks: same viewport, narrower column.
      act(() => deliver!(700))
      expect(getByTestId('shape').textContent).toBe('icon')
    })

    it('falls back to the viewport until a width arrives', () => {
      // No delivery: `band` is null, which is what a bare page and a portal see.
      const { getByTestId } = mount()
      // jsdom reports no match for any media query, i.e. a wide viewport.
      expect(getByTestId('shape').textContent).toBe('label')
    })
  })
})
