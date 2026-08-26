import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import * as M from '@material-ui/core'

import * as style from 'constants/style'

import BucketCard from './BucketCard'

// PRODUCT mode so the collaborator readout renders — it is one of the two real
// controls that has to stay reachable above the card-wide navigation overlay.
vi.mock('constants/config', () => ({ default: { mode: 'PRODUCT' } }))

vi.mock('utils/NamedRoutes', async () => ({
  ...(await vi.importActual('utils/NamedRoutes')),
  use: () => ({ urls: { bucketRoot: (b: string) => `/b/${b}` } }),
}))

vi.mock('components/BucketIcon', () => ({
  default: () => <div data-testid="bucket-icon" />,
}))

// The collaborator readout is a `ButtonBase` that opens a dialog. Stubbed to a
// button so this spec can assert it is still clickable without pulling in the
// Popup and its GraphQL.
vi.mock('./Collaborators', () => ({
  default: ({ bucket }: { bucket: string }) => (
    <button type="button" onClick={() => collaboratorsClicked.push(bucket)}>
      Shared with 3
    </button>
  ),
}))

let collaboratorsClicked: string[] = []

const BUCKET = {
  name: 'genomics-raw',
  title: 'Genomics Raw',
  iconUrl: null,
  description: 'Primary sequencing output.',
  tags: ['rna', 'wgs'],
}

function renderCard(onTagClick = vi.fn()) {
  const utils = render(
    <MemoryRouter>
      <M.MuiThemeProvider theme={style.appTheme}>
        <BucketCard bucket={BUCKET} tagIsMatching={() => false} onTagClick={onTagClick} />
      </M.MuiThemeProvider>
    </MemoryRouter>,
  )
  return { ...utils, onTagClick }
}

describe('containers/Home/BucketGrid/BucketCard', () => {
  afterEach(() => {
    cleanup()
    collaboratorsClicked = []
  })

  // The card used to wash on hover from edge to edge while only the icon+title
  // header navigated, so the description and the slack above the bottom row
  // looked interactive and did nothing — the dead affordance PRODUCT.md names as
  // a legacy-lab-software anti-reference. The whole card is the target now.
  it('navigates from exactly one anchor, carrying the bucket route', () => {
    const { container } = renderCard()

    const anchors = container.querySelectorAll('a')
    // One anchor, not one per region: the card-wide target is a stretched
    // pseudo-element on this link, so nothing else needs to be an anchor.
    expect(anchors).toHaveLength(1)
    expect(anchors[0].getAttribute('href')).toBe('/b/genomics-raw')
  })

  // A button nested inside an anchor is invalid HTML and breaks keyboard and
  // screen-reader behaviour. The card holds two real controls, so the card-wide
  // target has to be an overlay rather than a wrapping link — this is the
  // assertion that keeps someone from "simplifying" it into one.
  it('keeps its controls out of the anchor', () => {
    const { container } = renderCard()

    const anchor = container.querySelector('a')!
    expect(anchor.querySelector('button')).toBeNull()
    expect(anchor.querySelectorAll('[role="button"]')).toHaveLength(0)
  })

  it('filters by a tag without navigating', () => {
    const { getByText, onTagClick } = renderCard()

    fireEvent.click(getByText('rna'))

    expect(onTagClick).toHaveBeenCalledWith('rna')
  })

  it('leaves the collaborator readout clickable', () => {
    const { getByText } = renderCard()

    fireEvent.click(getByText('Shared with 3'))

    expect(collaboratorsClicked).toEqual(['genomics-raw'])
  })

  // Asserted against the injected JSS text, not `getComputedStyle`: jsdom does not
  // resolve JSS-authored rules into computed values, and cannot hit-test a
  // pseudo-element at all. This pins the structure; the click surface needs a
  // browser.
  it('stretches its overlay to the card, not the header', () => {
    const { container } = renderCard()

    const anchor = container.querySelector('a')!
    const headerClass = anchor.className.split(/\s+/).find((c) => c.includes('header'))!
    const css = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent || '')
      .join('\n')

    const headerRule = css.slice(
      css.indexOf(`.${headerClass} {`),
      css.indexOf(`.${headerClass}::after`),
    )
    expect(headerRule).not.toMatch(/position:/)

    // And the overlay is pinned to all four edges, which is what makes it cover
    // the card rather than sit in a corner of it.
    const overlayRule = css.slice(css.indexOf(`.${headerClass}::after`))
    expect(overlayRule).toMatch(/position:\s*absolute/)
  })

  // `fireEvent.click` does no hit-testing, so the behavioural tests above pass
  // even with a control buried under the overlay. Hence asserting the stacking
  // directly — and asserting the containers stay *down*, since raising a row
  // lifts its whitespace and creates dead zones.
  it('raises each real control, and nothing else, above the navigation overlay', () => {
    const { getByText, container } = renderCard()

    const css = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent || '')
      .join('\n')

    const ruleFor = (cls: string) => {
      const start = css.indexOf(`.${cls} {`)
      return start < 0 ? '' : css.slice(start, css.indexOf('}', start))
    }
    const classOf = (el: HTMLElement, needle: string) =>
      el.className.split(/\s+/).find((c) => c.includes(needle))!
    const raised = (rule: string) =>
      /position:\s*relative/.test(rule) &&
      Number(/z-index:\s*(-?\d+)/.exec(rule)?.[1] ?? 0) > 0

    // A chip is a control: it filters the wall rather than opening the bucket.
    const chip = getByText('rna').closest('.MuiChip-root') as HTMLElement
    expect(raised(ruleFor(classOf(chip, 'tag')))).toBe(true)

    // So is the collaborator readout's wrapper, which hugs its button.
    const access = container.querySelector('[class*="access"]') as HTMLElement
    expect(raised(ruleFor(classOf(access, 'access')))).toBe(true)

    // The description too: not a control, but text a reader selects and copies, so
    // it has to sit above the card-wide navigation overlay.
    const description = container.querySelector('[class*="description"]') as HTMLElement
    expect(raised(ruleFor(classOf(description, 'description')))).toBe(true)

    // The containers are not. Their gaps belong to the card-wide link.
    let row: HTMLElement | null = getByText('rna')
    while (row && !/bottomRow/.test(row.className)) row = row.parentElement
    expect(raised(ruleFor(classOf(row!, 'bottomRow')))).toBe(false)

    const tagsWrapper = chip.parentElement as HTMLElement
    expect(raised(ruleFor(classOf(tagsWrapper, 'tags')))).toBe(false)
  })
})
