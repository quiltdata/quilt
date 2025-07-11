import * as React from 'react'
import * as M from '@material-ui/core'

import * as SearchUIModel from 'containers/Search/model'
import MetaTitle from 'utils/MetaTitle'

import { useBucketStrict } from 'containers/Bucket/Routes'
import Main from 'containers/Search/Layout/Main'
import ListResults from 'containers/Search/List'
import TableResults from 'containers/Search/Table'
import NoPackages from './NoPackages'

const useStyles = M.makeStyles((t) => ({
  main: {
    padding: t.spacing(3, 0),
  },
}))

export default function PackageList() {
  const bucket = useBucketStrict()
  const { state } = SearchUIModel.use()
  const classes = useStyles()
  const tableView =
    state.view === SearchUIModel.View.Table &&
    state.resultType === SearchUIModel.ResultType.QuiltPackage
  const titleSegments = React.useMemo(() => {
    const base = ['Packages', bucket]
    return state.searchString ? [...base, state.searchString] : base
  }, [bucket, state.searchString])
  return (
    <>
      <MetaTitle>{titleSegments}</MetaTitle>
      <Main className={classes.main}>
        {tableView ? (
          <TableResults bucket={bucket} emptyFallback={<NoPackages bucket={bucket} />} />
        ) : (
          <ListResults />
        )}
      </Main>
    </>
  )
}
