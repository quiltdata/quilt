import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as M from '@material-ui/core'

import * as style from 'constants/style'

vi.mock('constants/config', () => ({ default: {} }))

// The product screens link with `urls.*`; a minimal stand-in keeps the spec off
// the real route table without stubbing the components under test.
vi.mock('utils/NamedRoutes', async () => ({
  ...(await vi.importActual('utils/NamedRoutes')),
  use: () => ({
    paths: {
      bucketOverview: '/b/:bucket',
      bucketDir: '/b/:bucket/tree/:path(.+/)?',
      bucketFile: '/b/:bucket/tree/:path(.*[^/])',
      bucketConnect: '/b/:bucket/connect',
      bucketDefinition: '/b/:bucket/definition',
      bucketSharing: '/b/:bucket/sharing',
      bucketAccess: '/b/:bucket/access',
    },
    urls: {
      bucketRoot: (b: string) => `/b/${b}`,
      bucketOverview: (b: string) => `/b/${b}`,
      bucketDir: (b: string) => `/b/${b}/tree/`,
      bucketConnect: (b: string) => `/b/${b}/connect`,
      bucketDefinition: (b: string) => `/b/${b}/definition`,
      bucketSharing: (b: string) => `/b/${b}/sharing`,
      bucketAccess: (b: string) => `/b/${b}/access`,
      buckets: () => '/buckets',
      home: () => '/',
    },
  }),
}))

import * as DP from 'model/DataProducts'
import * as fixtures from 'model/DataProducts/fixtures'

import Access from './Access'
import Connect from './Connect'
import Files from './Files'
import FixtureNotice from './FixtureNotice'
import Sharing from './Sharing'

const wrap = (ui: React.ReactNode) =>
  render(
    <MemoryRouter>
      <M.MuiThemeProvider theme={style.appTheme}>{ui}</M.MuiThemeProvider>
    </MemoryRouter>,
  )

const owned = () => {
  const v = fixtures.volumeFor(fixtures.WS_GENOMICS, 'fixture-assay-cohort-2026')
  if (!v || v.kind !== 'PRODUCT') throw new Error('fixture missing')
  return v
}

/** The same product as the other workspace sees it: a subscriber, not the owner. */
const asSubscriber = () => {
  const v = fixtures.volumeFor(fixtures.WS_CLINICAL, 'fixture-assay-cohort-2026')
  if (!v || v.kind !== 'PRODUCT') throw new Error('fixture missing')
  return v
}

const listedNotHeld = () => {
  const v = fixtures.volumeFor(fixtures.WS_GENOMICS, 'fixture-imaging-tiles')
  if (!v || v.kind !== 'PRODUCT') throw new Error('fixture missing')
  return v
}

/**
 * The barrel, loaded the way the router loads it.
 *
 * `App.jsx` reaches both screens through a dynamic `import('containers/DataProducts')`
 * and resolves `m.ExchangeScreen` / `m.NewProductScreen`. A barrel exporting only
 * `default` gave both routes `{ default: undefined }` and crashed the SPA on render,
 * and nothing caught it: `App.jsx` is untyped JSX, and the rest of this spec imports
 * leaf components directly. So this loads through the barrel and asserts what the
 * router dereferences.
 */
describe('containers/DataProducts barrel', () => {
  it('exports the named screens App resolves off it', async () => {
    const m = await import('./index')
    expect(typeof m.ExchangeScreen).toBe('function')
    expect(typeof m.NewProductScreen).toBe('function')
    expect(typeof m.default).toBe('function')
  })
})

