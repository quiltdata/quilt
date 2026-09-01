import * as React from 'react'
import { MemoryRouter, Route, Switch, useLocation } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  queries,
  queriesAthena,
  queriesAthenaExecution,
  queriesAthenaWorkgroup,
  queriesEs,
} from 'constants/routes'
import type { CatalogSettings } from 'utils/CatalogSettings'
import * as NamedRoutes from 'utils/NamedRoutes'

let settings: CatalogSettings | null = null
vi.mock('utils/CatalogSettings', () => ({
  use: () => settings,
  useWriteSettings: () => async () => {},
}))

// The two consoles are the heavy half of this screen (AWS clients, the Ace
// editor, GraphQL); this spec is about which of them the flag lets you reach,
// so they stand in as markers.
vi.mock('./Athena', () => ({ default: () => <div data-testid="athena" /> }))
vi.mock('./ElasticSearch', () => ({ default: () => <div data-testid="es" /> }))
vi.mock('components/Layout', () => ({
  default: () => null,
  Container: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('utils/MetaTitle', () => ({ default: () => null }))

import { QueriesScreen } from './Queries'

const routes = {
  queries,
  queriesAthena,
  queriesAthenaExecution,
  queriesAthenaWorkgroup,
  queriesEs,
}

function LocationDisplay() {
  const { pathname } = useLocation()
  return <div data-testid="loc">{pathname}</div>
}

function at(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <NamedRoutes.Provider routes={routes}>
        <Switch>
          <Route path={queries.path}>
            <QueriesScreen />
          </Route>
        </Switch>
        <LocationDisplay />
      </NamedRoutes.Provider>
    </MemoryRouter>,
  )
}

describe('containers/Queries', () => {
  afterEach(cleanup)

  describe('with the ElasticSearch console off (the default)', () => {
    beforeEach(() => {
      settings = null
    })

    it('offers no ElasticSearch tab', () => {
      const { queryByText } = at('/queries/athena')
      expect(queryByText('ElasticSearch')).toBeNull()
    })

    // A lone underlined tab that switches to nothing is a dead affordance, so
    // the whole strip goes rather than shrinking to one entry.
    it('drops the tab strip entirely rather than leaving one Athena tab', () => {
      const { queryByText } = at('/queries/athena')
      expect(queryByText('Athena')).toBeNull()
      expect(queryByText('Queries')).not.toBeNull()
    })

    it('redirects /queries/es to Athena instead of rendering a blank panel', () => {
      const { getByTestId, queryByTestId } = at('/queries/es')
      expect(getByTestId('loc').textContent).toBe('/queries/athena')
      expect(queryByTestId('es')).toBeNull()
    })

    it('still renders Athena', () => {
      expect(at('/queries/athena').queryByTestId('athena')).not.toBeNull()
    })
  })

  describe('with the ElasticSearch console on', () => {
    beforeEach(() => {
      settings = { features: { 'elasticsearch-queries': true } }
    })

    it('shows both tabs', () => {
      const { queryByText } = at('/queries/athena')
      expect(queryByText('Athena')).not.toBeNull()
      expect(queryByText('ElasticSearch')).not.toBeNull()
    })

    it('renders the ElasticSearch console at /queries/es', () => {
      const { queryByTestId } = at('/queries/es')
      expect(queryByTestId('es')).not.toBeNull()
    })

    // The Athena console is scoped by `?bucket=`. A bare pathname on these tabs
    // drops the scope, so switching consoles and coming back would land the
    // reader in a different console from the one they left.
    it('keeps the scope on both tabs', () => {
      const { getByText } = at('/queries/athena?bucket=my-bucket')
      expect(getByText('Athena').closest('a')?.getAttribute('href')).toBe(
        '/queries/athena?bucket=my-bucket',
      )
      expect(getByText('ElasticSearch').closest('a')?.getAttribute('href')).toBe(
        '/queries/es?bucket=my-bucket',
      )
    })

    it('adds no query string to the tabs when there is no scope', () => {
      const { getByText } = at('/queries/athena')
      expect(getByText('Athena').closest('a')?.getAttribute('href')).toBe(
        '/queries/athena',
      )
    })
  })
})
