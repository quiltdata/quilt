import invariant from 'invariant'
import * as RRDom from 'react-router-dom'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as SearchUIModel from 'containers/Search/model'
import AssistantContext from 'containers/Search/AssistantContext'
import MetaTitle from 'utils/MetaTitle'

import Main from 'containers/Search/Layout/Main'
import ListResults from 'containers/Search/List'
import TableResults from 'containers/Search/Table'

const useStyles = M.makeStyles((t) => ({
  main: {
    padding: t.spacing(3),
  },
  results: {
    marginTop: t.spacing(2),
  },
}))

export function SearchLayout() {
  const { bucket } = RRDom.useParams<{ bucket: string }>()
  invariant(!!bucket, '`bucket` must be defined')
  const model = SearchUIModel.use()
  const classes = useStyles()
  return (
    <>
      <MetaTitle>{['Packages', bucket, model.state.searchString || '']}</MetaTitle>
      <Main className={classes.main}>
        {model.state.view === SearchUIModel.View.Table &&
        model.state.resultType === SearchUIModel.ResultType.QuiltPackage ? (
          <TableResults className={classes.results} />
        ) : (
          <ListResults className={classes.results} />
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
