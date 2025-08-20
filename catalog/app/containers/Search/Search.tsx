import * as React from 'react'

import Layout, { Container } from 'components/Layout'
import assertNever from 'utils/assertNever'
import MetaTitle from 'utils/MetaTitle'

import * as SearchUIModel from './model'
import AssistantContext from './AssistantContext'
import Main from './Layout/Main'
import ListResults from './List'
import { Refine } from './NoResults'
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
    (action: Refine) => {
      switch (action) {
        case Refine.Buckets:
          setBuckets([])
          break
        case Refine.ResultType:
          const otherResultType =
            resultType === SearchUIModel.ResultType.QuiltPackage
              ? SearchUIModel.ResultType.S3Object
              : SearchUIModel.ResultType.QuiltPackage
          setResultType(otherResultType)
          break
        case Refine.Filters:
          clearFilters()
          break
        case Refine.Search:
          inputEl?.select()
          break
        case Refine.New:
          reset()
          inputEl?.focus()
          break
        case Refine.Network:
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

export default function Search() {
  return (
    <SearchUIModel.Provider>
      <AssistantContext />
      <Layout pre={<SearchLayout />} />
    </SearchUIModel.Provider>
  )
}
