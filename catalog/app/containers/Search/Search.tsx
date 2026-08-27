import * as React from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import * as RRDom from 'react-router-dom'
import * as Sentry from '@sentry/react'

import Layout, { Container, useSearchInput } from 'components/Layout'
import assertNever from 'utils/assertNever'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'

import * as SearchUIModel from './model'
import AssistantContext from './AssistantContext'
import Main from './Layout/Main'
import ListResults from './List'
import * as NoResults from './NoResults'
import TableResults from './Table'

function SearchLayout() {
  const {
    actions: { clearFilters, reset, setBuckets, setResultType },
    state: { resultType, searchString, view },
  } = SearchUIModel.use()
  const tableView =
    view === SearchUIModel.View.Table &&
    resultType === SearchUIModel.ResultType.QuiltPackage
  // The query field is the header bar's, not this screen's.
  const searchInput = useSearchInput()

  const handleRefine = React.useCallback(
    (action: NoResults.Refine) => {
      switch (action) {
        case NoResults.Refine.Buckets:
          setBuckets([])
          break
        case NoResults.Refine.ResultType:
          const otherResultType =
            resultType === SearchUIModel.ResultType.QuiltPackage
              ? SearchUIModel.ResultType.S3Object
              : SearchUIModel.ResultType.QuiltPackage
          setResultType(otherResultType)
          break
        case NoResults.Refine.Filters:
          clearFilters()
          break
        case NoResults.Refine.Search:
          searchInput.select()
          break
        case NoResults.Refine.New:
          reset()
          searchInput.focus()
          break
        case NoResults.Refine.Network:
          // TODO: retry GQL request
          window.location.reload()
          break
        default:
          assertNever(action)
      }
    },
    [searchInput, resultType, setBuckets, clearFilters, setResultType, reset],
  )

  return (
    <Container>
      <MetaTitle>{searchString || 'Search'}</MetaTitle>
      {/* The query input is the persistent header search bar (ContentBar),
          bound to this screen's model -- no in-body field. */}
      <Main>
        {tableView ? (
          <TableResults
            emptySlot={<NoResults.Empty onRefine={handleRefine} />}
            onRefine={handleRefine}
          />
        ) : (
          <ListResults
            emptySlot={<NoResults.Empty onRefine={handleRefine} />}
            onRefine={handleRefine}
          />
        )}
      </Main>
    </Container>
  )
}

// The URL is parsed in `SearchUIModel.Provider`'s own render, so a filter param
// that won't parse throws above every boundary search has -- all the way to
// `Errors.ErrorBoundary` in app.tsx, which replaces the whole catalog with the
// app-level error screen. The search UI is entirely reconstructable from the
// URL, so that page is recoverable in place: keep the chrome and offer the two
// exits that work.
function SearchErrorFallback({ error }: FallbackProps) {
  const { urls } = NamedRoutes.use()
  const onRefine = NoResults.useErrorRefine(urls.search({}))
  return (
    <Layout>
      <NoResults.Error onRefine={onRefine}>{error.message}</NoResults.Error>
    </Layout>
  )
}

const onError = (error: Error) => Sentry.captureException(error)

export default function Search() {
  const { search } = RRDom.useLocation()
  return (
    <ErrorBoundary
      FallbackComponent={SearchErrorFallback}
      onError={onError}
      resetKeys={[search]}
    >
      <SearchUIModel.Provider>
        <AssistantContext />
        <Layout pre={<SearchLayout />} />
      </SearchUIModel.Provider>
    </ErrorBoundary>
  )
}
