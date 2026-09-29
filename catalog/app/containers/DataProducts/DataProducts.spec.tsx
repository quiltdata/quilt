import * as React from 'react'
import { MemoryRouter, Route, Switch, useLocation } from 'react-router-dom'
import { render, cleanup, fireEvent } from '@testing-library/react'
import * as M from '@material-ui/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buckets,
  dataProduct,
  dataProductAccess,
  dataProductContents,
  dataProducts,
  home,
} from 'constants/routes'
import * as style from 'constants/style'
import * as DP from 'model/DataProducts'
import * as fixtures from 'model/DataProducts/fixtures'
import type { CatalogSettings } from 'utils/CatalogSettings'
import * as NamedRoutes from 'utils/NamedRoutes'

let settings: CatalogSettings | null = null
vi.mock('utils/CatalogSettings', () => ({
  use: () => settings,
  useWriteSettings: () => async () => {},
}))

vi.mock('components/Layout', () => ({
  default: () => null,
  Container: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('utils/MetaTitle', () => ({ default: () => null }))

// The Contents tab reuses `containers/Bucket/Listing`, which imports
// `BucketPreferences/Provider`, which reads `constants/config` at *module load* --
// so without this the suite fails to import at all with "window
// .QUILT_CATALOG_CONFIG must be defined". Same stub `QuiltSummarize.spec` uses for
// the same reason.
//
// Note the Provider is only ever imported, never rendered here: its context has a
// default (`Result.Init()`), and `Listing` renders row actions under a
// `Result.match` whose `_` arm is empty. So the grid renders without bucket
// preferences and simply shows no per-row actions -- which is correct for a data
// product, whose actions are download-via-broker rather than S3.
vi.mock('constants/config', () => ({ default: {} }))

// JsonDisplay (the file view's JSON preview) uses use-resize-observer, which
// needs the ResizeObserver global that jsdom lacks. Same stub JsonDisplay's own
// spec uses.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}

    unobserve() {}

    disconnect() {}
  },
)

// Stub *only* the async boundary. The port is a suspending network read, which
// would make every assertion below await a microtask and every negative
// assertion need a positive await first to avoid passing against an unrendered
// tree -- the same "passes while asserting nothing" trap this file has already
// been bitten by twice.
//
// Everything else stays real: CAPABILITIES, grantsBeyondRequester, the fixtures
// themselves. So these tests still exercise the actual rendering logic, and the
// port's async contract is covered in model/DataProducts/hooks.spec.ts instead.
vi.mock('model/DataProducts', async () => {
  const actual =
    await vi.importActual<typeof import('model/DataProducts')>('model/DataProducts')
  const fx = await vi.importActual<typeof import('model/DataProducts/fixtures')>(
    'model/DataProducts/fixtures',
  )
  return {
    ...actual,
    useProducts: (enabled = true) => (enabled ? fx.ALL_PRODUCTS : []),
    useProduct: (id: string) => fx.ALL_PRODUCTS.find((p) => p.id === id) ?? null,
    useRequests: (productId: string) =>
      fx.ALL_REQUESTS.filter((r) => r.dataProductId === productId),
    // Mirrors fixtureAdapter.listContents rather than reaching for the adapter,
    // for the same reason as the hooks above: the real one goes through
    // ResourceCache, which needs a provider these tests do not mount (it
    // destructures `access` off a context and fails with an opaque
    // "Cannot destructure property 'access' of 'use(...)'").
    //
    // The branch logic is duplicated deliberately and kept small: the adapter's
    // own version is covered directly in model/DataProducts/adapter.spec.ts, so
    // this copy only has to be faithful enough to drive the four rendering paths.
    useContents: (productId: string, memberName: string): DP.ContentsResult => {
      const product = fx.ALL_PRODUCTS.find((p) => p.id === productId)
      const member = product?.members.find((m) => m.logicalName === memberName)
      if (!member) return { ok: false, reason: 'NOT_FOUND' }
      if (member.contentsSource === 'UNAVAILABLE') {
        return { ok: false, reason: member.unavailableReason ?? 'EMPTY' }
      }
      if (!member.readable) return { ok: false, reason: 'NOT_A_MEMBER' }
      return {
        ok: true,
        entries: fx.PACKAGE_CONTENTS[`${productId}::${memberName}`] ?? [],
      }
    },
    // Mirrors fixtureAdapter.fetchEntry, for the same reason as useContents above.
    // The per-entry `readable` check is what makes the refused-file path reachable.
    useEntryBody: (
      productId: string,
      memberName: string,
      logicalKey: string,
    ): DP.EntryBodyResult => {
      const entries = fx.PACKAGE_CONTENTS[`${productId}::${memberName}`]
      const entry = entries?.find((e) => e.logicalKey === logicalKey)
      if (!entry) return { ok: false, reason: 'NOT_FOUND' }
      if (entry.readable === false) return { ok: false, reason: 'NOT_A_MEMBER' }
      const text = fx.ENTRY_TEXT[logicalKey]
      if (text === undefined) {
        return {
          ok: true,
          body: { kind: 'opaque', mediaHint: logicalKey.split('.').pop() },
        }
      }
      return { ok: true, body: { kind: 'text', text } }
    },
  }
})

import { DataProductsScreen } from './DataProducts'
import Requests from './Requests'

const routes = {
  buckets,
  dataProduct,
  dataProductAccess,
  dataProductContents,
  dataProducts,
  home,
}

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

// The detail view's styles read app-theme extensions (typography.monospace, for
// the native privilege strings), so render under the same theme the app provides.
function mount(at: string) {
  return render(
    <M.MuiThemeProvider theme={style.appTheme}>
      <MemoryRouter initialEntries={[at]}>
        <NamedRoutes.Provider routes={routes}>
          <Switch>
            <Route path={dataProducts.path}>
              <DataProductsScreen />
            </Route>
            <Route>
              <Where />
            </Route>
          </Switch>
        </NamedRoutes.Provider>
      </MemoryRouter>
    </M.MuiThemeProvider>,
  )
}

afterEach(cleanup)

describe('containers/DataProducts', () => {
  describe('with the feature off', () => {
    beforeEach(() => {
      settings = null
    })

    it('redirects away rather than rendering an empty screen', () => {
      // Off means the capability does not exist. A visible-but-empty data
      // products screen would advertise something the catalog is not meant to
      // expose yet.
      const { getByTestId } = mount(dataProducts.url())
      expect(getByTestId('where').textContent).toBe('/')
    })
  })

  describe('with the feature on', () => {
    beforeEach(() => {
      settings = { features: { 'data-products': true } } as CatalogSettings
    })

    // A product id containing `%` crashed the detail view, and our own URL builder
    // produced the crashing URL: `encodeURIComponent` emits `%25`, `history@4`
    // then runs `decodeURI(location.pathname)` before routing
    // (history/cjs/history.js:107) which turns it back into a bare `%`, and
    // `decodeURIComponent` rejects that with `URIError`. The throw sat above the
    // drift `Redirect`, so it escaped to the app error boundary and blanked the
    // catalog.
    //
    // Mounted through the real builder, because that is the reachable path: the
    // encoded pathname survives `history`'s `decodeURI`, which turns `%25` back
    // into `%` and hands `Detail` a param it cannot decode. A *raw* bare `%` in
    // the pathname is a separate failure -- `history` throws while constructing
    // the location, before any route matches, so no component can guard it.
    it('redirects instead of crashing when the id will not decode', () => {
      const { getByTestId } = mount(
        `/data-products/${encodeURIComponent('uc:cat/50%_sample')}`,
      )
      expect(getByTestId('where').textContent).toBe('/buckets')
    })

    it('says on screen that the data is illustrative', () => {
      // Every screen here reads the fixture adapter, and the rows are shaped
      // exactly like real ones — an access request or a connection error would
      // otherwise be taken at face value. Remove with the fixture adapter.
      const { getByText } = mount(dataProduct.url(fixtures.PACKAGE_PRODUCT.id))
      expect(getByText(/Example data/)).toBeTruthy()
    })

    it('sends the bare path to the volume grid rather than a second list', () => {
      // A data product is a volume, so the volume grid is the one place they are
      // browsed. A standalone list at its own URL would be a parallel index of
      // the same objects, and the two would drift. The path still resolves so an
      // old link lands somewhere sensible.
      //
      // The list-surface assertions that used to live here (platform labels,
      // "Contents not visible to you") now belong to the grid, and are covered in
      // containers/Home/Buckets.
      const { getByTestId } = mount(dataProducts.url())
      expect(getByTestId('where').textContent).toBe('/buckets')
    })

    it('separates catalog-governed contents from files listed off S3', () => {
      // The load-bearing disclosure of browse-into (contract §7.1): a DataZone
      // S3 asset gives only a bucketArn, so Quilt lists it directly and the
      // catalog's row/column rules do not cover what is shown. One
      // undifferentiated list would imply a guarantee that does not exist.
      //
      // The disclosure moved when Contents became a browser: it used to be a
      // "Files listed from S3" section heading grouping members by source, and is
      // now a per-member provenance line. Grouping by member rather than by source
      // is what lets each member have its own file tree. What must not change is
      // that the two guarantees read differently, which is what this asserts.
      const { getByText } = mount(
        dataProductContents.url('datazone:dzd_4xample/lst_9kq2v'),
      )
      expect(getByText(/Enumerated and governed by AWS DataZone/)).toBeTruthy()
      expect(getByText(/AWS DataZone identifies these by location only/)).toBeTruthy()
      expect(
        getByText(/row and column rules do not\s+apply to this listing/),
      ).toBeTruthy()
    })

    it('shows a package-backed product’s actual files, not just its members', () => {
      // The whole point of the rebuild. The previous screen listed *that* members
      // exist -- name, kind, schema, access -- which told a reader nothing about
      // what is inside. These are the three real entries from the live raja-poc
      // alpha/home package.
      const { getByText } = mount(
        dataProductContents.url('datazone:dzd-61b4n7ubllnqlj/46g5jnuhfnucyv'),
      )
      expect(getByText('README.md')).toBeTruthy()
      expect(getByText('data.csv')).toBeTruthy()
      expect(getByText('results.json')).toBeTruthy()
      // And the directories, which only appear if prefix grouping ran.
      expect(getByText('raw')).toBeTruthy()
      expect(getByText('derived')).toBeTruthy()
    })

    it('names the revision a package listing came from', () => {
      // Reproducibility is the property that distinguishes a manifest listing
      // from a bucket listing, and it is worth nothing if the reader cannot see
      // which revision they are looking at.
      const { getByText } = mount(
        dataProductContents.url('datazone:dzd-61b4n7ubllnqlj/46g5jnuhfnucyv'),
      )
      expect(
        getByText(
          /alpha\/home@bee98d061f67228f36ee807e42bea4165575c02495c996119b3587c7f8e6ed84/,
        ),
      ).toBeTruthy()
    })

    it('reports a per-object denial without hiding the rest of the listing', () => {
      // The broker checks membership per object, so a fully visible listing can
      // contain a refused entry. Dropping it would understate the package;
      // marking the whole member unreadable would hide everything else.
      //
      // Scoped to `derived/`, which is where the refused entry lives. This test
      // used to sit at the package root and pass on a package-wide count -- a
      // number about files the reader could not see from there. Counting per
      // directory is the fix; asserting it here is what pins the fix.
      const { getByText } = mount(
        `${dataProductContents.url('datazone:dzd-61b4n7ubllnqlj/46g5jnuhfnucyv')}?member=alpha%2Fhome&dir=derived%2F`,
      )
      // Stated in words rather than by dimming a row: state is never signalled by
      // color alone (DESIGN.md).
      expect(getByText(/1 not readable by you/)).toBeTruthy()
    })

    it('counts files for the directory on screen, not the whole package', () => {
      // The bug this pins: package totals were rendered beside a per-directory
      // breadcrumb, so a folder holding one file could read "8 files". Cross-model
      // review (gpt-5.6-sol) caught it.
      const { getByText } = mount(
        `${dataProductContents.url('datazone:dzd-61b4n7ubllnqlj/46g5jnuhfnucyv')}?member=alpha%2Fhome&dir=derived%2F`,
      )
      // derived/ holds exactly one entry; the package holds more. Both are shown,
      // each labelled, so neither number can be mistaken for the other.
      //
      // The package count is derived from the fixture rather than hardcoded: it
      // was written as a literal 8, and adding one fixture entry broke the test
      // for a reason that had nothing to do with the behaviour being pinned.
      const total =
        fixtures.PACKAGE_CONTENTS[`${fixtures.PACKAGE_PRODUCT.id}::alpha/home`]!.length
      expect(getByText(/^1 file · /)).toBeTruthy()
      expect(getByText(new RegExp(`${total} in package`))).toBeTruthy()
    })

    it('says a path is absent rather than rendering an empty grid', () => {
      // Reachable from a bookmark: a pinned revision need not contain a directory
      // that a later one does. Previously this rendered an empty grid beside
      // nonzero package totals, which reads as a broken listing.
      const { getByText } = mount(
        `${dataProductContents.url('datazone:dzd-61b4n7ubllnqlj/46g5jnuhfnucyv')}?member=alpha%2Fhome&dir=no%2Fsuch%2Fdir%2F`,
      )
      expect(getByText(/Nothing at this path in this revision/)).toBeTruthy()
    })

    it('makes parent breadcrumbs real, focusable actions', () => {
      // They were styled `<a>` elements with no href and no onClick: dead links,
      // not keyboard-reachable, leaving the inert `..` row as the only way up a
      // deep tree. The same WCAG 2.1.1 failure fixed for grid rows and missed here.
      const { getByText, container } = mount(
        `${dataProductContents.url('datazone:dzd-61b4n7ubllnqlj/46g5jnuhfnucyv')}?member=alpha%2Fhome&dir=raw%2Fplate_10%2F`,
      )
      // StyledLink renders a <button> when given onClick and no `to`, which is
      // what makes it focusable at all.
      const parent = container.querySelector('button')
      expect(parent).toBeTruthy()
      // And it navigates: clicking `raw` goes up a level, so plate_2 appears.
      fireEvent.click(getByText('raw'))
      expect(getByText('plate_2')).toBeTruthy()
    })

    it('keeps the size column on a directory holding only folders', () => {
      // `raw/` contains only subdirectories, so there are no *file* rows -- but the
      // folder rows carry real summed sizes. The old predicate checked only files,
      // so it hid the column on every intermediate directory of a nested package,
      // withholding sizes the manifest had reported.
      //
      // Written because mutation-testing found this fix uncovered: reverting it
      // failed nothing.
      const { getByText, container } = mount(
        `${dataProductContents.url('datazone:dzd-61b4n7ubllnqlj/46g5jnuhfnucyv')}?member=alpha%2Fhome&dir=raw%2F`,
      )
      expect(getByText('plate_2')).toBeTruthy()
      expect(container.textContent).toMatch(/Size/)
    })

    it('agrees between the file count and the refusal count', () => {
      // These were mismatched: files counted recursively, refusals only at the
      // level. A directory whose nested objects were all refused read as fully
      // readable. `derived/` holds one refused file, so both must see it.
      const { getByText } = mount(
        `${dataProductContents.url('datazone:dzd-61b4n7ubllnqlj/46g5jnuhfnucyv')}?member=alpha%2Fhome&dir=derived%2F`,
      )
      expect(getByText(/^1 file · /)).toBeTruthy()
      expect(getByText(/1 not readable by you/)).toBeTruthy()
    })

    it('keeps the size column for a zero-byte file', () => {
      // Zero is a KNOWN size, not a missing one. The old check was
      // `!f.sizeBytes`, which is true for 0 -- so a directory whose only file was
      // empty hid a column we could have filled, reporting "we don't know" about
      // a size we did know.
      //
      // This test exists because mutation-testing the fix found nothing to fail:
      // the change was real but uncovered, and no fixture had a zero-byte entry.
      const { getByText, container } = mount(
        `${dataProductContents.url('datazone:dzd-61b4n7ubllnqlj/46g5jnuhfnucyv')}?member=alpha%2Fhome&dir=logs%2F`,
      )
      expect(getByText('empty.log')).toBeTruthy()
      // The grid renders a Size header only when some item reports one.
      expect(container.textContent).toMatch(/Size/)
    })

    it('gives file rows a keyboard path, not just a click target', () => {
      // WCAG 2.1.1. The rows were mouse-only divs, so a keyboard user could not
      // open a file at all.
      const { getByText } = mount(
        dataProductContents.url('datazone:dzd-61b4n7ubllnqlj/46g5jnuhfnucyv'),
      )
      const cell = getByText('README.md').closest('[role="button"]')
      expect(cell).toBeTruthy()
      expect(cell!.getAttribute('tabindex')).toBe('0')
      // Enter opens it, same as a click.
      fireEvent.keyDown(cell!, { key: 'Enter' })
      expect(getByText(/subject-level readouts/)).toBeTruthy()
    })

    it('distinguishes a dangling product from an empty or restricted one', () => {
      // 4 of raja-poc's 7 published products are in this state: published,
      // discoverable, resolving to nothing. Telling the reader to request access
      // would send them to an admin who finds nothing to grant.
      const { getByText, queryByText } = mount(
        dataProductContents.url('datazone:dzd-61b4n7ubllnqlj/5i2yhfmdd9nbqf'),
      )
      expect(getByText('Contents not found')).toBeTruthy()
      expect(getByText(/Ask whoever publishes this product/)).toBeTruthy()
      // The distinction that matters: not phrased as a permission problem.
      expect(queryByText(/request access/i)).toBeNull()
      expect(queryByText(/catalog admin/i)).toBeNull()
    })

    it('opens a file when its row is clicked', () => {
      // The whole point of this change. Files were inert on the belief that a
      // preview needed an S3 handle -- true of every loader, false of the
      // renderers.
      const { getByText, queryByText } = mount(
        dataProductContents.url('datazone:dzd-61b4n7ubllnqlj/46g5jnuhfnucyv'),
      )
      // The README's rendered body is absent before the click and present after,
      // so this cannot pass against an unrendered tree.
      expect(queryByText(/subject-level readouts/)).toBeNull()
      fireEvent.click(getByText('README.md'))
      expect(getByText(/subject-level readouts/)).toBeTruthy()
    })

    it('keeps the listing visible while a file is open', () => {
      // Below the listing rather than replacing it: opening one file in a plate of
      // 300 should not cost the reader their place.
      //
      // Asserted by counting rows rather than by text, because the opened README
      // *mentions* data.csv in its body -- a getByText would find two matches and
      // fail for a reason that has nothing to do with the listing surviving. That
      // ambiguity is itself evidence the file body rendered.
      const { getByText, container } = mount(
        dataProductContents.url('datazone:dzd-61b4n7ubllnqlj/46g5jnuhfnucyv'),
      )
      const rowsBefore = container.querySelectorAll('[role="row"]').length
      expect(rowsBefore).toBeGreaterThan(1)
      fireEvent.click(getByText('README.md'))
      expect(container.querySelectorAll('[role="row"]').length).toBe(rowsBefore)
    })

    it('shows a file’s pinned URI as its identity', () => {
      const { getByText } = mount(
        dataProductContents.url('datazone:dzd-61b4n7ubllnqlj/46g5jnuhfnucyv'),
      )
      fireEvent.click(getByText('README.md'))
      // Registry, package, immutable revision, and the entry's own path -- which
      // together make a reference to this one file reproducible.
      expect(getByText(/&path=README\.md$/)).toBeTruthy()
    })

    it('renders a JSON file through the JSON viewer, not as raw text', async () => {
      const { getByText, findByText } = mount(
        dataProductContents.url('datazone:dzd-61b4n7ubllnqlj/46g5jnuhfnucyv'),
      )
      fireEvent.click(getByText('results.json'))
      // JsonDisplay renders asynchronously -- it shows "rendering..." first, which
      // a synchronous getByText catches instead of the content. Awaiting is the
      // point rather than an inconvenience: it proves the viewer mounted and
      // settled, where a <pre> dump would have been there immediately.
      // Structured keys, not a text dump. `mean: 4.206` proves the viewer parsed
      // and rendered the object; a <pre> would show the raw JSON braces instead.
      expect(await findByText(/mean/)).toBeTruthy()
      expect(getByText(/4\.206/)).toBeTruthy()
      // The nested array stays collapsed at defaultExpanded={1}, which is why this
      // asserts a top-level key rather than a value inside `arms`.
      expect(getByText(/<…2>/)).toBeTruthy()
    })

    it('admits it cannot preview a file rather than showing an empty pane', () => {
      // A .tiff has bytes that are not text. The honest outcome is
      // identity-without-preview -- the alternative is a pane that looks like a
      // preview and is not.
      const { getByText } = mount(
        `${dataProductContents.url('datazone:dzd-61b4n7ubllnqlj/46g5jnuhfnucyv')}?member=alpha%2Fhome&dir=raw%2Fplate_2%2F`,
      )
      fireEvent.click(getByText('A01.tiff'))
      expect(getByText(/No preview for this file type/)).toBeTruthy()
      // Identity survives: it is what a reader copies into a notebook.
      expect(getByText(/&path=raw\/plate_2\/A01\.tiff$/)).toBeTruthy()
    })

    it('reports a refused file with the same words the listing uses', () => {
      // The broker checks membership per object, so one file can be denied inside
      // a fully visible listing. It must name the same person to ask as a refused
      // listing does, or the reader learns two vocabularies for one problem.
      const { getByText } = mount(
        `${dataProductContents.url('datazone:dzd-61b4n7ubllnqlj/46g5jnuhfnucyv')}?member=alpha%2Fhome&dir=derived%2F`,
      )
      fireEvent.click(getByText('restricted.parquet'))
      expect(getByText('Contents not visible to you')).toBeTruthy()
      expect(getByText(/Ask a catalog admin/)).toBeTruthy()
    })

    it('routes the two access denials to different people', () => {
      // Both are "you lack access", at different layers -- a catalog grant versus
      // a bucket policy -- and a reader told the wrong one wastes a round trip
      // discovering the message was wrong.
      const { getByText } = mount(
        dataProductContents.url('datazone:dzd_4xample/lst_9kq2v'),
      )
      // assay_outputs is readable: false, which is a catalog-side denial.
      expect(getByText('Contents not visible to you')).toBeTruthy()
      expect(getByText(/Ask a catalog admin/)).toBeTruthy()
    })

    it('never claims what a named person can see', () => {
      // Unknowable in principle: row-policy bodies can call external functions.
      const { getByText } = mount(dataProductAccess.url('datazone:dzd_4xample/lst_9kq2v'))
      expect(
        getByText(/not a statement of what any\s+particular person can see/),
      ).toBeTruthy()
    })

    it('renders unreadable policy state as unknown, not as none', () => {
      // POLICY_REFERENCES is privilege-filtered, so absence is not a guarantee.
      const { getByText } = mount(dataProductAccess.url('snowflake:GZT1a9xQ2'))
      expect(getByText(/Treat\s+this as unknown rather than as none/)).toBeTruthy()
    })

    it('opens on Overview, with contents and access one click away', () => {
      // Overview is the bare product route. The sections are addressable rather
      // than local state, so a tab is linkable and survives reload.
      const { getByText } = mount(dataProduct.url('datazone:dzd_4xample/lst_9kq2v'))
      expect(getByText('Data product')).toBeTruthy()
      expect(getByText('Overview')).toBeTruthy()
      expect(getByText('Contents')).toBeTruthy()
      expect(getByText('Access')).toBeTruthy()
    })

    it('redirects an unknown id to the volume grid instead of 404ing', () => {
      // A synthesized id is not stable across renames — on Unity a schema rename
      // silently changes it and emits no event — so a miss is expected drift, not
      // a bad URL. Lands on the grid, which is where products are browsed.
      const { getByTestId } = mount(
        dataProduct.url('uc:aws-prod-metastore/quilt_demo/gone'),
      )
      expect(getByTestId('where').textContent).toBe('/buckets')
    })

    describe('access requests', () => {
      // Requests live under the Access section, not the bare product route.
      const DATAZONE = dataProductAccess.url('datazone:dzd_4xample/lst_9kq2v')
      const DISCOVERY_ONLY = dataProductAccess.url(
        'uc:aws-prod-metastore/quilt_demo/restricted_cohort',
      )

      it('shows a revoked request as possibly still granted', () => {
        // The §5.4 trap. DataZone's revoke takes `retainPermissions`, and when
        // true the underlying Lake Formation grants stay live. Rendering
        // "Revoked" and stopping there would assert a security outcome that did
        // not happen.
        const { getByText } = mount(DATAZONE)
        expect(
          getByText('Revoked · requested by past.contractor@example.com'),
        ).toBeTruthy()
        expect(getByText(/retained the underlying permissions/)).toBeTruthy()
        expect(getByText(/access may still be in force/)).toBeTruthy()
      })

      it('states that approving a project request grants the whole project', () => {
        // A DataZone subscription is held by a project, so approval covers every
        // member — not the one person who asked.
        const { getByText } = mount(DATAZONE)
        expect(
          getByText(
            /Approving this grants Clinical Data Platform — the whole project, not only r.chen@example.com/,
          ),
        ).toBeTruthy()
      })

      it('names a share recipient as an external widening', () => {
        // A Delta Sharing recipient is an external identity: approval hands
        // access to whoever holds its credentials. `grantsBeyondRequester`
        // originally allow-listed PROJECT/GROUP/ROLE and omitted RECIPIENT, which
        // made this wording unreachable — so it renders only because that bug is
        // fixed, and this test is what keeps it fixed.
        const { getByText } = mount(
          dataProductAccess.url('uc:aws-prod-metastore/share/acme_trials_outbound'),
        )
        expect(
          getByText(
            /Approving this grants acme_analytics — everyone using that share, not only p.nair@example.com/,
          ),
        ).toBeTruthy()
      })

      it('says the platform cannot report status rather than implying a pending sync', () => {
        // Unity can initiate a request but not enumerate one, so a missing
        // platform record is the steady state here. "Not yet visible" would
        // promise an update that never arrives.
        const { getByText } = mount(DISCOVERY_ONLY)
        expect(getByText(/Databricks Unity does not expose request status/)).toBeTruthy()
      })

      it('offers a request affordance only where the platform can start one', () => {
        // `initiableRequests` is branchable (two platforms), unlike
        // `enumerableRequests`. Unity supports initiating, so the button shows.
        const { getByText } = mount(DISCOVERY_ONLY)
        expect(getByText('Request access')).toBeTruthy()
      })

      it('offers nothing to request when everything is already readable', () => {
        // Snowflake's fixture member is readable, so there is no access to ask
        // for and no request record. Neither the button nor the explanation
        // belongs here.
        const { getByText, queryByText } = mount(
          dataProductAccess.url('snowflake:GZT1a9xQ2'),
        )
        expect(queryByText('Request access')).toBeNull()
        expect(getByText('No access requests recorded for this product.')).toBeTruthy()
      })

      it('explains the absence rather than hiding the control where no flow exists', () => {
        // Snowflake has no request flow Quilt can drive, so an unreadable
        // Snowflake product must say why instead of showing a dead button. No
        // fixture covers this (the shipped one is readable), so the product is
        // built here — the branch is real code and would otherwise go untested.
        const unreadable: DP.DataProduct = {
          ...fixtures.SNOWFLAKE_PRODUCT,
          members: fixtures.SNOWFLAKE_PRODUCT.members.map((m) => ({
            ...m,
            readable: false,
          })),
        }
        const { getByText, queryByText } = render(
          <M.MuiThemeProvider theme={style.appTheme}>
            <Requests product={unreadable} />
          </M.MuiThemeProvider>,
        )
        expect(queryByText('Request access')).toBeNull()
        expect(getByText(/Snowflake has no request flow Quilt can start/)).toBeTruthy()
      })

      it('offers no time-bounded access in the request dialog', () => {
        // No target platform enforces an expiry, so the dialog says so and
        // carries no date control. Asserted with the dialog open: MUI does not
        // mount a closed dialog's children, so checking this on the page behind
        // it would pass while inspecting nothing.
        const { container, getByText, queryByText } = mount(DISCOVERY_ONLY)
        fireEvent.click(getByText('Request access'))
        expect(getByText(/Access granted this way has no expiry/)).toBeTruthy()
        expect(container.ownerDocument.querySelector('input[type="date"]')).toBeNull()
        expect(queryByText(/expires on/i)).toBeNull()
      })

      it('warns before submitting that a DataZone approval grants a project', () => {
        // Said before the act, not after: the requester needs to know the grant
        // does not land on them individually.
        const { getByText } = mount(DATAZONE)
        fireEvent.click(getByText('Request access'))
        expect(
          getByText(/grants access to a project rather than to a person/),
        ).toBeTruthy()
      })
    })
  })
})
