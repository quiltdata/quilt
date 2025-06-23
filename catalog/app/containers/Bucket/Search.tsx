import * as React from 'react'
import * as M from '@material-ui/core'

import * as SearchUIModel from 'containers/Search/model'
import AssistantContext from 'containers/Search/AssistantContext'
import MetaTitle from 'utils/MetaTitle'

import Main from 'containers/Search/Layout/Main'
import TableResults from 'containers/Search/Table'
import { ResultsInner } from 'containers/Search/Search'

const useStyles = M.makeStyles((t) => ({
  main: {
    padding: t.spacing(3),
  },
  results: {
    marginTop: t.spacing(2),
  },
}))

export function SearchLayout() {
  const model = SearchUIModel.use()
  const classes = useStyles()
  return (
    <>
      <MetaTitle>{model.state.searchString || 'Search'}</MetaTitle>
      <Main className={classes.main}>
        {model.state.view === SearchUIModel.View.Table &&
        model.state.resultType === SearchUIModel.ResultType.QuiltPackage ? (
          <TableResults className={classes.results} />
        ) : (
          <ResultsInner className={classes.results} />
        )}
      </Main>
    </>
  )
}

export default function PackageListWrapper() {
  return (
    <>
      <AssistantContext />
      <SearchLayout />
    </>
  )
}