describe('containers/DataProducts', () => {
  /**
   * The rule this suite exists for. A publisher's queue and subscriber list come
   * from the exchange record; a workspace reads only its own slice of `holdings`
   * (DEC-52). The projection enforces it, and these assert the screen honors the
   * projection rather than reaching around it.
   */
  describe('Sharing reads the exchange record, not another workspace’s holdings', () => {
    it('renders the owner’s queue and subscriber rows', () => {
      const { queryAllByTestId } = wrap(<Sharing product={owned()} />)
      expect(queryAllByTestId('dp-request-row').length).toBeGreaterThan(0)
      expect(queryAllByTestId('dp-subscriber-row').length).toBeGreaterThan(0)
    })

    it('shows no queue or subscriber list to a workspace that does not own it', () => {
      const { queryAllByTestId, queryByText } = wrap(<Sharing product={asSubscriber()} />)
      expect(queryAllByTestId('dp-request-row')).toHaveLength(0)
      expect(queryAllByTestId('dp-subscriber-row')).toHaveLength(0)
      // Reported as a lack of standing, not as an empty queue -- "no requests"
      // would be a claim this workspace cannot make.
      expect(
        queryByText(/Only the publishing workspace can see this product/),
      ).toBeTruthy()
    })

    it('names no other workspace when a non-owner renders Sharing', () => {
      // The strongest form: the *other* subscribers' names must not appear
      // anywhere in the output, so a future convenience field cannot leak them.
      const { container } = wrap(<Sharing product={asSubscriber()} />)
      const text = container.textContent ?? ''
      for (const name of [
        'fixture-ws-biostats',
        'fixture-ws-imaging',
        'fixture-ws-registry-ops',
        'fixture-ws-archive',
        'fixture-ws-vendor-qc',
      ]) {
        expect(text).not.toContain(name)
      }
    })
  })

  describe('Sharing copy keeps the model’s distinctions', () => {
    it('says unpublish removes the listing and leaves approved access alone', () => {
      const { queryByText } = wrap(<Sharing product={owned()} />)
      expect(
        queryByText(/Unpublishing removes the listing\. Workspaces already approved/),
      ).toBeTruthy()
    })

    it('says a revoke leaves outstanding credentials working, never “access removed”', () => {
      const { container } = wrap(<Sharing product={owned()} />)
      const text = container.textContent ?? ''
      expect(text).toMatch(/keep working until they expire/)
      expect(text).not.toMatch(/access removed/i)
    })

    it('names the grantee as a workspace, and warns that every member can read', () => {
      const { container } = wrap(<Sharing product={owned()} />)
      expect(container.textContent).toMatch(
        /Every member of fixture-ws-\S+ will be able to read/,
      )
    })

    it('renders every disagreement row as itself rather than a resolved state', () => {
      const { container } = wrap(<Sharing product={owned()} />)
      const states = Array.from(container.querySelectorAll('[data-state]'), (el) =>
        el.getAttribute('data-state'),
      )
      for (const s of [
        'APPROVAL_FAILED',
        'APPROVED_GRANT_MISSING',
        'REJECTED_GRANT_PRESENT',
        'REVOKE_FAILED',
        'UNKNOWN',
      ]) {
        expect(states).toContain(s)
      }
    })

    it('keeps a failed approval in the queue with a retry, not as a success', () => {
      const { container } = wrap(<Sharing product={owned()} />)
      const failed = container.querySelector(
        '[data-testid="dp-request-row"][data-state="APPROVAL_FAILED"]',
      )
      expect(failed).toBeTruthy()
      expect(failed?.textContent).toMatch(/still pending/)
      expect(failed?.textContent).toMatch(/Retry approval/)
    })

    it('renders “state unknown” as a last-confirmed reading, never a concrete state', () => {
      const { container } = wrap(<Sharing product={owned()} />)
      const unknown = container.querySelector('[data-state="UNKNOWN"]')
      expect(unknown?.textContent).toMatch(/Last confirmed:/)
      expect(unknown?.textContent).toMatch(/could not be read just now/)
    })
  })

  /**
   * Every write on this stack is unavailable, and the screens must say so rather
   * than reporting a success or an error. These pin that the notice is what a
   * control produces.
   */
  describe('writes report as unavailable, never as done', () => {
    it('reports a request as not filed, naming what is missing', async () => {
      const { getByText, findByTestId } = wrap(<Access product={listedNotHeld()} />)
      getByText(/Request access as/).click()
      const notice = await findByTestId('dp-act-unavailable')
      expect(notice.textContent).toMatch(/no request was filed/)
    })

    it('reports an approval as writing no grant', async () => {
      const { getAllByText, findByTestId } = wrap(<Sharing product={owned()} />)
      getAllByText('Approve')[0]!.click()
      const notice = await findByTestId('dp-act-unavailable')
      expect(notice.textContent).toMatch(/no grant was written/)
    })
  })

  /**
   * Files renders a state, never a tree and never an S3 fallback. The tab is also
   * not offered where a grant is not confirmed present.
   */
  describe('Files', () => {
    it('is a state, not a listing, when minting is unavailable', () => {
      const { getByTestId } = wrap(<Files product={owned()} />)
      const panel = getByTestId('dp-files-mint-unavailable')
      expect(panel.textContent).toMatch(/Minting access is not wired yet/)
      // The absence of a fallback is stated, so no reader concludes the catalog
      // could read the objects another way.
      expect(panel.textContent).toMatch(/does not read a product’s objects any other way/)
    })

    it('refuses the tab where the workspace has no subscription', () => {
      const { getByTestId } = wrap(<Files product={listedNotHeld()} />)
      const panel = getByTestId('dp-files-no-grant')
      expect(panel.textContent).toMatch(/A listing is visibility, not access/)
    })

    it('makes no claim that a mint would make bytes readable', () => {
      // A successful mint proves a capture exists and nothing more: an entry
      // outside the owning workspace's reach lists and fails at read (DEC-44).
      const { container } = wrap(<Files product={owned()} />)
      expect(container.textContent).toMatch(/proves a capture exists/)
      expect(container.textContent).toMatch(/read, or refused, when it is opened/)
    })
  })

  describe('Access', () => {
    it('names the workspace on the request act, not the person', () => {
      const { getByText } = wrap(<Access product={listedNotHeld()} />)
      expect(getByText(`Request access as ${fixtures.WS_GENOMICS}`)).toBeTruthy()
    })

    it('offers no Files link on an approval whose grant is missing', () => {
      // The screen rule R4 case: approved on the record, no grant, so a mint
      // would fail. Built by hand rather than found in the fixture set, so the
      // assertion cannot pass because no such row happened to exist.
      const base = asSubscriber()
      const sub = base.holding!.subscription!
      const product: DP.ProductVolume = {
        ...base,
        holding: {
          ...base.holding!,
          subscription: { ...sub, grant: { status: 'ABSENT', at: new Date() } },
        },
      }
      const { queryByText } = wrap(<Access product={product} />)
      expect(queryByText('Open files')).toBeNull()
      expect(queryByText(/grant could not be confirmed/)).toBeTruthy()
    })

    it('offers Files on a confirmed grant', () => {
      const { queryByText } = wrap(<Access product={asSubscriber()} />)
      expect(queryByText('Open files')).toBeTruthy()
    })
  })

  describe('Connect', () => {
    it('teaches the call without rendering credentials', () => {
      const { container } = wrap(<Connect product={owned()} />)
      const text = container.textContent ?? ''
      expect(text).toMatch(/dpp\.example-stack\.quilt/)
      expect(text).toMatch(/it does not perform it/)
      // No secret, and nothing that looks like one.
      expect(text).not.toMatch(/AccessKeyId["']?\s*[:=]\s*["'][A-Z0-9]/)
    })

    it('says a mint will not succeed without a subscription, on a listing', () => {
      const { container } = wrap(<Connect product={listedNotHeld()} />)
      expect(container.textContent).toMatch(/no subscription to this product/)
    })
  })

  describe('the fixture notice', () => {
    it('is rendered on a product screen and cannot be dismissed', () => {
      // Rendered via the product layout in the app; asserted here on the
      // component every product surface mounts, since a dismissable notice is
      // absent exactly when the reader has forgotten it.
      const { getByTestId } = wrap(<FixtureNoticeProbe />)
      const notice = getByTestId('dp-fixture-notice')
      expect(notice.textContent).toMatch(/sample data/)
      expect(notice.textContent).toMatch(/Nothing here is written to a registry/)
      expect(notice.textContent).toMatch(/no access is granted/)
      expect(notice.querySelector('button')).toBeNull()
    })
  })
})

function FixtureNoticeProbe() {
  return <FixtureNotice />
}
