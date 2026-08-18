import * as React from 'react'
import { MemoryRouter, Route, Switch, useLocation } from 'react-router-dom'
import { render, cleanup, fireEvent } from '@testing-library/react'
import * as M from '@material-ui/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  dataProduct,
  dataProductAccess,
  dataProductContents,
  dataProducts,
  home,
} from 'constants/routes'
import * as style from 'constants/style'
import * as DP from 'model/DataProducts'
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

import { DataProductsScreen } from './DataProducts'
import Requests from './Requests'

const routes = {
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

    it('lists products with the catalog that defines each one', () => {
      const { getByText, getAllByText } = mount(dataProducts.url())
      // Products are externally owned, so which catalog defines one is a fact
      // about the product, not an implementation detail.
      expect(getByText('AWS DataZone')).toBeTruthy()
      expect(getAllByText('Databricks Unity').length).toBeGreaterThan(0)
      expect(getByText('Snowflake')).toBeTruthy()
    })

    it('says contents are not visible rather than reporting zero members', () => {
      // Discovery-only access (Unity BROWSE) shows the product and no contents.
      // "No members" would misreport a permission boundary as an empty dataset.
      const { getByText } = mount(dataProducts.url())
      expect(getByText('Contents not visible to you')).toBeTruthy()
    })

    it('separates catalog-governed contents from files listed off S3', () => {
      // The load-bearing disclosure of browse-into (contract §7.1): a DataZone
      // S3 asset gives only a bucketArn, so Quilt lists it directly and the
      // catalog's row/column rules do not cover what is shown. One
      // undifferentiated list would imply a guarantee that does not exist.
      const { getByText } = mount(
        dataProductContents.url('datazone:dzd_4xample/lst_9kq2v'),
      )
      expect(getByText(/Enumerated and governed by AWS DataZone/)).toBeTruthy()
      expect(getByText('Files listed from S3')).toBeTruthy()
      expect(
        getByText(/row and column rules do not\s+apply to this listing/),
      ).toBeTruthy()
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

    it('redirects an unknown id back to the list instead of 404ing', () => {
      // A synthesized id is not stable across renames — on Unity a schema rename
      // silently changes it and emits no event — so a miss is expected drift.
      const { getByText } = mount(
        dataProduct.url('uc:aws-prod-metastore/quilt_demo/gone'),
      )
      expect(getByText('Data products')).toBeTruthy()
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
          getByText('Revoked · requested by former-contractor@example.com'),
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
            /Approving this grants Clinical Data Platform — the whole project, not only rita@quiltdata.io/,
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
          ...DP.fixtures.SNOWFLAKE_PRODUCT,
          members: DP.fixtures.SNOWFLAKE_PRODUCT.members.map((m) => ({
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
