import * as React from 'react'
import { ErrorBoundary, FallbackProps } from 'react-error-boundary'
import * as RRDom from 'react-router-dom'

import Layout, { Container } from 'components/Layout'
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
  const [inputEl, setInputEl] = React.useState<HTMLInputElement | null>(null)

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
          inputEl?.select()
          break
        case NoResults.Refine.New:
          reset()
          inputEl?.focus()
          break
        case NoResults.Refine.Network:
          // TODO: retry GQL request
          window.location.reload()
          break
        default:
          assertNever(action)
      }
    },
    [inputEl, resultType, setBuckets, clearFilters, setResultType, reset],
  )

  return (
    <Container>
      <MetaTitle>{searchString || 'Search'}</MetaTitle>
      <Main inputRef={setInputEl}>
        {tableView ? (
          <TableResults onRefine={handleRefine} />
        ) : (
          <ListResults onRefine={handleRefine} />
        )}
      </Main>
    </Container>
  )
}

function SearchErrorBoundary({ error, resetErrorBoundary }: FallbackProps) {
  const handleRefine: NoResults.UnexpectedErrorProps['onRefine'] = React.useCallback(
    (action) =>
      action === NoResults.Refine.Network
        ? window.location.reload() // TODO: retry GQL request
        : resetErrorBoundary(),
    [resetErrorBoundary],
  )
  return (
    <Layout>
      <NoResults.UnexpectedError onRefine={handleRefine}>
        {error.message}
      </NoResults.UnexpectedError>
    </Layout>
  )
}

export default function Search() {
  const { push } = RRDom.useHistory()
  const { urls } = NamedRoutes.use()
  const onReset = React.useCallback(() => push(urls.search({})), [push, urls])
  return (
    <ErrorBoundary FallbackComponent={SearchErrorBoundary} onReset={onReset}>
      <SearchUIModel.Provider>
        <AssistantContext />
        <Layout pre={<SearchLayout />} />
      </SearchUIModel.Provider>
    </ErrorBoundary>
  )
}
