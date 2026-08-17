import * as React from 'react'
import { MemoryRouter, Route, Switch, useLocation } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import * as M from '@material-ui/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { dataProduct, dataProducts, home } from 'constants/routes'
import * as style from 'constants/style'
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

const routes = { dataProduct, dataProducts, home }

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
      const { getByText } = mount(dataProduct.url('datazone:dzd_4xample/lst_9kq2v'))
      expect(getByText(/Enumerated and governed by AWS DataZone/)).toBeTruthy()
      expect(getByText('Files listed from S3')).toBeTruthy()
      expect(
        getByText(/row and column rules do not\s+apply to this listing/),
      ).toBeTruthy()
    })

    it('never claims what a named person can see', () => {
      // Unknowable in principle: row-policy bodies can call external functions.
      const { getByText } = mount(dataProduct.url('datazone:dzd_4xample/lst_9kq2v'))
      expect(
        getByText(/not a statement of what any\s+particular person can see/),
      ).toBeTruthy()
    })

    it('renders unreadable policy state as unknown, not as none', () => {
      // POLICY_REFERENCES is privilege-filtered, so absence is not a guarantee.
      const { getByText } = mount(dataProduct.url('snowflake:GZT1a9xQ2'))
      expect(getByText(/Treat\s+this as unknown rather than as none/)).toBeTruthy()
    })

    it('redirects an unknown id back to the list instead of 404ing', () => {
      // A synthesized id is not stable across renames — on Unity a schema rename
      // silently changes it and emits no event — so a miss is expected drift.
      const { getByText } = mount(
        dataProduct.url('uc:aws-prod-metastore/quilt_demo/gone'),
      )
      expect(getByText('Data products')).toBeTruthy()
    })
  })
})
