import * as React from 'react'

import Layout, { Container, useSearchInput } from 'components/Layout'
import assertNever from 'utils/assertNever'
import MetaTitle from 'utils/MetaTitle'

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

export default function Search() {
  return (
    <SearchUIModel.Provider>
      <AssistantContext />
      <Layout pre={<SearchLayout />} />
    </SearchUIModel.Provider>
  )
}
